import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import AppText from '../../src/components/AppText'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useAuth } from '../../src/context/AuthContext'
import { useTheme } from '../../src/context/ThemeContext'
import { getMyPostsPaged, getMyPostsByDate, getMyPosts } from '../../src/services/postService'
import type { Post } from '../../src/services/postService'
import type { DocumentSnapshot } from 'firebase/firestore'
import { getMyNotifications } from '../../src/services/friendService'
import { toKoreanDate, today } from '../../src/utils/formatDate'
import PostCard from '../../src/components/PostCard'
import CalendarView from '../../src/components/CalendarView'
import { SkeletonPostCard } from '../../src/components/Skeleton'
import { makeCommonStyles } from '../../src/theme/commonStyles'

type ViewMode = 'feed' | 'calendar'

export default function MainPage() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const { highlightPostId } = useLocalSearchParams<{ highlightPostId?: string }>()
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('feed')
  const flatListRef = useRef<FlatList<Post>>(null)
  const handledHighlightRef = useRef<string | null>(null)
  const viewModeRef = useRef<ViewMode>('feed')
  const calSelectedRef = useRef<string | null>(null)

  // 피드
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = useState(true)

  // 캘린더
  const [calSelected, setCalSelected] = useState<string | null>(null)
  const [calPosts, setCalPosts] = useState<Post[]>([])
  const [calLoading, setCalLoading] = useState(false)
  const [calPostDates, setCalPostDates] = useState<Set<string>>(new Set())
  const [unreadCount, setUnreadCount] = useState(0)

  async function loadCalPostDates() {
    if (!user) return
    try {
      const posts = await getMyPosts(user.uid)
      setCalPostDates(new Set(posts.map(p => p.recordDate)))
    } catch {}
  }

  async function loadFeed(refresh = false, silent = false) {
    if (!user) return
    if (refresh && !silent) setLoading(true)
    try {
      const page = await getMyPostsPaged(user.uid, refresh ? null : lastDoc)
      if (refresh) {
        setPosts(page.posts)
      } else {
        setPosts(prev => [...prev, ...page.posts])
      }
      setLastDoc(page.lastDoc)
      setHasMore(page.hasMore)
    } catch {}
    finally {
      if (refresh && !silent) setLoading(false)
    }
  }

  useEffect(() => { viewModeRef.current = viewMode }, [viewMode])
  useEffect(() => { calSelectedRef.current = calSelected }, [calSelected])

  useEffect(() => {
    loadFeed(true)
  }, [user])

  useFocusEffect(useCallback(() => {
    if (!user) return
    getMyNotifications(user.uid).then(ns => setUnreadCount(ns.filter(n => !n.read).length)).catch(() => {})
    loadFeed(true, true)
    loadCalPostDates()
    if (viewModeRef.current === 'calendar' && calSelectedRef.current) {
      const dateStr = calSelectedRef.current
      setCalLoading(true)
      getMyPostsByDate(user.uid, dateStr)
        .then(data => setCalPosts(data))
        .catch(() => setCalPosts([]))
        .finally(() => setCalLoading(false))
    }
  }, [user]))

  useEffect(() => {
    if (!highlightPostId || posts.length === 0) return
    if (handledHighlightRef.current === highlightPostId) return
    handledHighlightRef.current = highlightPostId
    setViewMode('feed')
    setActiveHighlight(highlightPostId)
    const idx = posts.findIndex(p => p.id === highlightPostId)
    if (idx >= 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.1 })
      }, 300)
    }
  }, [highlightPostId, posts])

  // 하이라이트 자동 해제 — posts 변경과 분리해야 타이머가 취소되지 않음
  useEffect(() => {
    if (!activeHighlight) return
    const timer = setTimeout(() => setActiveHighlight(null), 5000)
    return () => clearTimeout(timer)
  }, [activeHighlight])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([
      loadFeed(true),
      user ? getMyNotifications(user.uid).then(ns => setUnreadCount(ns.filter(n => !n.read).length)).catch(() => {}) : Promise.resolve(),
    ])
    setRefreshing(false)
  }, [user])

  const onEndReached = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    await loadFeed(false)
    setLoadingMore(false)
  }, [loadingMore, hasMore, lastDoc, user])

  async function handleCalDateSelect(dateStr: string) {
    if (!user) return
    setCalSelected(dateStr)
    setCalLoading(true)
    try {
      const data = await getMyPostsByDate(user.uid, dateStr)
      setCalPosts(data)
    } catch {
      setCalPosts([])
    } finally {
      setCalLoading(false)
    }
  }

  const s = makeStyles(colors)
  const cs = makeCommonStyles(colors)

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <AppText title style={s.logo}>나의 조각</AppText>
        <TouchableOpacity style={s.bellBtn} onPress={() => router.push({ pathname: '/(tabs)/mypage', params: { tab: 'notifications' } })}>
          <Ionicons name="notifications-outline" size={22} color={colors.textMuted} />
          {unreadCount > 0 && (
            <View style={s.badge}>
              <AppText style={s.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</AppText>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={cs.tabBar}>
        {(['feed', 'calendar'] as ViewMode[]).map(mode => (
          <TouchableOpacity key={mode} style={[cs.tabBtn, viewMode === mode && cs.tabBtnActive]} onPress={() => setViewMode(mode)}>
            <AppText style={[cs.tabBtnText, viewMode === mode && cs.tabBtnTextActive]}>
              {mode === 'feed' ? '최근 하루' : '달력 보기'}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      {viewMode === 'feed' ? (
        loading ? (
          <View style={s.list}>
            <SkeletonPostCard /><SkeletonPostCard /><SkeletonPostCard />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={posts}
            keyExtractor={p => p.id}
            contentContainerStyle={s.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.3}
            onScrollToIndexFailed={info => {
              setTimeout(() => flatListRef.current?.scrollToIndex({ index: info.highestMeasuredFrameIndex, animated: true }), 100)
            }}
            ListEmptyComponent={
              <View style={s.empty}>
                <AppText style={s.emptyText}>나의 첫 조각을 남겨보세요 💬</AppText>
              </View>
            }
            ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ padding: 16 }} /> : null}
            renderItem={({ item }) => (
              <PostCard
                post={item}
                currentUserUid={user?.uid}
                onEdit={() => router.push({ pathname: '/write-modal', params: { id: item.id } })}
                highlighted={item.id === activeHighlight}
              />
            )}
          />
        )
      ) : (
        <FlatList
          data={calPosts}
          keyExtractor={p => p.id}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            <CalendarView
              onSelectDate={handleCalDateSelect}
              selectedDate={calSelected}
              postDates={calPostDates}
            />
          }
          ListEmptyComponent={
            calSelected ? (
              calLoading
                ? <ActivityIndicator color={colors.primary} style={{ padding: 24 }} />
                : <View style={s.empty}><AppText style={s.emptyText}>이 날의 조각이 없어요 😭</AppText></View>
            ) : null
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              currentUserUid={user?.uid}
              onEdit={() => router.push({ pathname: '/write-modal', params: { id: item.id } })}
            />
          )}
        />
      )}

      <TouchableOpacity
        style={s.fab}
        onPress={() => router.push({
          pathname: '/write-modal',
          params: viewMode === 'calendar' && calSelected ? { date: calSelected } : {},
        })}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  )
}

function makeStyles(colors: ReturnType<typeof import('../../src/theme/colors').getThemeColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    logo: { fontSize: 24, fontWeight: '800', color: colors.primary },
    bellBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    badge: {
      position: 'absolute', top: 2, right: 2,
      minWidth: 16, height: 16, borderRadius: 8,
      backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
    },
    badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
    fab: {
      position: 'absolute', bottom: 24, right: 20,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: colors.primary,
      justifyContent: 'center', alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6,
      elevation: 6,
    },
    list: { padding: 16, gap: 12 },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60, gap: 20 },
    emptyText: { color: colors.textMuted, fontSize: 16 },
  })
}
