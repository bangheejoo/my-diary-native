import { useState, useEffect } from 'react'
import {
  View, TouchableOpacity, StyleSheet, Modal, Pressable,
  ActivityIndicator, Linking, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Image } from 'expo-image'
import AppText from './AppText'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import { getUserProfile } from '../services/authService'
import { getFriendshipStatus, sendFriendRequest, sendMessage } from '../services/friendService'
import { isBirthday, formatPhone } from '../utils/formatDate'

type Status = 'loading' | 'me' | { status: string; requesterId?: string } | null

interface Props {
  visible: boolean
  uid: string
  currentUserUid: string
  nickname: string
  photoThumb?: string | null
  onClose: () => void
}

export default function ProfileModal({ visible, uid, currentUserUid, nickname, photoThumb, onClose }: Props) {
  const { colors } = useTheme()
  const { showToast } = useToast()
  const s = makeStyles(colors)

  const [photoUrl, setPhotoUrl] = useState<string | null | undefined>(photoThumb)
  const [bio, setBio] = useState<string | undefined>()
  const [birthdate, setBirthdate] = useState<string | undefined>()
  const [phone, setPhone] = useState<string | undefined>()
  const [status, setStatus] = useState<Status>('loading')
  const [requesting, setRequesting] = useState(false)
  const [showLargePhoto, setShowLargePhoto] = useState(false)
  const [showMessage, setShowMessage] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [messageSending, setMessageSending] = useState(false)

  const isAccepted = typeof status === 'object' && status !== null &&
    (status as { status: string }).status === 'accepted'

  useEffect(() => {
    if (!visible || !uid) {
      setShowLargePhoto(false)
      return
    }
    setPhotoUrl(photoThumb ?? null)
    setBio(undefined)
    setBirthdate(undefined)
    setPhone(undefined)
    setShowLargePhoto(false)
    setShowMessage(false)
    setMessageText('')

    const isMe = uid === currentUserUid
    setStatus(isMe ? 'me' : 'loading')

    async function fetchData() {
      try {
        if (isMe) {
          const profile = await getUserProfile(uid)
          setPhotoUrl(profile?.photoUrl ?? photoThumb ?? null)
          setBio(profile?.bio)
          setBirthdate(profile?.privateBirthdate ? undefined : profile?.birthdate)
          setPhone(profile?.privatePhone ? undefined : profile?.phone)
        } else {
          const [friendStatus, profile] = await Promise.all([
            getFriendshipStatus(currentUserUid, uid),
            getUserProfile(uid),
          ])
          setStatus(friendStatus as Status)
          setPhotoUrl(profile?.photoUrl ?? photoThumb ?? null)
          setBio(profile?.bio)
          setBirthdate(profile?.privateBirthdate ? undefined : profile?.birthdate)
          setPhone(profile?.privatePhone ? undefined : profile?.phone)
        }
      } catch {
        if (uid !== currentUserUid) setStatus(null)
      }
    }

    fetchData()
  }, [visible, uid])

  async function handleRequest() {
    setRequesting(true)
    try {
      await sendFriendRequest(currentUserUid, uid)
      setStatus({ status: 'pending', requesterId: currentUserUid })
      showToast('친구 요청을 보냈어요', 'success')
    } catch (err) {
      showToast((err as Error).message || '요청에 실패했어요', 'error')
    } finally {
      setRequesting(false)
    }
  }

  function handleClose() {
    setShowLargePhoto(false)
    setShowMessage(false)
    setMessageText('')
    onClose()
  }

  async function handleSendMessage() {
    const text = messageText.trim()
    if (!text || messageSending) return
    setMessageSending(true)
    try {
      await sendMessage(currentUserUid, uid, text)
      showToast('메세지를 보냈어요', 'success')
      setMessageText('')
      setShowMessage(false)
    } catch {
      showToast('메세지 전송에 실패했어요', 'error')
    } finally {
      setMessageSending(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable style={s.overlay} onPress={handleClose}>
          <Pressable style={[s.card, { backgroundColor: colors.surface }]} onPress={e => e.stopPropagation()}>

            {/* 헤더: 메일 아이콘(좌) + 닫기(우) */}
            <View style={s.cardHeader}>
              {isAccepted ? (
                <TouchableOpacity
                  style={[s.headerIconBtn, { backgroundColor: showMessage ? colors.primaryLight : colors.primaryLight2 }]}
                  onPress={() => { setShowMessage(v => !v); setMessageText('') }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name={showMessage ? 'arrow-back' : 'mail-outline'} size={18} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <View style={s.headerIconBtn} />
              )}
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppText style={{ fontSize: 18, color: colors.textMuted }}>✕</AppText>
              </TouchableOpacity>
            </View>

            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                style={[s.avatar, { backgroundColor: colors.primaryLight }, isBirthday(birthdate) && s.birthdayAvatar]}
                activeOpacity={photoUrl ? 0.7 : 1}
                onPress={() => photoUrl && setShowLargePhoto(true)}
              >
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={s.avatarImg} cachePolicy="memory-disk" />
                ) : (
                  <AppText style={[s.avatarText, { color: colors.primary }]}>{nickname[0]}</AppText>
                )}
              </TouchableOpacity>
              {isBirthday(birthdate) && (
                <AppText style={s.birthdayBadgeLg}>🎂</AppText>
              )}
            </View>

            <AppText style={[s.nick, { color: colors.text }]}>{nickname}</AppText>

            {bio ? <AppText style={[s.bio, { color: colors.textMuted }]}>{bio}</AppText> : null}

            {(birthdate || phone) ? (
              <View style={[s.infoBox, { borderColor: colors.border }]}>
                {birthdate ? (
                  <View style={s.infoRow}>
                    <AppText style={[s.infoLabel, { color: colors.textMuted }]}>생년월일</AppText>
                    <AppText style={[s.infoValue, { color: colors.text }]}>{birthdate.replace(/-/g, '.')}</AppText>
                  </View>
                ) : null}
                {phone ? (
                  <View style={s.infoRow}>
                    <AppText style={[s.infoLabel, { color: colors.textMuted }]}>연락처</AppText>
                    <TouchableOpacity style={s.phoneRow} onPress={() => Linking.openURL(`tel:${phone}`)}>
                      <Ionicons name="call-outline" size={16} color={colors.primary} />
                      <AppText style={[s.infoValue, { color: colors.text }]}>{formatPhone(phone)}</AppText>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* 메세지 입력창 */}
            {showMessage && isAccepted && (
              <View style={[s.msgRow, { borderColor: colors.border, backgroundColor: colors.bg }]}>
                <TextInput
                  style={[s.msgInput, { color: colors.text }]}
                  value={messageText}
                  onChangeText={setMessageText}
                  placeholder="간단한 메세지를 보내요"
                  placeholderTextColor={colors.gray500}
                  maxLength={20}
                  autoFocus
                  returnKeyType="send"
                  onSubmitEditing={handleSendMessage}
                />
                <TouchableOpacity
                  style={[s.msgSendBtn, { backgroundColor: messageText.trim() ? colors.primary : colors.gray300 }]}
                  onPress={handleSendMessage}
                  disabled={messageSending || !messageText.trim()}
                >
                  {messageSending
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Ionicons name="send" size={14} color={colors.white} />}
                </TouchableOpacity>
              </View>
            )}

            {/* 친구 상태 배지 */}
            {status === 'me' ? (
              <TouchableOpacity
                style={[s.badge, { backgroundColor: colors.primaryLight2 }]}
                onPress={() => { handleClose(); router.push({ pathname: '/(tabs)/mypage', params: { tab: 'profile' } }) }}
                activeOpacity={0.75}
              >
                <AppText style={[s.badgeText, { color: colors.primary }]}>나예요</AppText>
              </TouchableOpacity>
            ) : status === 'loading' ? (
              <ActivityIndicator color={colors.primary} />
            ) : status === null ? (
              <TouchableOpacity style={[s.reqBtn, { backgroundColor: colors.primary }]} onPress={handleRequest} disabled={requesting}>
                {requesting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <AppText style={s.reqBtnText}>친구 요청 보내기</AppText>}
              </TouchableOpacity>
            ) : isAccepted ? (
              <TouchableOpacity
                style={[s.badge, { backgroundColor: colors.mint }]}
                onPress={() => { handleClose(); router.push({ pathname: '/(tabs)/mypage', params: { tab: 'friends' } }) }}
                activeOpacity={0.75}
              >
                <AppText style={[s.badgeText, { color: colors.badgeText }]}>이미 친구예요</AppText>
              </TouchableOpacity>
            ) : (status as { status: string; requesterId?: string }).requesterId === currentUserUid ? (
              <View style={[s.badge, { backgroundColor: colors.gray200 }]}>
                <AppText style={[s.badgeText, { color: colors.textMuted }]}>요청을 보냈어요</AppText>
              </View>
            ) : (
              <View style={[s.badge, { backgroundColor: colors.primaryLight }]}>
                <AppText style={[s.badgeText, { color: colors.badgeText }]}>나에게 요청을 보냈어요</AppText>
              </View>
            )}
          </Pressable>

          {showLargePhoto && photoUrl ? (
            <Pressable style={s.largeOverlay} onPress={() => setShowLargePhoto(false)}>
              <Image source={{ uri: photoUrl }} style={s.largeImg} contentFit="contain" cachePolicy="memory-disk" />
            </Pressable>
          ) : null}
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function makeStyles(colors: ReturnType<typeof import('../theme/colors').getThemeColors>) {
  return StyleSheet.create({
    overlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center', alignItems: 'center',
    },
    card: {
      borderRadius: 20, padding: 24, width: 280,
      alignItems: 'center', gap: 12,
    },
    cardHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      width: '100%', marginBottom: -4,
    },
    headerIconBtn: {
      width: 32, height: 32, borderRadius: 16,
      justifyContent: 'center', alignItems: 'center',
    },
    avatar: {
      width: 80, height: 80, borderRadius: 40,
      justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    },
    birthdayAvatar: { borderWidth: 3, borderColor: '#F59E0B' },
    birthdayBadgeLg: { position: 'absolute', bottom: -4, right: -4, fontSize: 20 },
    avatarImg: { width: 80, height: 80 },
    avatarText: { fontSize: 30, fontWeight: '700' },
    nick: { fontSize: 18, fontWeight: '700', lineHeight: 22 },
    bio: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
    infoBox: {
      width: '100%', gap: 8,
      borderTopWidth: 1, paddingTop: 10, marginTop: 2, marginBottom: 8,
    },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    infoLabel: { fontSize: 15 },
    infoValue: { fontSize: 15, fontWeight: '600' },
    phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    msgRow: {
      flexDirection: 'row', alignItems: 'center', width: '100%',
      borderWidth: 1, borderRadius: 10, overflow: 'hidden',
    },
    msgInput: {
      flex: 1, paddingHorizontal: 12, paddingVertical: 9,
      fontSize: 14, fontFamily: 'GmarketSansMedium',
    },
    msgSendBtn: { padding: 11 },
    badge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
    badgeText: { fontSize: 15, fontWeight: '600' },
    reqBtn: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 24, alignItems: 'center', width: '70%' },
    reqBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    largeOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.9)',
      justifyContent: 'center', alignItems: 'center',
    },
    largeImg: { width: '100%', height: '80%' },
  })
}
