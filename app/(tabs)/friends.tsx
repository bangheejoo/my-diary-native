import { useState, useEffect, useRef } from 'react'
import {
  View, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native'
import AppText from '../../src/components/AppText'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
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

interface FriendWithProfile extends Friendship {
  nickname: string
  photoUrl?: string | null
  photoThumbUrl?: string | null
}

type ViewMode = 'feed' | 'calendar'

export default function FriendsPage() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const { showToast } = useToast()

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

  const friendUids = friends.map(f => f.friendUid)
  const { openAdd } = useLocalSearchParams<{ openAdd?: string }>()

  useEffect(() => { loadFriends() }, [user])

  useEffect(() => {
    if (openAdd === '1') setShowAddModal(true)
  }, [openAdd])

  useEffect(() => {
    if (viewMode === 'feed') loadFeed()
    else loadCalendarDates()
  }, [viewMode, selectedUid, friends])

  async function loadFriends() {
    if (!user) return
    try {
      const raw = await getMyFriends(user.uid)
      const profiles = await Promise.all(raw.map(f => getUserProfile(f.friendUid)))
      setFriends(raw.map((f, i) => ({
        ...f,
        nickname: profiles[i]?.nickname || '알 수 없음',
        photoUrl: profiles[i]?.photoUrl,
        photoThumbUrl: profiles[i]?.photoThumbUrl,
      })))
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

  const renderPost = ({ item }: { item: Post }) => {
    const friend = friends.find(f => f.friendUid === item.uid)
    return (
      <PostCard
        post={item}
        currentUserUid={user?.uid}
        readOnly
        authorName={friend?.nickname || '알 수 없음'}
        authorThumb={friend?.photoThumbUrl || friend?.photoUrl}
      />
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={s.header}>
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
      <View style={s.tabBar}>
        {(['feed', 'calendar'] as ViewMode[]).map(mode => (
          <TouchableOpacity key={mode} style={[s.tabBtn, viewMode === mode && s.tabBtnActive]} onPress={() => setViewMode(mode)}>
            <AppText style={[s.tabBtnText, viewMode === mode && s.tabBtnTextActive]}>
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
              data={feedPosts}
              keyExtractor={p => p.id}
              contentContainerStyle={s.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFeed(true)} tintColor={colors.primary} />}
              ListEmptyComponent={<View style={s.center}><AppText style={s.emptyText}>친구의 조각이 없어요 😭</AppText></View>}
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

      {/* 친구 추가 모달 */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={s.modalOverlay} onPress={() => { setShowAddModal(false); setSearchQuery(''); setSearchResults([]); setSearched(false) }}>
          <Pressable style={s.addModal} onPress={e => e.stopPropagation()}>
            <View style={s.addModalHeader}>
              <AppText style={s.addModalTitle}>친구찾기</AppText>
              <TouchableOpacity
                style={s.closeBtn}
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
                        ? <Image source={{ uri: u.photoThumbUrl || u.photoUrl! }} style={s.userAvatarImg} />
                        : <AppText style={s.userAvatarText}>{u.nickname[0]}</AppText>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={s.userName}>{u.nickname}</AppText>
                      <AppText style={s.userEmail}>{u.email}</AppText>
                    </View>
                    {!s2 ? (
                      <TouchableOpacity style={s.reqBtn} onPress={() => handleRequest(u.uid)}>
                        <AppText style={s.reqBtnText}>요청</AppText>
                      </TouchableOpacity>
                    ) : s2.status === 'pending' ? (
                      <View style={[s.reqBtn, { backgroundColor: colors.gray200 }]}>
                        <AppText style={[s.reqBtnText, { color: colors.textMuted }]}>요청됨</AppText>
                      </View>
                    ) : (
                      <View style={[s.reqBtn, { backgroundColor: colors.mint }]}>
                        <AppText style={[s.reqBtnText, { color: colors.text }]}>친구</AppText>
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
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
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
    filterChipText: { fontSize: 14, color: colors.text, fontWeight: '600' },
    filterChipTextActive: { color: '#fff' },
    tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    tabBtn: { flex: 1, height: 44, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabBtnActive: { borderBottomColor: colors.primary },
    tabBtnText: { fontSize: 15, color: colors.textMuted, fontWeight: '600' },
    tabBtnTextActive: { color: colors.primary, fontWeight: '700' },
    list: { padding: 16, gap: 12 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60, gap: 20 },
    emptyText: { color: colors.textMuted, fontSize: 17, textAlign: 'center', paddingHorizontal: 32 },
    findFriendBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.primary, borderRadius: 24,
      paddingHorizontal: 22, paddingVertical: 12,
    },
    findFriendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    addModal: {
      backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 20, paddingBottom: 34, gap: 14,
    },
    addModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    addModalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: -8 },
    closeBtnText: { fontSize: 18, color: colors.textMuted },
    searchRow: { flexDirection: 'row', gap: 8 },
    searchInput: {
      flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
      borderRadius: 20, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.text,
      fontFamily: 'GmarketSansMedium',
    },
    searchBtn: { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center' },
    searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    noResult: { textAlign: 'center', color: colors.textMuted, fontSize: 15, padding: 24 },
    userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    userAvatarImg: { width: 40, height: 40, borderRadius: 20 },
    userAvatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },
    userName: { fontSize: 15, fontWeight: '700', color: colors.text },
    userEmail: { fontSize: 14, color: colors.textMuted, paddingTop:5 },
    reqBtn: { backgroundColor: colors.primary, borderRadius: 15, paddingHorizontal: 12, paddingVertical: 6 },
    reqBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  })
}
