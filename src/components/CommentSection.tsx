import { useState, useEffect, useRef } from 'react'
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, Pressable, Image, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import AppText from './AppText'
import { Ionicons } from '@expo/vector-icons'
import { getComments, getCommentCount, addComment, deleteComment } from '../services/commentService'
import type { Comment } from '../services/commentService'
import { getUserProfile } from '../services/authService'
import { getMyFriends, getFriendshipStatus, sendFriendRequest } from '../services/friendService'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'

interface CommentWithNick extends Comment {
  nickname: string
  photoUrl?: string | null
  photoThumbUrl?: string | null
}

interface FriendSummary {
  uid: string
  nickname: string
  photoUrl?: string | null
}

function timeAgo(ts: unknown): string {
  if (!ts || typeof (ts as { toDate?: unknown }).toDate !== 'function') return ''
  const date = (ts as { toDate: () => Date }).toDate()
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

interface Props {
  postId: string
  postUid: string
  currentUserUid: string
}

type ModalStatus = { status: string; requesterId?: string } | null | 'loading' | 'me'

export default function CommentSection({ postId, postUid, currentUserUid }: Props) {
  const { colors } = useTheme()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<CommentWithNick[]>([])
  const [commentCount, setCommentCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [friends, setFriends] = useState<FriendSummary[]>([])
  const inputRef = useRef<TextInput>(null)

  const [userModal, setUserModal] = useState<{ uid: string; nickname: string; photoUrl?: string | null } | null>(null)
  const [modalStatus, setModalStatus] = useState<ModalStatus>('loading')
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    getCommentCount(postId).then(setCommentCount).catch(() => {})
  }, [postId])

  useEffect(() => {
    if (!open) return
    loadComments()
    loadFriends()
  }, [open])

  async function loadComments() {
    setLoading(true)
    try {
      const raw = await getComments(postId)
      const profiles = await Promise.all(raw.map(c => getUserProfile(c.uid)))
      setComments(raw.map((c, i) => ({
        ...c,
        nickname: profiles[i]?.nickname || '알 수 없음',
        photoUrl: profiles[i]?.photoUrl,
        photoThumbUrl: profiles[i]?.photoThumbUrl,
      })))
    } catch {
      showToast('댓글을 불러오지 못했어요', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadFriends() {
    try {
      const raw = await getMyFriends(currentUserUid)
      const profiles = await Promise.all(raw.map(f => getUserProfile(f.friendUid)))
      setFriends(raw.map((f, i) => ({
        uid: f.friendUid,
        nickname: profiles[i]?.nickname || '',
        photoUrl: profiles[i]?.photoUrl,
      })))
    } catch {}
  }

  async function handleSubmit() {
    const text = input.trim()
    if (!text) return
    setSubmitting(true)
    try {
      const mentionedUids = friends
        .filter(f => new RegExp(`@${f.nickname}(?:\\s|$)`).test(text))
        .map(f => f.uid)
      await addComment(postId, currentUserUid, text, mentionedUids)
      setInput('')
      await loadComments()
      setCommentCount(prev => prev + 1)
    } catch {
      showToast('댓글 남기기에 실패했어요', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(commentId: string) {
    Alert.alert('댓글 삭제', '이 댓글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(commentId)
            setComments(prev => prev.filter(c => c.id !== commentId))
            setCommentCount(prev => Math.max(0, prev - 1))
          } catch {
            showToast('댓글 삭제에 실패했어요', 'error')
          }
        },
      },
    ])
  }

  async function handleUserClick(uid: string, nickname: string, photoUrl?: string | null) {
    setUserModal({ uid, nickname, photoUrl })
    if (uid === currentUserUid) { setModalStatus('me'); return }
    setModalStatus('loading')
    try {
      const s = await getFriendshipStatus(currentUserUid, uid)
      setModalStatus(s as ModalStatus)
    } catch {
      setModalStatus(null)
    }
  }

  async function handleFriendRequest() {
    if (!userModal) return
    setRequesting(true)
    try {
      await sendFriendRequest(currentUserUid, userModal.uid)
      setModalStatus({ status: 'pending', requesterId: currentUserUid })
      showToast('친구 요청을 보냈어요', 'success')
    } catch (err) {
      showToast((err as Error).message || '요청에 실패했어요', 'error')
    } finally {
      setRequesting(false)
    }
  }

  const s = makeStyles(colors)

  const renderMentioned = (content: string) => {
    const parts = content.split(/(@[^\s@]+)/g)
    return (
      <AppText style={s.commentText}>
        {parts.map((part, i) =>
          /^@[^\s@]+$/.test(part)
            ? <AppText key={i} style={s.mention}>{part}</AppText>
            : <AppText key={i}>{part}</AppText>
        )}
      </AppText>
    )
  }

  function handleOpen() {
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
    setInput('')
  }

  return (
    <View>
      {/* 댓글 토글 버튼 */}
      <TouchableOpacity style={s.toggleBtn} onPress={handleOpen}>
        <AppText style={s.toggleText}>
          💬 댓글{commentCount > 0 ? ` ${commentCount}개` : '없음😭'}
        </AppText>
        <AppText style={s.chevron}> 〉</AppText>
      </TouchableOpacity>

      {/* 댓글 바텀시트 모달 */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable style={s.overlay} onPress={handleClose}>
            <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
              {/* 시트 헤더 */}
              <View style={s.sheetHeader}>
                <AppText style={s.sheetTitle}>댓글 {commentCount > 0 ? commentCount : ''}</AppText>
                <TouchableOpacity onPress={handleClose} style={s.iconBtn}>
                  <AppText style={s.closeText}>✕</AppText>
                </TouchableOpacity>
              </View>

              {/* 댓글 목록 */}
              <ScrollView
                style={s.commentList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {loading ? (
                  <ActivityIndicator color={colors.primary} size="small" style={{ padding: 24 }} />
                ) : comments.length === 0 ? (
                  <AppText style={s.emptyText}>첫 댓글을 남겨보세요 💬</AppText>
                ) : (
                  comments.map(c => (
                    <View key={c.id} style={s.commentItem}>
                      <TouchableOpacity
                        onPress={() => handleUserClick(c.uid, c.nickname, c.photoUrl)}
                        style={s.avatar}
                      >
                        {(c.photoThumbUrl || c.photoUrl) ? (
                          <Image source={{ uri: c.photoThumbUrl || c.photoUrl! }} style={s.avatarImg} />
                        ) : (
                          <AppText style={s.avatarText}>{c.nickname[0]}</AppText>
                        )}
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <View style={s.commentHeader}>
                          <TouchableOpacity onPress={() => handleUserClick(c.uid, c.nickname, c.photoUrl)}>
                            <AppText style={s.commentNick}>{c.nickname}</AppText>
                          </TouchableOpacity>
                          <AppText style={s.commentTime}>{timeAgo(c.createdAt)}</AppText>
                          {(c.uid === currentUserUid || postUid === currentUserUid) && (
                            <TouchableOpacity onPress={() => handleDelete(c.id)} style={s.deleteBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                              <Ionicons name="trash-outline" size={14} color={colors.gray400} />
                            </TouchableOpacity>
                          )}
                        </View>
                        {renderMentioned(c.content)}
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>

              {/* 댓글 입력 */}
              <View style={s.inputRow}>
                <TextInput
                  ref={inputRef}
                  style={s.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder="댓글을 입력해 주세요"
                  placeholderTextColor={colors.gray500}
                  maxLength={100}
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity
                  style={[s.sendBtn, (!input.trim() || submitting) && s.sendBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={!input.trim() || submitting}
                >
                  {submitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <AppText style={s.sendBtnText}>남기기</AppText>}
                </TouchableOpacity>
              </View>

            </Pressable>
          </Pressable>

          {/* 프로필 팝업 — KAV 직하위 absolute, sheet 밖 */}
          {userModal && (
            <Pressable style={s.profileOverlay} onPress={() => setUserModal(null)}>
              <Pressable style={s.profileCard} onPress={e => e.stopPropagation()}>
                <TouchableOpacity style={[s.iconBtn, s.profileCloseBtn]} onPress={() => setUserModal(null)}>
                  <AppText style={s.closeText}>✕</AppText>
                </TouchableOpacity>
                <View style={s.modalAvatar}>
                  {userModal.photoUrl ? (
                    <Image source={{ uri: userModal.photoUrl }} style={s.modalAvatarImg} />
                  ) : (
                    <AppText style={s.modalAvatarText}>{userModal.nickname[0]}</AppText>
                  )}
                </View>
                <AppText style={s.modalNick}>{userModal.nickname}</AppText>

                {modalStatus === 'me' ? (
                  <View style={[s.statusBadge, { backgroundColor: colors.primaryLight2 }]}>
                    <AppText style={[s.statusBadgeText, { color: colors.primary }]}>나예요</AppText>
                  </View>
                ) : modalStatus === 'loading' ? (
                  <ActivityIndicator color={colors.primary} />
                ) : modalStatus === null ? (
                  <TouchableOpacity style={s.requestBtn} onPress={handleFriendRequest} disabled={requesting}>
                    {requesting
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <AppText style={s.requestBtnText}>친구 요청 보내기</AppText>}
                  </TouchableOpacity>
                ) : (modalStatus as { status: string }).status === 'accepted' ? (
                  <View style={[s.statusBadge, { backgroundColor: colors.mint }]}>
                    <AppText style={s.statusBadgeText}>이미 친구예요</AppText>
                  </View>
                ) : (modalStatus as { status: string; requesterId?: string }).requesterId === currentUserUid ? (
                  <View style={[s.statusBadge, { backgroundColor: colors.gray200 }]}>
                    <AppText style={s.statusBadgeText}>요청을 보냈어요</AppText>
                  </View>
                ) : (
                  <View style={[s.statusBadge, { backgroundColor: colors.primaryLight }]}>
                    <AppText style={s.statusBadgeText}>나에게 요청을 보냈어요</AppText>
                  </View>
                )}
              </Pressable>
            </Pressable>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

function makeStyles(colors: ReturnType<typeof import('../theme/colors').getThemeColors>) {
  return StyleSheet.create({
    toggleBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border,
    },
    toggleText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
    chevron: { fontSize: 18, color: colors.textMuted },
    // 바텀시트
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingTop: 16, maxHeight: '75%', paddingBottom: 25
    },
    sheetHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingBottom: 8,
      borderBottomWidth: 0.5, borderBottomColor: colors.border,
    },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    iconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    closeText: { fontSize: 18, color: colors.textMuted },
    commentList: { paddingHorizontal: 16, paddingTop: 10, maxHeight: 340 },
    emptyText: { fontSize: 16, color: colors.textMuted, textAlign: 'center', paddingVertical: 24, marginBottom: 8 },
    commentItem: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12 },
    avatar: {
      width: 40, height: 40, borderRadius: 25,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center', alignItems: 'center', flexShrink: 0, overflow: 'hidden',
    },
    avatarImg: { width: 40, height: 40 },
    avatarText: { fontSize: 15, fontWeight: '700', color: colors.primary },
    commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    commentNick: { fontSize: 14, fontWeight: '700', color: colors.text },
    commentTime: { fontSize: 14, color: colors.gray500 },
    deleteBtn: { marginLeft: 'auto', marginRight: 18 },
    commentText: { fontSize: 15, color: colors.text, lineHeight: 25 },
    mention: { color: colors.primary, fontWeight: '600' },
    inputRow: {
      flexDirection: 'row', gap: 8,
      paddingHorizontal: 16, paddingVertical: 16,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    input: {
      flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
      borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
      fontSize: 15, color: colors.text, fontFamily: 'GmarketSansMedium',
    },
    sendBtn: {
      backgroundColor: colors.primary, borderRadius: 20,
      paddingHorizontal: 14, justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.45 },
    sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    // 프로필 팝업 (KAV 안 absolute — 전체 화면)
    profileOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center', alignItems: 'center',
    },
    profileCard: {
      backgroundColor: colors.surface, borderRadius: 16,
      padding: 24, width: 280, alignItems: 'center', gap: 12,
    },
    profileCloseBtn: { alignSelf: 'flex-end', marginRight: -10, marginTop: -10 },
    modalAvatar: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    },
    modalAvatarImg: { width: 72, height: 72 },
    modalAvatarText: { fontSize: 28, fontWeight: '700', color: colors.primary },
    modalNick: { fontSize: 18, fontWeight: '700', color: colors.text },
    requestBtn: {
      backgroundColor: colors.primary, borderRadius: 10,
      paddingVertical: 11, paddingHorizontal: 24, alignItems: 'center', width: '100%',
    },
    requestBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    statusBadge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
    statusBadgeText: { fontSize: 15, fontWeight: '600', color: colors.text },
  })
}
