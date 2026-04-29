import { useState, useEffect, useRef } from 'react'
import {
  View, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, type ListRenderItem,
} from 'react-native'
import { Image } from 'expo-image'
import AppText from '../../src/components/AppText'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../../src/context/AuthContext'
import { useTheme } from '../../src/context/ThemeContext'
import { useToast } from '../../src/context/ToastContext'
import { getMyFriends, sendFriendRequest, getFriendshipStatus } from '../../src/services/friendService'
import type { Friendship } from '../../src/services/friendService'
import { getUserProfile, searchUser } from '../../src/services/authService'
import type { UserProfile } from '../../src/services/authService'
import { getFriendsPosts, getFriendPostsByUid, getFriendPostsByDate } from '../../src/services/postService'
import type { Post } from '../../src/services/postService'
import { today } from '../../src/utils/formatDate'
import { useLocalSearchParams } from 'expo-router'
import PostCard from '../../src/components/PostCard'
import CalendarView from '../../src/components/CalendarView'
import { SkeletonPostCard } from '../../src/components/Skeleton'
import { makeCommonStyles } from '../../src/theme/commonStyles'

interface FriendWithProfile extends Friendship {
  nickname: string
  photoUrl?: string | null
  photoThumbUrl?: string | null
  birthdate?: string | null
}

type ViewMode = 'feed' | 'calendar'

const TUTORIAL_TIPS = [
  { icon: 'people-outline',      label: '친구',   desc: '친구들의 하루 조각이 이곳에 모여요' },
  { icon: 'heart-outline',       label: '공감',   desc: '마음을 가볍게 전해 보세요' },
  { icon: 'chatbubble-outline',  label: '댓글',   desc: '따뜻한 한마디를 남겨 보세요' },
]

export default function FriendsPage() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const { showToast } = useToast()
  const insets = useSafeAreaInsets()
  const [showTutorial, setShowTutorial] = useState(false)

  const [viewMode, setViewMode] = useState<ViewMode>('feed')
  const [friends, setFriends] = useState<FriendWithProfile[]>([])
  const [selectedUid, setSelectedUid] = useState<string>('all')

  const [feedPosts, setFeedPosts] = useState<Post[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // 캘린더
  const [calSelected, setCalSelected] = useState<string | null>(null)
  const [calPosts, setCalPosts] = useState<Post[]>([])
  const [calLoading, setCalLoading] = useState(false)
  const [calPostDates, setCalPostDates] = useState<Set<string>>(new Set())

  // 친구 추가 모달
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ user: UserProfile; status: unknown }[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  const [activeHighlight, setActiveHighlight] = useState<string | null>(null)
  const flatListRef = useRef<FlatList<Post>>(null)
  const handledHighlightRef = useRef<string | null>(null)

  const friendUids = friends.map(f => f.friendUid)
  const { openAdd, highlightPostId } = useLocalSearchParams<{ openAdd?: string; highlightPostId?: string }>()

  useEffect(() => { loadFriends() }, [user])

  useEffect(() => {
    if (openAdd === '1') setShowAddModal(true)
  }, [openAdd])

  useEffect(() => {
    if (!highlightPostId || feedPosts.length === 0) return
    if (handledHighlightRef.current === highlightPostId) return
    handledHighlightRef.current = highlightPostId
    setViewMode('feed')
    setActiveHighlight(highlightPostId)
    const idx = feedPosts.findIndex(p => p.id === highlightPostId)
    if (idx >= 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.1 })
      }, 300)
    }
  }, [highlightPostId, feedPosts])

  useEffect(() => {
    if (!activeHighlight) return
    const timer = setTimeout(() => setActiveHighlight(null), 5000)
    return () => clearTimeout(timer)
  }, [activeHighlight])

  useEffect(() => {
    if (viewMode === 'feed') loadFeed()
    else loadCalendarDates()
  }, [viewMode, selectedUid, friends])

  function closeTutorial() {
    setShowTutorial(false)
  }

  async function neverShowTutorial() {
    await AsyncStorage.setItem('friends_tutorial_done', 'true')
    setShowTutorial(false)
  }

  async function loadFriends() {
    if (!user) return
    try {
      const raw = await getMyFriends(user.uid)
      const profiles = await Promise.all(raw.map(f => getUserProfile(f.friendUid)))
      const list = raw.map((f, i) => ({
        ...f,
        nickname: profiles[i]?.nickname || '알 수 없음',
        photoUrl: profiles[i]?.photoUrl,
        photoThumbUrl: profiles[i]?.photoThumbUrl,
        birthdate: profiles[i]?.privateBirthdate ? null : (profiles[i]?.birthdate ?? null),
      }))
      setFriends(list)
      const done = await AsyncStorage.getItem('friends_tutorial_done')
      if (list.length === 0 || !done) setShowTutorial(true)
    } catch { showToast('친구 목록을 불러오지 못했어요', 'error') }
  }

  async function loadFeed(refresh = false) {
    if (!user) return
    if (refresh) setRefreshing(true); else setFeedLoading(true)
    try {
      const uids = selectedUid === 'all' ? friendUids : [selectedUid]
      const posts = selectedUid === 'all'
        ? await getFriendsPosts(friendUids, user.uid)
        : await getFriendPostsByUid(selectedUid, user.uid)
      setFeedPosts(posts)
    } catch { setFeedPosts([]) }
    finally {
      setFeedLoading(false)
      setRefreshing(false)
    }
  }

  async function loadCalendarDates() {
    if (!user || !friendUids.length) { setCalPostDates(new Set()); return }
    try {
      const posts = selectedUid === 'all'
        ? await getFriendsPosts(friendUids, user.uid)
        : await getFriendPostsByUid(selectedUid, user.uid)
      setCalPostDates(new Set(posts.map(p => p.recordDate)))
    } catch {}
  }

  async function handleCalDateSelect(dateStr: string) {
    if (!user) return
    setCalSelected(dateStr)
    setCalLoading(true)
    try {
      const uids = selectedUid === 'all' ? friendUids : [selectedUid]
      const posts = await getFriendPostsByDate(uids, dateStr, user.uid)
      setCalPosts(posts)
    } catch { setCalPosts([]) }
    finally { setCalLoading(false) }
  }

  async function handleSearch() {
    const q = searchQuery.trim()
    if (!q || !user) return
    setSearching(true); setSearched(false); setSearchResults([])
    try {
      const users = await searchUser(q)
      const filtered = users.filter(u => u.uid !== user.uid)
      const statuses = await Promise.all(filtered.map(u => getFriendshipStatus(user.uid, u.uid)))
      setSearchResults(filtered.map((u, i) => ({ user: u, status: statuses[i] })))
    } catch { showToast('친구를 찾는 중 오류가 발생했어요', 'error') }
    finally { setSearching(false); setSearched(true) }
  }

  async function handleRequest(toUid: string) {
    if (!user) return
    try {
      await sendFriendRequest(user.uid, toUid)
      showToast('친구 요청을 보냈어요', 'success')
      setSearchResults(prev => prev.map(r =>
        r.user.uid === toUid ? { ...r, status: { status: 'pending', requesterId: user.uid } } : r
      ))
    } catch (err) {
      showToast((err as Error).message || '요청에 실패했어요', 'error')
    }
  }

  const s = makeStyles(colors)
  const cs = makeCommonStyles(colors)

  const renderPost: ListRenderItem<Post> = ({ item }) => {
    const friend = friends.find(f => f.friendUid === item.uid)
    return (
      <PostCard
        post={item}
        currentUserUid={user?.uid}
        readOnly
        authorName={friend?.nickname || '알 수 없음'}
        authorThumb={friend?.photoThumbUrl || friend?.photoUrl}
        authorBirthdate={friend?.birthdate}
        highlighted={item.id === activeHighlight}
      />
    )
  }

  return (
    <SafeAreaView style={cs.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={cs.header}>
        <AppText title style={s.logo}>친구의 조각</AppText>
        <TouchableOpacity onPress={() => { setShowAddModal(true) }} style={s.addBtn}>
          <Ionicons name="person-add-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* 친구 필터 */}
      <View style={s.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {[{ uid: 'all', nickname: '전체 친구' }, ...friends.map(f => ({ uid: f.friendUid, nickname: f.nickname }))].map(f => (
            <TouchableOpacity
              key={f.uid}
              style={[s.filterChip, selectedUid === f.uid && s.filterChipActive]}
              onPress={() => setSelectedUid(f.uid)}
            >
              <AppText style={[s.filterChipText, selectedUid === f.uid && s.filterChipTextActive]}>{f.nickname}</AppText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 탭 */}
      <View style={cs.tabBar}>
        {(['feed', 'calendar'] as ViewMode[]).map(mode => (
          <TouchableOpacity key={mode} style={[cs.tabBtn, viewMode === mode && cs.tabBtnActive]} onPress={() => setViewMode(mode)}>
            <AppText style={[cs.tabBtnText, viewMode === mode && cs.tabBtnTextActive]}>
              {mode === 'feed' ? '최근 하루' : '달력 보기'}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      {/* 콘텐츠 */}
      <View style={{ flex: 1 }}>
        {viewMode === 'feed' ? (
          feedLoading ? (
            <ScrollView contentContainerStyle={s.list}>
              <SkeletonPostCard /><SkeletonPostCard /><SkeletonPostCard />
            </ScrollView>
          ) : !friendUids.length ? (
            <View style={s.center}>
              <AppText style={s.emptyText}>친구가 되면{"\n"}친구의 조각을 볼 수 있어요 🙌</AppText>
              <TouchableOpacity style={s.findFriendBtn} onPress={() => setShowAddModal(true)}>
                <Ionicons name="person-add-outline" size={16} color="#fff" />
                <AppText style={s.findFriendBtnText}>친구를 찾아 볼까요?</AppText>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={feedPosts}
              keyExtractor={p => p.id}
              contentContainerStyle={s.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFeed(true)} tintColor={colors.primary} />}
              ListEmptyComponent={<View style={s.center}><AppText style={s.emptyText}>친구의 조각이 없어요 😭</AppText></View>}
              onScrollToIndexFailed={info => {
                setTimeout(() => flatListRef.current?.scrollToIndex({ index: info.highestMeasuredFrameIndex, animated: true }), 100)
              }}
              renderItem={renderPost}
            />
          )
        ) : (
          <FlatList
            data={calPosts}
            keyExtractor={p => p.id}
            contentContainerStyle={s.list}
            ListHeaderComponent={
              <CalendarView
                selectedDate={calSelected}
                onSelectDate={handleCalDateSelect}
                postDates={calPostDates}
              />
            }
            ListEmptyComponent={
              calSelected
                ? calLoading
                  ? <ActivityIndicator color={colors.primary} style={{ padding: 24 }} />
                  : <View style={s.center}><AppText style={s.emptyText}>이 날의 친구 조각이 없어요 😭</AppText></View>
                : null
            }
            renderItem={renderPost}
          />
        )}
      </View>

      {/* 친구 탭 튜토리얼 */}
      <Modal visible={showTutorial} transparent animationType="fade" statusBarTranslucent>
        <Pressable style={cs.tutorialOverlay} onPress={closeTutorial}>
          <Pressable
            style={[cs.tutorialCloseBtn, { top: insets.top + 10 }]}
            onPress={closeTutorial}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>

          <Pressable style={[cs.tutorialCard, { backgroundColor: colors.surface }]} onPress={e => e.stopPropagation()}>
            <View style={s.tutorialCardTitleRow}>
              <Ionicons name="person" size={20} color={colors.textMuted} />
              <AppText title style={[cs.tutorialCardTitle, { color: colors.text }]}>
                친구의 조각 안내
              </AppText>
            </View>

            {TUTORIAL_TIPS.map((tip, i) => (
              <View key={i}>
                <View style={cs.tutorialRow}>
                  <View style={[cs.tutorialIconBox, { backgroundColor: colors.primaryLight2 }]}>
                    <Ionicons name={tip.icon as any} size={22} color={colors.primary} />
                  </View>
                  <View style={cs.tutorialTextWrap}>
                    <AppText style={[cs.tutorialLabel, { color: colors.text }]}>{tip.label}</AppText>
                    <AppText style={[cs.tutorialDesc, { color: colors.textMuted }]}>{tip.desc}</AppText>
                  </View>
                </View>
                {i < TUTORIAL_TIPS.length - 1 && (
                  <View style={[cs.tutorialDivider, { backgroundColor: colors.border }]} />
                )}
              </View>
            ))}

            <Pressable
              style={[cs.tutorialDoneBtn, { backgroundColor: colors.primary }]}
              onPress={closeTutorial}
            >
              <AppText style={[cs.tutorialDoneBtnText, { color: colors.white }]}>확인했어요</AppText>
            </Pressable>
            <Pressable style={cs.tutorialNeverBtn} onPress={neverShowTutorial}>
              <AppText style={[cs.tutorialNeverText, { color: colors.textMuted }]}>다신 안보기🚫</AppText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 친구 추가 모달 */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={cs.sheetOverlay} onPress={() => { setShowAddModal(false); setSearchQuery(''); setSearchResults([]); setSearched(false) }}>
          <Pressable style={[cs.sheet, { gap: 14 }]} onPress={e => e.stopPropagation()}>
            <View style={cs.sheetHeader}>
              <AppText style={cs.sheetTitle}>친구찾기</AppText>
              <TouchableOpacity
                style={cs.sheetCloseBtn}
                onPress={() => { setShowAddModal(false); setSearchQuery(''); setSearchResults([]); setSearched(false) }}
              >
                <AppText style={s.closeBtnText}>✕</AppText>
              </TouchableOpacity>
            </View>

            <View style={s.searchRow}>
              <TextInput
                style={s.searchInput}
                placeholder="이메일 또는 닉네임으로 찾아보세요"
                placeholderTextColor={colors.gray500}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                autoCapitalize="none"
              />
              <TouchableOpacity style={s.searchBtn} onPress={handleSearch} disabled={searching}>
                {searching ? <ActivityIndicator color="#fff" size="small" /> : <AppText style={s.searchBtnText}>찾기</AppText>}
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {searched && searchResults.length === 0 && (
                <AppText style={s.noResult}>친구 찾기 결과가 없어요 🔎</AppText>
              )}
              {searchResults.map(({ user: u, status }) => {
                const s2 = status as { status?: string; requesterId?: string } | null
                return (
                  <View key={u.uid} style={s.userRow}>
                    <View style={s.userAvatar}>
                      {u.photoThumbUrl || u.photoUrl
                        ? <Image source={{ uri: u.photoThumbUrl || u.photoUrl! }} style={s.userAvatarImg} cachePolicy="memory-disk" />
                        : <AppText style={s.userAvatarText}>{u.nickname[0]}</AppText>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={s.userName}>{u.nickname}</AppText>
                      <AppText style={s.userEmail}>{u.email}</AppText>
                    </View>
                    {!s2 ? (
                      <TouchableOpacity style={[s.reqBtn, {backgroundColor: colors.mint}]} onPress={() => handleRequest(u.uid)}>
                        <AppText style={[s.reqBtnText, {color: colors.primary}]}>요청하기</AppText>
                      </TouchableOpacity>
                    ) : s2.status === 'pending' ? (
                      <View style={[s.reqBtn, { borderColor: colors.textMuted }]}>
                        <AppText style={[s.reqBtnText, { color: colors.textMuted }]}>요청중</AppText>
                      </View>
                    ) : (
                      <View style={[s.reqBtn, { borderColor: colors.primary }]}>
                        <AppText style={[s.reqBtnText, { color: colors.primary }]}>친구</AppText>
                      </View>
                    )}
                  </View>
                )
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

function makeStyles(colors: ReturnType<typeof import('../../src/theme/colors').getThemeColors>) {
  return StyleSheet.create({
    logo: { fontSize: 24, fontWeight: '800', color: colors.primary },
    addBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    filterContainer: {
      height: 52,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
      justifyContent: 'center',
    },
    filterRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 12, gap: 8,
    },
    filterChip: {
      paddingHorizontal: 14,
      height: 32,
      borderRadius: 16, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.bg,
      justifyContent: 'center', alignItems: 'center',
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterChipText: { fontSize: 14, color: colors.text, fontWeight: '600', lineHeight: 18 },
    filterChipTextActive: { color: '#fff' },
    list: { padding: 16, gap: 12 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60, gap: 20 },
    emptyText: { color: colors.textMuted, fontSize: 17, textAlign: 'center', paddingHorizontal: 32 },
    findFriendBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.primary, borderRadius: 24,
      paddingHorizontal: 22, paddingVertical: 12,
    },
    findFriendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    closeBtnText: { fontSize: 18, color: colors.textMuted },
    searchRow: { flexDirection: 'row', gap: 8 },
    searchInput: {
      flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
      borderRadius: 20, paddingHorizontal: 12, height: 36,
      textAlignVertical: 'center', paddingVertical: 6,
      fontSize: 15, color: colors.text, fontFamily: 'GmarketSansMedium', includeFontPadding: false,
    },
    searchBtn: { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center' },
    searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    noResult: { textAlign: 'center', color: colors.textMuted, fontSize: 15, padding: 24 },
    userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    userAvatarImg: { width: 40, height: 40, borderRadius: 20 },
    userAvatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },
    userName: { fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 19 },
    userEmail: { fontSize: 14, color: colors.textMuted, paddingTop:5, lineHeight: 18 },
    reqBtn: { borderColor: colors.primary, borderWidth: 1, borderRadius: 15, paddingHorizontal: 12, height: 30, justifyContent: 'center', alignItems: 'center' },
    reqBtnText: { color: colors.primary, fontSize: 14, fontWeight: '500' },

    tutorialCardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 24,
    },
  })
}
