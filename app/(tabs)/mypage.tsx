import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Modal, Pressable, RefreshControl,
} from 'react-native'
import AppText from '../../src/components/AppText'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useAuth } from '../../src/context/AuthContext'
import { useTheme } from '../../src/context/ThemeContext'
import { useToast } from '../../src/context/ToastContext'
import {
  updateNickname, changePassword, isNicknameTaken, logOut, updateProfilePhoto, updateBio, updatePrivacySettings,
} from '../../src/services/authService'
import {
  getMyNotifications, acceptFriendRequest, rejectFriendRequest,
  removeFriend, markNotificationRead, markAllNotificationsRead,
  getFriendshipStatus, getMyFriends,
} from '../../src/services/friendService'
import { getMyPostCount, getWithMePostCount } from '../../src/services/postService'
import { getMyCommentCount } from '../../src/services/commentService'
import type { Notification, Friendship } from '../../src/services/friendService'
import { getUserProfile } from '../../src/services/authService'
import { uploadProfilePhoto } from '../../src/services/storageService'
import { isValidNickname, isValidPassword } from '../../src/utils/validation'
import { SkeletonNotifItem, SkeletonFriendRow } from '../../src/components/Skeleton'
import ProfileModal from '../../src/components/ProfileModal'
import { isBirthday, formatPhone } from '../../src/utils/formatDate'
import { Image } from 'expo-image'
import { makeCommonStyles } from '../../src/theme/commonStyles'

type Tab = 'profile' | 'notifications' | 'friends'

interface FriendWithProfile extends Friendship { nickname: string; email: string; photoUrl?: string | null; photoThumbUrl?: string | null; birthdate?: string | null }

function timeAgo(ts: unknown): string {
  if (!ts || typeof (ts as { toDate?: unknown }).toDate !== 'function') return ''
  const d = (ts as { toDate: () => Date }).toDate()
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

export default function MyPage() {
  const { user, profile, refreshProfile } = useAuth()
  const { colors } = useTheme()
  const { showToast } = useToast()
  const params = useLocalSearchParams<{ tab?: string }>()
  const [tab, setTab] = useState<Tab>((params.tab as Tab) || 'profile')
  const [unreadCount, setUnreadCount] = useState(0)

  // 한마디 & 활동
  const [bio, setBio] = useState('')
  const [editingBio, setEditingBio] = useState(false)
  const [bioSaving, setBioSaving] = useState(false)
  const [stats, setStats] = useState<{ postCount: number; commentCount: number; withMeCount: number } | null>(null)
  const bioBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 비공개 설정
  const [privateBirthdate, setPrivateBirthdate] = useState(false)
  const [privatePhone, setPrivatePhone] = useState(false)

  // 프로필
  const [newNick, setNewNick] = useState('')
  const [nickStatus, setNickStatus] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [nickChecking, setNickChecking] = useState(false)
  const [nickMsg, setNickMsg] = useState('')
  const [nickSaving, setNickSaving] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwErrors, setPwErrors] = useState<{ current?: string; next?: string; confirm?: string }>({})
  const [pwSaving, setPwSaving] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)

  // 알림
  const [notifs, setNotifs] = useState<(Notification & { fromNickname: string; fromPhotoThumb?: string | null })[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifRefreshing, setNotifRefreshing] = useState(false)
  const [friendRefreshing, setFriendRefreshing] = useState(false)
  const [pendingFriendshipIds, setPendingFriendshipIds] = useState<Set<string>>(new Set())

  // 친구
  const [friends, setFriends] = useState<FriendWithProfile[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)

  // 프로필 사진 확대
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [photoLoadError, setPhotoLoadError] = useState(false)

  // 친구 프로필 모달
  const [friendProfileTarget, setFriendProfileTarget] = useState<{ uid: string; nickname: string; photoThumb?: string | null } | null>(null)

  // 컨펌 모달
  const [friendToRemove, setFriendToRemove] = useState<FriendWithProfile | null>(null)
  const [removingFriend, setRemovingFriend] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  useEffect(() => {
    if (params.tab && ['profile', 'notifications', 'friends'].includes(params.tab)) {
      setTab(params.tab as Tab)
    }
  }, [params.tab])

  useEffect(() => {
    loadUnreadCount()
  }, [user])

  useEffect(() => {
    if (profile?.bio !== undefined) setBio(profile.bio ?? '')
    if (profile) {
      setPrivateBirthdate(profile.privateBirthdate ?? false)
      setPrivatePhone(profile.privatePhone ?? false)
    }
  }, [profile])

  useEffect(() => {
    if (tab === 'notifications') loadNotifications()
    if (tab === 'friends') loadFriends()
    if (tab === 'profile' && user) loadStats()
  }, [tab])

  async function loadStats() {
    if (!user) return
    try {
      const [postCount, commentCount, withMeCount] = await Promise.all([
        getMyPostCount(user.uid),
        getMyCommentCount(user.uid),
        getWithMePostCount(user.uid),
      ])
      setStats({ postCount, commentCount, withMeCount })
    } catch (e){
      console.error('loadStats error:', e)  // 추가
    }
  }

  async function togglePrivacy(field: 'privateBirthdate' | 'privatePhone') {
    if (!user) return
    const next = field === 'privateBirthdate' ? !privateBirthdate : !privatePhone
    if (field === 'privateBirthdate') setPrivateBirthdate(next)
    else setPrivatePhone(next)
    try {
      await updatePrivacySettings(user.uid, { [field]: next })
    } catch {
      if (field === 'privateBirthdate') setPrivateBirthdate(!next)
      else setPrivatePhone(!next)
      showToast('설정 변경에 실패했어요', 'error')
    }
  }

  async function handleBioSave() {
    if (!user) return
    if (bio === (profile?.bio ?? '')) { setEditingBio(false); return }
    setBioSaving(true)
    try {
      await updateBio(user.uid, bio)
      await refreshProfile()
      setEditingBio(false)
      showToast('한마디가 저장됐어요', 'success')
    } catch {
      showToast('저장에 실패했어요', 'error')
    } finally {
      setBioSaving(false)
    }
  }

  useFocusEffect(useCallback(() => {
    if (tab === 'notifications') loadNotifications()
    else loadUnreadCount()
  }, [tab, user]))

  async function loadUnreadCount() {
    if (!user) return
    try {
      const ns = await getMyNotifications(user.uid)
      setUnreadCount(ns.filter(n => !n.read).length)
    } catch {}
  }

  async function loadNotifications() {
    if (!user) return
    setNotifLoading(true)
    try {
      const ns = await getMyNotifications(user.uid)
      const profiles = await Promise.all(ns.map(n => getUserProfile(n.fromUid)))
      const mapped = ns.map((n, i) => ({
        ...n,
        fromNickname: profiles[i]?.nickname || '알 수 없음',
        fromPhotoThumb: profiles[i]?.photoThumbUrl || profiles[i]?.photoUrl || null,
      }))
      setNotifs(mapped)
      setUnreadCount(mapped.filter(n => !n.read).length)
      const friendReqs = ns.filter(n => n.type === 'friendRequest')
      const statuses = await Promise.all(friendReqs.map(n => getFriendshipStatus(n.fromUid, user.uid).catch(() => null)))
      const pendingIds = new Set(
        friendReqs.filter((_, i) => (statuses[i] as { status?: string } | null)?.status === 'pending').map(n => n.friendshipId ?? '')
      )
      setPendingFriendshipIds(pendingIds)
    } catch { showToast('알림을 불러오지 못했어요', 'error') }
    finally { setNotifLoading(false) }
  }

  async function loadFriends() {
    if (!user) return
    setFriendsLoading(true)
    try {
      const raw = await getMyFriends(user.uid)
      const profiles = await Promise.all(raw.map(f => getUserProfile(f.friendUid)))
      setFriends(raw.map((f, i) => ({ ...f, nickname: profiles[i]?.nickname || '알 수 없음', email: profiles[i]?.email || '', photoUrl: profiles[i]?.photoUrl, photoThumbUrl: profiles[i]?.photoThumbUrl, birthdate: profiles[i]?.privateBirthdate ? null : (profiles[i]?.birthdate ?? null) })))
    } catch { showToast('친구 목록을 불러오지 못했어요', 'error') }
    finally { setFriendsLoading(false) }
  }

  async function handleNickCheck() {
    const nick = newNick.trim()
    if (!isValidNickname(nick)) { setNickMsg('닉네임은 2~12자로 입력해 주세요'); setNickStatus('fail'); return }
    setNickChecking(true)
    try {
      const taken = await isNicknameTaken(nick, user!.uid)
      if (taken) { setNickStatus('fail'); setNickMsg('이미 사용 중인 닉네임이예요') }
      else { setNickStatus('ok'); setNickMsg('사용 가능한 닉네임이예요') }
    } catch { showToast('닉네임 확인 중 오류가 발생했어요', 'error') }
    finally { setNickChecking(false) }
  }

  async function handleNickSave() {
    if (nickStatus !== 'ok') { setNickMsg('닉네임 중복확인을 해주세요'); return }
    setNickSaving(true)
    try {
      await updateNickname(user!.uid, newNick.trim())
      showToast('닉네임이 변경됐어요', 'success')
      setNewNick(''); setNickStatus('idle'); setNickMsg('')
      refreshProfile()
    } catch (err) {
      setNickMsg((err as Error).message || '닉네임 변경에 실패했어요')
      setNickStatus('fail')
    } finally { setNickSaving(false) }
  }

  async function handlePwSave() {
    const errs: typeof pwErrors = {}
    if (!pwForm.current) errs.current = '현재 비밀번호를 입력해 주세요'
    if (!isValidPassword(pwForm.next)) errs.next = '영문+숫자 포함 8자 이상이어야 해요'
    if (pwForm.next !== pwForm.confirm) errs.confirm = '비밀번호가 일치하지 않아요'
    setPwErrors(errs)
    if (Object.keys(errs).length > 0) return
    setPwSaving(true)
    try {
      await changePassword(pwForm.current, pwForm.next)
      showToast('비밀번호가 변경됐어요', 'success')
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPwErrors(v => ({ ...v, current: '현재 비밀번호가 올바르지 않아요' }))
      } else {
        showToast((err as Error).message || '비밀번호 변경에 실패했어요', 'error')
      }
    } finally { setPwSaving(false) }
  }

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      showToast('사진 접근 권한이 필요해요. 설정에서 허용해 주세요', 'error')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
    if (result.canceled || !result.assets[0] || !user) return
    setPhotoUploading(true)
    try {
      const { url, thumbUrl } = await uploadProfilePhoto(result.assets[0].uri, user.uid)
      await updateProfilePhoto(user.uid, url, thumbUrl)
      await refreshProfile()
      setPhotoLoadError(false)
      showToast('프로필 사진이 변경됐어요', 'success')
    } catch (err) {
      showToast((err as Error).message || '사진 업로드에 실패했어요', 'error')
    } finally { setPhotoUploading(false) }
  }

  async function handleMarkAllRead() {
    if (!user) return
    await markAllNotificationsRead(user.uid).catch(() => {})
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  async function handleAccept(fid: string, fromUid: string) {
    try {
      await acceptFriendRequest(fid, fromUid)
      showToast('친구 요청을 수락했어요', 'success')
      setPendingFriendshipIds(prev => { const next = new Set(prev); next.delete(fid); return next })
    } catch { showToast('수락에 실패했어요', 'error') }
  }

  async function handleReject(fid: string) {
    try {
      await rejectFriendRequest(fid, user!.uid)
      showToast('친구 요청을 거절했어요')
      setPendingFriendshipIds(prev => { const next = new Set(prev); next.delete(fid); return next })
    } catch { showToast('거절에 실패했어요', 'error') }
  }

  function handleRemoveFriend(f: FriendWithProfile) {
    setFriendToRemove(f)
  }

  async function confirmRemoveFriend() {
    if (!friendToRemove) return
    setRemovingFriend(true)
    try {
      await removeFriend(user!.uid, friendToRemove.friendUid)
      showToast('친구가 삭제됐어요', 'success')
      setFriends(prev => prev.filter(fr => fr.friendUid !== friendToRemove.friendUid))
      setFriendToRemove(null)
    } catch {
      showToast('삭제에 실패했어요', 'error')
    } finally {
      setRemovingFriend(false)
    }
  }

  async function confirmLogout() {
    await logOut()
    router.replace('/(auth)/login')
  }

  const s = makeStyles(colors)
  const cs = makeCommonStyles(colors)
  const displayName = profile?.nickname || '사용자'

  return (
    <SafeAreaView style={cs.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={cs.header}>
        <AppText title style={s.logo}>내정보</AppText>
        <TouchableOpacity onPress={() => router.push('/settings')} style={s.settingsBtn}>
          <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* 프로필 요약 */}
      <View style={s.profileRow}>
        <TouchableOpacity onPress={handlePickPhoto} disabled={photoUploading}>
          <View style={s.avatar}>
            {photoUploading
              ? <ActivityIndicator color={colors.primary} />
              : (profile?.photoThumbUrl || profile?.photoUrl) && !photoLoadError
                ? <TouchableOpacity onPress={() => setShowPhotoModal(true)} activeOpacity={0.8}>
                    <Image
                      source={{ uri: profile!.photoThumbUrl || profile!.photoUrl! }}
                      style={s.avatarImg}
                      cachePolicy="memory-disk"
                      onError={() => setPhotoLoadError(true)}
                    />
                  </TouchableOpacity>
                : <AppText style={s.avatarText}>{displayName[0]}</AppText>}
            <View style={s.cameraBadge}><AppText style={{ fontSize: 16, lineHeight: 20 }}>📷</AppText></View>
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText style={s.displayName}>{displayName}</AppText>
          <AppText style={s.email}>{profile?.email || user?.email || ''}</AppText>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={() => setShowLogoutModal(true)}>
          <AppText style={s.logoutText}>로그아웃</AppText>
        </TouchableOpacity>
      </View>

      {/* 탭 */}
      <View style={cs.tabBar}>
        {(['profile', 'notifications', 'friends'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[cs.tabBtn, tab === t && cs.tabBtnActive]} onPress={() => setTab(t)}>
            <View style={s.tabBtnInner}>
              <AppText style={[cs.tabBtnText, tab === t && cs.tabBtnTextActive]}>
                {t === 'profile' ? '프로필' : t === 'notifications' ? '알림함' : '친구관리'}
              </AppText>
              {t === 'notifications' && unreadCount > 0 && (
                <View style={s.tabBadge}>
                  <AppText style={s.tabBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</AppText>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[s.body, (tab === 'notifications' || tab === 'friends') && { paddingTop: 8 }]}
        refreshControl={
          tab === 'notifications' ? (
            <RefreshControl
              refreshing={notifRefreshing}
              onRefresh={async () => { setNotifRefreshing(true); await loadNotifications(); setNotifRefreshing(false) }}
              tintColor={colors.primary}
            />
          ) : tab === 'friends' ? (
            <RefreshControl
              refreshing={friendRefreshing}
              onRefresh={async () => { setFriendRefreshing(true); await loadFriends(); setFriendRefreshing(false) }}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {/* ── 프로필 탭 ── */}
        {tab === 'profile' && (
          <View style={s.section}>
            {/* 기본 정보 */}
            <AppText style={cs.sectionTitle}>기본 정보</AppText>
            <View style={s.infoRow}>
              <AppText style={s.infoLabel}>이메일</AppText>
              <AppText style={s.infoValue}>{profile?.email || user?.email || '-'}</AppText>
            </View>
            <View style={s.infoRow}>
              <AppText style={s.infoLabel}>생년월일</AppText>
              <View style={s.infoValueRow}>
                <AppText style={[s.infoValue, privateBirthdate && { color: colors.gray400 }]}>
                  {privateBirthdate ? '비공개' : (profile?.birthdate?.replace(/-/g, '.') || '-')}
                </AppText>
                <TouchableOpacity onPress={() => togglePrivacy('privateBirthdate')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={privateBirthdate ? 'lock-closed' : 'lock-open-outline'} size={16} color={privateBirthdate ? colors.primary : colors.gray400} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={s.infoRow}>
              <AppText style={s.infoLabel}>연락처</AppText>
              <View style={s.infoValueRow}>
                <AppText style={[s.infoValue, privatePhone && { color: colors.gray400 }]}>
                  {privatePhone ? '비공개' : (formatPhone(profile?.phone) || '-')}
                </AppText>
                <TouchableOpacity onPress={() => togglePrivacy('privatePhone')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={privatePhone ? 'lock-closed' : 'lock-open-outline'} size={16} color={privatePhone ? colors.primary : colors.gray400} />
                </TouchableOpacity>
              </View>
            </View>
            
            {/* 나의 한마디 */}
            <AppText style={[cs.sectionTitle, { marginTop: 20 }]}>나의 한마디</AppText>
            <View style={s.bioRow}>
              {editingBio ? (
                <TextInput
                  style={s.bioInput}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="한 줄로 나를 소개해 보세요"
                  placeholderTextColor={colors.gray500}
                  maxLength={40}
                  autoFocus
                  onBlur={() => {
                    bioBlurTimer.current = setTimeout(() => { handleBioSave() }, 200)
                  }}
                />
              ) : (
                <AppText
                  style={[s.bioText, { color: bio ? colors.text : colors.gray500 }]}
                  numberOfLines={1}
                  onPress={() => setEditingBio(true)}
                >
                  {bio || '한 줄로 나를 소개해 보세요'}
                </AppText>
              )}
              {!editingBio && (
                <TouchableOpacity onPress={() => setEditingBio(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="pencil-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            {/* 나의 활동 */}
            <AppText style={[cs.sectionTitle, { marginTop: 20 }]}>나의 활동</AppText>
            <View style={s.statsRow}>
              {[
                { label: '모은 조각', value: stats?.postCount },
                { label: '남긴 댓글', value: stats?.commentCount },
                { label: '함께한 조각', value: stats?.withMeCount },
              ].map(item => (
                <View key={item.label} style={[s.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {item.value == null
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <AppText style={[s.statValue, { color: colors.primary }]}>{item.value}</AppText>}
                  <AppText style={[s.statLabel, { color: colors.textMuted }]}>{item.label}</AppText>
                </View>
              ))}
            </View>

            {/* 닉네임 변경 */}
            <AppText style={[cs.sectionTitle, { marginTop: 20 }]}>닉네임 변경</AppText>
            <View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[cs.input, nickMsg && cs.inputError, { flex: 1 }]}
                  placeholder="새 닉네임 (2~12자)"
                  placeholderTextColor={colors.gray500}
                  value={newNick}
                  onChangeText={v => { setNewNick(v); setNickStatus('idle'); setNickMsg('') }}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={[s.checkBtn, nickStatus === 'ok' && s.checkBtnOk]} onPress={handleNickCheck} disabled={nickChecking}>
                  {nickChecking ? <ActivityIndicator color={colors.primary} size="small" /> : <AppText style={s.checkBtnText}>{nickStatus === 'ok' ? '완료' : '중복확인'}</AppText>}
                </TouchableOpacity>
              </View>
              {nickMsg && <AppText style={[cs.errMsg, nickStatus === 'ok' && { color: '#16a34a' }]}>{nickMsg}</AppText>}
            </View>
            <TouchableOpacity style={[cs.btnPrimary, { paddingVertical: 13, marginTop: 4 }]} onPress={handleNickSave} disabled={nickSaving}>
              {nickSaving ? <ActivityIndicator color="#fff" size="small" /> : <AppText style={s.btnPrimaryText}>변경하기</AppText>}
            </TouchableOpacity>

            {/* 비밀번호 변경 */}
            <AppText style={[cs.sectionTitle, { marginTop: 20 }]}>비밀번호 변경</AppText>
            {([
              { key: 'current' as const, placeholder: '현재 비밀번호' },
              { key: 'next' as const, placeholder: '새 비밀번호 (영문+숫자 8자 이상)' },
              { key: 'confirm' as const, placeholder: '새 비밀번호 확인' },
            ]).map(f => (
              <View key={f.key}>
                <TextInput
                  style={[cs.input, pwErrors[f.key] && cs.inputError, { paddingHorizontal: 12, paddingVertical: 11 }]}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.gray500}
                  value={pwForm[f.key]}
                  onChangeText={v => { setPwForm(p => ({ ...p, [f.key]: v })); setPwErrors(e => ({ ...e, [f.key]: undefined })) }}
                  secureTextEntry
                />
                {pwErrors[f.key] && <AppText style={cs.errMsg}>{pwErrors[f.key]}</AppText>}
              </View>
            ))}
            <TouchableOpacity style={[cs.btnPrimary, { paddingVertical: 13, marginTop: 4 }]} onPress={handlePwSave} disabled={pwSaving}>
              {pwSaving ? <ActivityIndicator color="#fff" size="small" /> : <AppText style={s.btnPrimaryText}>변경하기</AppText>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── 알림 탭 ── */}
        {tab === 'notifications' && (
          <View style={s.section}>
            {notifLoading ? (
              <View style={{ gap: 0 }}>
                {Array.from({ length: 5 }).map((_, i) => <SkeletonNotifItem key={i} />)}
              </View>
            ) : notifs.length === 0 ? (
              <AppText style={s.emptyText}>등록된 알림이 없어요 💬</AppText>
            ) : (
              <>
                {unreadCount > 0 && (
                  <TouchableOpacity style={s.markAllBtn} onPress={handleMarkAllRead}>
                    <AppText style={s.markAllText}>전체 읽음</AppText>
                  </TouchableOpacity>
                )}
                {notifs.map(n => {
                  const ts = n.createdAt as { toDate?: () => Date } | null
                  const timeText = ts?.toDate ? timeAgo(ts) : ''
                  const body = n.type === 'friendRequest' ? `${n.fromNickname}님이 친구 요청을 보냈어요`
                    : n.type === 'friendAccepted' ? `${n.fromNickname}님이 친구 요청을 수락했어요`
                    : n.type === 'comment' ? `${n.fromNickname}님이 내 조각에 댓글을 달았어요`
                    : n.type === 'mention' ? `${n.fromNickname}님이 댓글에서 나를 언급했어요`
                    : n.type === 'with' ? `${n.fromNickname}님이 당신과 함께한 하루를 남겼어요`
                    : n.type === 'message' ? `${n.fromNickname}님이 '${n.message}' 메세지를 보냈어요`
                    : `${n.fromNickname}님이 내 조각에 공감을 남겼어요`
                  const hasPost = !!n.postId && (n.type === 'comment' || n.type === 'reaction' || n.type === 'mention' || n.type === 'with')
                  function handleNotifPress() {
                    if (!n.read) markNotificationRead(n.id)
                    if (n.type === 'with') {
                      router.push({ pathname: '/(tabs)/friends', params: { highlightPostId: n.postId } })
                    } else {
                      router.push({ pathname: '/(tabs)/main', params: { highlightPostId: n.postId } })
                    }
                  }
                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[s.notifItem]}
                      onPress={hasPost ? handleNotifPress : undefined}
                      activeOpacity={hasPost ? 0.7 : 1}
                    >
                      <View style={s.notifAvatar}>
                        {n.fromPhotoThumb
                          ? <Image source={{ uri: n.fromPhotoThumb }} style={s.notifAvatarImg} cachePolicy="memory-disk" />
                          : <AppText style={s.notifAvatarText}>{n.fromNickname[0]}</AppText>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText style={s.notifBody}>{body}</AppText>
                        <AppText style={s.notifTime}>{timeText}</AppText>
                      </View>
                      <View style={s.notifRight}>
                        {n.type === 'friendRequest' && n.friendshipId && pendingFriendshipIds.has(n.friendshipId) ? (
                          <View style={s.notifActions}>
                            <TouchableOpacity style={s.acceptBtn} onPress={() => handleAccept(n.friendshipId!, n.fromUid)}>
                              <AppText style={s.acceptBtnText}>수락</AppText>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.rejectBtn} onPress={() => handleReject(n.friendshipId!)}>
                              <AppText style={s.rejectBtnText}>거절</AppText>
                            </TouchableOpacity>
                          </View>
                        ) : n.type === 'friendRequest' && n.friendshipId && !pendingFriendshipIds.has(n.friendshipId) ? (
                          <View style={s.processedBadge}>
                            <AppText style={s.processedBadgeText}>처리완료</AppText>
                          </View>
                        ) : hasPost ? (
                          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                        ) : null}
                        {!n.read && <View style={s.unreadDot} />}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </>
            )}
          </View>
        )}

        {/* ── 친구관리 탭 ── */}
        {tab === 'friends' && (
          <View style={s.section}>
            {friendsLoading ? (
              <View style={{ gap: 0 }}>
                {Array.from({ length: 4 }).map((_, i) => <SkeletonFriendRow key={i} />)}
              </View>
            ) : friends.length === 0 ? (
              <View style={s.emptyFriendWrap}>
                <AppText style={s.emptyText}>등록된 친구가 없어요</AppText>
                <TouchableOpacity
                  style={s.findFriendBtn}
                  onPress={() => router.push({ pathname: '/(tabs)/friends', params: { openAdd: '1' } })}
                >
                  <Ionicons name="person-add-outline" size={16} color="#fff" />
                  <AppText style={s.findFriendBtnText}>친구를 찾아 볼까요?</AppText>
                </TouchableOpacity>
              </View>
            ) : (
              friends.map(f => (
                <View key={f.friendUid} style={s.friendRow}>
                  <View style={{ position: 'relative' }}>
                    <TouchableOpacity
                      style={[s.friendAvatar, isBirthday(f.birthdate) && s.birthdayAvatar]}
                      onPress={() => setFriendProfileTarget({ uid: f.friendUid, nickname: f.nickname, photoThumb: f.photoThumbUrl || f.photoUrl })}
                      activeOpacity={0.75}
                    >
                      {f.photoThumbUrl || f.photoUrl
                        ? <Image source={{ uri: f.photoThumbUrl || f.photoUrl! }} style={s.friendAvatarImg} cachePolicy="memory-disk" />
                        : <AppText style={s.friendAvatarText}>{f.nickname[0]}</AppText>}
                    </TouchableOpacity>
                    {isBirthday(f.birthdate) && <AppText style={s.birthdayBadge}>🎂</AppText>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={s.friendName}>{f.nickname}</AppText>
                    <AppText style={s.friendEmail}>{f.email}</AppText>
                  </View>
                  <TouchableOpacity style={s.removeBtn} onPress={() => handleRemoveFriend(f)}>
                    <AppText style={s.removeBtnText}>정리</AppText>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* 프로필 사진 확대 모달 */}
      <Modal visible={showPhotoModal} transparent animationType="fade" onRequestClose={() => setShowPhotoModal(false)}>
        <Pressable style={s.photoOverlay} onPress={() => setShowPhotoModal(false)}>
          {(profile?.photoUrl) && (
            <Image source={{ uri: profile.photoUrl }} style={s.photoLarge} contentFit="contain" cachePolicy="memory-disk" />
          )}
        </Pressable>
      </Modal>

      {/* 친구 프로필 모달 */}
      {user && (
        <ProfileModal
          visible={!!friendProfileTarget}
          uid={friendProfileTarget?.uid ?? ''}
          currentUserUid={user.uid}
          nickname={friendProfileTarget?.nickname ?? ''}
          photoThumb={friendProfileTarget?.photoThumb}
          onClose={() => setFriendProfileTarget(null)}
        />
      )}

      {/* 친구 정리 확인 모달 */}
      {friendToRemove && (
        <View style={cs.confirmOverlay}>
          <View style={cs.confirmModal}>
            <AppText style={cs.confirmTitle}><AppText style={s.confirmTitleStrong}>{friendToRemove.nickname}</AppText>님과 친구를 정리할까요?</AppText>
            <AppText style={cs.confirmDesc}>상대방에게도 동시에 적용되어{'\n'}더이상 친구의 조각을 볼 수 없어요😭</AppText>
            <View style={cs.confirmActions}>
              <TouchableOpacity style={cs.confirmCancelBtn} onPress={() => setFriendToRemove(null)}>
                <AppText style={cs.confirmCancelText}>취소</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={cs.confirmDangerBtn} onPress={confirmRemoveFriend} disabled={removingFriend}>
                {removingFriend
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <AppText style={cs.confirmDangerText}>정리하기</AppText>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* 로그아웃 확인 모달 */}
      {showLogoutModal && (
        <View style={cs.confirmOverlay}>
          <View style={cs.confirmModal}>
            <AppText style={cs.confirmTitle}>로그아웃 할까요?</AppText>
            <AppText style={cs.confirmDesc}>로그아웃하면 로그인 화면으로 이동해요 🙌</AppText>
            <View style={cs.confirmActions}>
              <TouchableOpacity style={cs.confirmCancelBtn} onPress={() => setShowLogoutModal(false)}>
                <AppText style={cs.confirmCancelText}>취소</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={cs.confirmDangerBtn} onPress={confirmLogout}>
                <AppText style={cs.confirmDangerText}>로그아웃</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

function makeStyles(colors: ReturnType<typeof import('../../src/theme/colors').getThemeColors>) {
  return StyleSheet.create({
    logo: { fontSize: 24, fontWeight: '800', color: colors.primary },
    settingsBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    profileRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', overflow: 'visible' },
    avatarImg: { width: 56, height: 56, borderRadius: 28 },
    avatarText: { fontSize: 22, fontWeight: '700', color: colors.primary },
    cameraBadge: { position: 'absolute', bottom: -4, right: -4, width: 26, height: 26, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
    displayName: { fontSize: 16, fontWeight: '700', color: colors.text, lineHeight: 20 },
    email: { fontSize: 14, color: colors.textMuted, marginTop: 8, lineHeight: 18 },
    logoutBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
    logoutText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
    tabBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    tabBadge: { backgroundColor: colors.primary, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    tabBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    body: { padding: 20, paddingBottom: 30 },
    section: { gap: 10 },
    bioRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, paddingHorizontal: 14, height: 46,
    },
    bioText: { flex: 1, fontSize: 14, lineHeight: 20 },
    bioInput: {
      flex: 1, alignSelf: 'stretch', fontSize: 14, color: colors.text,
      fontFamily: 'GmarketSansMedium',
      padding: 0, textAlignVertical: 'center', includeFontPadding: false,
    },
    statsRow: { flexDirection: 'row', gap: 12 },
    statCard: {
      flex: 1, alignItems: 'center', paddingVertical: 16,
      borderRadius: 12, borderWidth: 1, gap: 6,
    },
    statValue: { fontSize: 22, fontWeight: '700' },
    statLabel: { fontSize: 13 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    infoLabel: { fontSize: 15, color: colors.textMuted },
    infoValue: { fontSize: 14, fontWeight: '500', color: colors.text, lineHeight: 18 },
    infoValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center', minWidth: 72 },
    checkBtnOk: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
    checkBtnText: { fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'center' },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 17, paddingVertical: 32 },
    emptyFriendWrap: { alignItems: 'center', gap: 4 },
    findFriendBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.primary, borderRadius: 24,
      paddingHorizontal: 22, paddingVertical: 12, marginBottom: 16,
    },
    findFriendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    markAllBtn: { alignSelf: 'flex-end', marginBottom: 4, marginTop: 8, borderRadius: 6, borderColor: colors.gray400, borderWidth: 1, padding: 5, justifyContent: 'center' },
    markAllText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
    notifItem: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    notifAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', flexShrink: 0, overflow: 'hidden' },
    notifAvatarText: { fontSize: 15, fontWeight: '700', color: colors.primary },
    notifAvatarImg: { width: 36, height: 36, borderRadius: 18 },
    notifBody: { fontSize: 15, color: colors.text, lineHeight: 18 },
    notifTime: { fontSize: 13, color: colors.textMuted, marginTop: 5 },
    notifRight: { alignItems: 'flex-end', justifyContent: 'center', gap: 6, flexShrink: 0 },
    notifActions: { gap: 6 },
    acceptBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, alignItems: 'center' },
    acceptBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    rejectBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, alignItems: 'center' },
    rejectBtnText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
    processedBadge: { backgroundColor: colors.gray200, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    processedBadgeText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    friendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    friendAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    birthdayAvatar: { borderWidth: 2, borderColor: '#F59E0B' },
    birthdayBadge: { position: 'absolute', bottom: -4, right: -4, fontSize: 14 },
    friendAvatarImg: { width: 40, height: 40, borderRadius: 20 },
    friendAvatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },
    friendName: { fontSize: 15, fontWeight: '700', color: colors.text },
    friendEmail: { fontSize: 13, color: colors.textMuted, paddingTop: 5, lineHeight: 17 },
    removeBtn: { borderWidth: 1, borderColor: colors.danger, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    removeBtnText: { fontSize: 14, color: colors.danger, fontWeight: '600' },
    photoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
    photoLarge: { width: '90%', height: '70%' },
    confirmTitleStrong: { fontSize: 20, fontWeight: '700', color: colors.primaryDark },
  })
}
