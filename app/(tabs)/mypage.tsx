import { useState, useEffect, useCallback } from 'react'
import {
  View, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Image, Modal, Pressable, RefreshControl,
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
  updateNickname, changePassword, isNicknameTaken, logOut, updateProfilePhoto,
} from '../../src/services/authService'
import {
  getMyNotifications, acceptFriendRequest, rejectFriendRequest,
  removeFriend, markNotificationRead, markAllNotificationsRead,
  getFriendshipStatus, getMyFriends,
} from '../../src/services/friendService'
import type { Notification, Friendship } from '../../src/services/friendService'
import { getUserProfile } from '../../src/services/authService'
import { uploadProfilePhoto } from '../../src/services/storageService'
import { isValidNickname, isValidPassword } from '../../src/utils/validation'
import { SkeletonNotifItem, SkeletonFriendRow } from '../../src/components/Skeleton'

type Tab = 'profile' | 'notifications' | 'friends'

interface FriendWithProfile extends Friendship { nickname: string; email: string; photoUrl?: string | null; photoThumbUrl?: string | null }

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
  const [notifs, setNotifs] = useState<(Notification & { fromNickname: string })[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifRefreshing, setNotifRefreshing] = useState(false)
  const [friendRefreshing, setFriendRefreshing] = useState(false)
  const [pendingFriendshipIds, setPendingFriendshipIds] = useState<Set<string>>(new Set())

  // 친구
  const [friends, setFriends] = useState<FriendWithProfile[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)

  // 프로필 사진 확대
  const [showPhotoModal, setShowPhotoModal] = useState(false)

  // 친구 사진 확대
  const [friendPhotoUrl, setFriendPhotoUrl] = useState<string | null>(null)

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
    if (tab === 'notifications') loadNotifications()
    if (tab === 'friends') loadFriends()
  }, [tab])

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
      const mapped = ns.map((n, i) => ({ ...n, fromNickname: profiles[i]?.nickname || '알 수 없음' }))
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
      setFriends(raw.map((f, i) => ({ ...f, nickname: profiles[i]?.nickname || '알 수 없음', email: profiles[i]?.email || '', photoUrl: profiles[i]?.photoUrl, photoThumbUrl: profiles[i]?.photoThumbUrl })))
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
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
    if (result.canceled || !result.assets[0] || !user) return
    setPhotoUploading(true)
    try {
      const { url, thumbUrl } = await uploadProfilePhoto(result.assets[0].uri, user.uid)
      await updateProfilePhoto(user.uid, url, thumbUrl)
      await refreshProfile()
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
  const displayName = profile?.nickname || '사용자'

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={s.header}>
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
              : profile?.photoThumbUrl || profile?.photoUrl
                ? <TouchableOpacity onPress={() => setShowPhotoModal(true)} activeOpacity={0.8}><Image source={{ uri: profile.photoThumbUrl || profile.photoUrl! }} style={s.avatarImg} /></TouchableOpacity>
                : <AppText style={s.avatarText}>{displayName[0]}</AppText>}
            <View style={s.cameraBadge}><AppText style={{ fontSize: 10 }}>📷</AppText></View>
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
      <View style={s.tabBar}>
        {(['profile', 'notifications', 'friends'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <View style={s.tabBtnInner}>
              <AppText style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>
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
            <AppText style={s.sectionTitle}>기본 정보</AppText>
            {[
              { label: '이메일', value: profile?.email || user?.email || '-' },
              { label: '생년월일', value: profile?.birthdate?.replace(/-/g, '.') || '-' },
              { label: '휴대폰', value: profile?.phone || '-' },
            ].map(row => (
              <View key={row.label} style={s.infoRow}>
                <AppText style={s.infoLabel}>{row.label}</AppText>
                <AppText style={s.infoValue}>{row.value}</AppText>
              </View>
            ))}

            {/* 닉네임 변경 */}
            <AppText style={[s.sectionTitle, { marginTop: 20 }]}>닉네임 변경</AppText>
            <View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[s.input, nickMsg && s.inputError, { flex: 1 }]}
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
              {nickMsg && <AppText style={[s.errMsg, nickStatus === 'ok' && { color: '#16a34a' }]}>{nickMsg}</AppText>}
            </View>
            <TouchableOpacity style={s.btnPrimary} onPress={handleNickSave} disabled={nickSaving}>
              {nickSaving ? <ActivityIndicator color="#fff" size="small" /> : <AppText style={s.btnPrimaryText}>변경하기</AppText>}
            </TouchableOpacity>

            {/* 비밀번호 변경 */}
            <AppText style={[s.sectionTitle, { marginTop: 20 }]}>비밀번호 변경</AppText>
            {([
              { key: 'current' as const, placeholder: '현재 비밀번호' },
              { key: 'next' as const, placeholder: '새 비밀번호 (영문+숫자 8자 이상)' },
              { key: 'confirm' as const, placeholder: '새 비밀번호 확인' },
            ]).map(f => (
              <View key={f.key}>
                <TextInput
                  style={[s.input, pwErrors[f.key] && s.inputError]}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.gray500}
                  value={pwForm[f.key]}
                  onChangeText={v => { setPwForm(p => ({ ...p, [f.key]: v })); setPwErrors(e => ({ ...e, [f.key]: undefined })) }}
                  secureTextEntry
                />
                {pwErrors[f.key] && <AppText style={s.errMsg}>{pwErrors[f.key]}</AppText>}
              </View>
            ))}
            <TouchableOpacity style={s.btnPrimary} onPress={handlePwSave} disabled={pwSaving}>
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
                    : `${n.fromNickname}님이 내 조각에 공감을 남겼어요`
                  const hasPost = !!n.postId && (n.type === 'comment' || n.type === 'reaction' || n.type === 'mention')
                  function handleNotifPress() {
                    if (!n.read) markNotificationRead(n.id)
                    router.push({ pathname: '/(tabs)/main', params: { highlightPostId: n.postId } })
                  }
                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[s.notifItem]}
                      onPress={hasPost ? handleNotifPress : undefined}
                      activeOpacity={hasPost ? 0.7 : 1}
                    >
                      <View style={s.notifAvatar}>
                        <AppText style={s.notifAvatarText}>{n.fromNickname[0]}</AppText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText style={s.notifBody}>{body}</AppText>
                        <AppText style={s.notifTime}>{timeText}</AppText>
                        {n.type === 'friendRequest' && n.friendshipId && pendingFriendshipIds.has(n.friendshipId) && (
                          <View style={s.notifActions}>
                            <TouchableOpacity style={s.acceptBtn} onPress={() => handleAccept(n.friendshipId!, n.fromUid)}>
                              <AppText style={s.acceptBtnText}>수락</AppText>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.rejectBtn} onPress={() => handleReject(n.friendshipId!)}>
                              <AppText style={s.rejectBtnText}>거절</AppText>
                            </TouchableOpacity>
                          </View>
                        )}
                        {n.type === 'friendRequest' && n.friendshipId && !pendingFriendshipIds.has(n.friendshipId) && (
                          <AppText style={s.processedBadge}>처리 완료</AppText>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        {hasPost && <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
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
                  <TouchableOpacity
                    style={s.friendAvatar}
                    onPress={() => (f.photoUrl || f.photoThumbUrl) && setFriendPhotoUrl(f.photoUrl || f.photoThumbUrl!)}
                    activeOpacity={(f.photoUrl || f.photoThumbUrl) ? 0.75 : 1}
                  >
                    {f.photoThumbUrl || f.photoUrl
                      ? <Image source={{ uri: f.photoThumbUrl || f.photoUrl! }} style={s.friendAvatarImg} />
                      : <AppText style={s.friendAvatarText}>{f.nickname[0]}</AppText>}
                  </TouchableOpacity>
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
            <Image source={{ uri: profile.photoUrl }} style={s.photoLarge} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>

      {/* 친구 프로필 사진 확대 */}
      <Modal visible={!!friendPhotoUrl} transparent animationType="fade" onRequestClose={() => setFriendPhotoUrl(null)}>
        <Pressable style={s.photoOverlay} onPress={() => setFriendPhotoUrl(null)}>
          {friendPhotoUrl && <Image source={{ uri: friendPhotoUrl }} style={s.photoLarge} resizeMode="contain" />}
        </Pressable>
      </Modal>

      {/* 친구 정리 확인 모달 */}
      {friendToRemove && (
        <View style={s.confirmOverlay}>
          <View style={s.confirmModal}>
          <AppText style={s.confirmTitle}><AppText style={s.confirmTitleStrong}>{friendToRemove.nickname}</AppText>님과 친구를 정리할까요?</AppText>
            <AppText style={s.confirmDesc}>상대방에게도 동시에 적용되어{'\n'}더이상 친구의 조각을 볼 수 없어요😭</AppText>
            <View style={s.confirmActions}>
              <TouchableOpacity style={s.confirmCancelBtn} onPress={() => setFriendToRemove(null)}>
                <AppText style={s.confirmCancelText}>취소</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmDangerBtn} onPress={confirmRemoveFriend} disabled={removingFriend}>
                {removingFriend
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <AppText style={s.confirmDangerText}>정리하기</AppText>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* 로그아웃 확인 모달 */}
      {showLogoutModal && (
        <View style={s.confirmOverlay}>
          <View style={s.confirmModal}>
            <AppText style={s.confirmTitle}>로그아웃 할까요?</AppText>
            <AppText style={s.confirmDesc}>로그아웃하면 로그인 화면으로 이동해요 🙌</AppText>
            <View style={s.confirmActions}>
              <TouchableOpacity style={s.confirmCancelBtn} onPress={() => setShowLogoutModal(false)}>
                <AppText style={s.confirmCancelText}>취소</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmDangerBtn} onPress={confirmLogout}>
                <AppText style={s.confirmDangerText}>로그아웃</AppText>
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
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    logo: { fontSize: 24, fontWeight: '800', color: colors.primary },
    settingsBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    profileRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', overflow: 'visible' },
    avatarImg: { width: 56, height: 56, borderRadius: 28 },
    avatarText: { fontSize: 22, fontWeight: '700', color: colors.primary },
    cameraBadge: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
    displayName: { fontSize: 16, fontWeight: '700', color: colors.text },
    email: { fontSize: 14, color: colors.textMuted, marginTop: 8 },
    logoutBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
    logoutText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
    tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
    tabBtn: { flex: 1, height: 44, justifyContent: 'center', alignItems: 'center', paddingVertical: 11 },
    tabBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    tabBadge: { backgroundColor: colors.primary, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    tabBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    tabBtnActive: { borderBottomWidth: 2, borderBottomColor: colors.primary, fontWeight: '600' },
    tabBtnText: { fontSize: 15, color: colors.textMuted, fontWeight: '600' },
    tabBtnTextActive: { color: colors.primary, fontWeight: '700' },
    body: { padding: 20, paddingBottom: 30 },
    section: { gap: 10 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    infoLabel: { fontSize: 15, color: colors.textMuted },
    infoValue: { fontSize: 14, fontWeight: '500', color: colors.text },
    input: {
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: colors.text,
      fontFamily: 'GmarketSansMedium'
    },
    inputError: { borderColor: colors.danger },
    errMsg: { fontSize: 14, color: colors.danger, marginTop: 4 },
    checkBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center', minWidth: 72 },
    checkBtnOk: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
    checkBtnText: { fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'center' },
    btnPrimary: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 17, paddingVertical: 32 },
    emptyFriendWrap: { alignItems: 'center', gap: 4 },
    findFriendBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.primary, borderRadius: 24,
      paddingHorizontal: 22, paddingVertical: 12, marginBottom: 16,
    },
    findFriendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    markAllBtn: { alignSelf: 'flex-end', marginBottom: 4, marginTop: 8 },
    markAllText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
    notifItem: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    notifAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    notifAvatarText: { fontSize: 15, fontWeight: '700', color: colors.primary },
    notifBody: { fontSize: 15, color: colors.text, lineHeight: 18 },
    notifTime: { fontSize: 13, color: colors.textMuted, marginTop: 5 },
    notifActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
    acceptBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
    acceptBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    rejectBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
    rejectBtnText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
    processedBadge: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, alignSelf: 'flex-start', marginTop: 4 },
    friendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    friendAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    friendAvatarImg: { width: 40, height: 40, borderRadius: 20 },
    friendAvatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },
    friendName: { fontSize: 15, fontWeight: '700', color: colors.text },
    friendEmail: { fontSize: 13, color: colors.textMuted, paddingTop: 5 },
    removeBtn: { borderWidth: 1, borderColor: colors.danger, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    removeBtnText: { fontSize: 14, color: colors.danger, fontWeight: '600' },
    photoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
    photoLarge: { width: '90%', height: '70%' },
    confirmOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    confirmModal: { backgroundColor: colors.surface, borderRadius: 16, padding: 24, width: '88%', gap: 12 },
    confirmTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    confirmTitleStrong: { fontSize: 20, fontWeight: '700', color: colors.primaryDark },
    confirmDesc: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
    confirmActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    confirmCancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    confirmCancelText: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
    confirmDangerBtn: { flex: 1, backgroundColor: colors.danger, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    confirmDangerText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  })
}
