import { useState, useEffect, useRef } from 'react'
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, Pressable, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import AppText from './AppText'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { getComments, getCommentCount, addComment, deleteComment } from '../services/commentService'
import type { Comment } from '../services/commentService'
import { getUserProfile } from '../services/authService'
import { getMyFriends } from '../services/friendService'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import { makeCommonStyles } from '../theme/commonStyles'
import { isBirthday } from '../utils/formatDate'

interface CommentWithNick extends Comment {
  nickname: string
  photoUrl?: string | null
  photoThumbUrl?: string | null
  isBirthday: boolean
}

interface FriendSummary {
  uid: string
  nickname: string
  photoUrl?: string | null
  photoThumbUrl?: string | null
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
  onProfilePress: (uid: string, nickname: string, photoThumb?: string | null) => void
}

export default function CommentSection({ postId, postUid, currentUserUid, onProfilePress }: Props) {
  const { colors } = useTheme()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<CommentWithNick[]>([])
  const [commentCount, setCommentCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [friends, setFriends] = useState<FriendSummary[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const inputRef = useRef<TextInput>(null)

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
        isBirthday: isBirthday(profiles[i]?.privateBirthdate ? undefined : profiles[i]?.birthdate),
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
        photoThumbUrl: profiles[i]?.photoThumbUrl,
      })))
    } catch {}
  }

  function handleProfilePress(uid: string, nickname: string, photoThumb?: string | null) {
    setOpen(false)
    setInput('')
    setMentionQuery(null)
    setTimeout(() => onProfilePress(uid, nickname, photoThumb), 350)
  }

  function handleInputChange(text: string) {
    setInput(text)
    const match = text.match(/@([^\s@]*)$/)
    setMentionQuery(match ? match[1] : null)
  }

  function handleMentionSelect(nickname: string) {
    const newText = input.replace(/@([^\s@]*)$/, `@${nickname} `)
    setInput(newText)
    setMentionQuery(null)
    inputRef.current?.focus()
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
    const doDelete = async () => {
      try {
        await deleteComment(commentId)
        setComments(prev => prev.filter(c => c.id !== commentId))
        setCommentCount(prev => Math.max(0, prev - 1))
      } catch {
        showToast('댓글 삭제에 실패했어요', 'error')
      }
    }
    if (Platform.OS === 'web') {
      if (window.confirm('이 댓글을 삭제할까요?')) await doDelete()
      return
    }
    Alert.alert('댓글 삭제', '이 댓글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: doDelete },
    ])
  }

  const s = makeStyles(colors)
  const cs = makeCommonStyles(colors)

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

  return (
    <View>
      <TouchableOpacity style={s.toggleBtn} onPress={() => setOpen(true)}>
        <AppText style={s.toggleText}>
          💬 댓글{commentCount > 0 ? ` ${commentCount}개` : '없음😭'}
        </AppText>
        <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => { setOpen(false); setInput('') }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={cs.sheetOverlay} onPress={() => { setOpen(false); setInput('') }}>
            <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
              <View style={s.sheetHeader}>
                <AppText style={cs.sheetTitle}>댓글 {commentCount > 0 ? commentCount : ''}</AppText>
                <TouchableOpacity onPress={() => { setOpen(false); setInput('') }} style={cs.headerIconBtn}>
                  <AppText style={s.closeText}>✕</AppText>
                </TouchableOpacity>
              </View>

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
                      <View style={{ position: 'relative' }}>
                        <TouchableOpacity
                          onPress={() => handleProfilePress(c.uid, c.nickname, c.photoThumbUrl ?? c.photoUrl)}
                          style={[s.avatar, c.isBirthday && s.birthdayAvatar]}
                        >
                          {(c.photoThumbUrl || c.photoUrl) ? (
                            <Image source={{ uri: c.photoThumbUrl || c.photoUrl! }} style={s.avatarImg} cachePolicy="memory-disk" />
                          ) : (
                            <AppText style={s.avatarText}>{c.nickname[0]}</AppText>
                          )}
                        </TouchableOpacity>
                        {c.isBirthday && <AppText style={s.birthdayBadge}>🎂</AppText>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={s.commentHeader}>
                          <TouchableOpacity onPress={() => handleProfilePress(c.uid, c.nickname, c.photoThumbUrl ?? c.photoUrl)}>
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

              {mentionQuery !== null && (() => {
                const suggestions = friends.filter(f =>
                  f.nickname.toLowerCase().startsWith(mentionQuery.toLowerCase())
                )
                if (suggestions.length === 0) return null
                return (
                  <ScrollView
                    style={s.mentionList}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {suggestions.map(f => (
                      <TouchableOpacity
                        key={f.uid}
                        style={s.mentionItem}
                        onPress={() => handleMentionSelect(f.nickname)}
                      >
                        <View style={s.mentionAvatar}>
                          {(f.photoThumbUrl || f.photoUrl)
                            ? <Image source={{ uri: f.photoThumbUrl || f.photoUrl! }} style={s.mentionAvatarImg} cachePolicy="memory-disk" />
                            : <AppText style={s.mentionAvatarText}>{f.nickname[0]}</AppText>}
                        </View>
                        <AppText style={s.mentionNick}>@{f.nickname}</AppText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )
              })()}

              <View style={s.inputRow}>
                <TextInput
                  ref={inputRef}
                  style={s.input}
                  value={input}
                  onChangeText={handleInputChange}
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
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingTop: 16, maxHeight: '75%', paddingBottom: 25,
    },
    sheetHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingBottom: 8,
      borderBottomWidth: 0.5, borderBottomColor: colors.border,
    },
    closeText: { fontSize: 18, color: colors.textMuted },
    commentList: { paddingHorizontal: 16, paddingTop: 10, maxHeight: 340 },
    emptyText: { fontSize: 16, color: colors.textMuted, textAlign: 'center', paddingVertical: 24, marginBottom: 8 },
    commentItem: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12 },
    avatar: {
      width: 40, height: 40, borderRadius: 25,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center', alignItems: 'center', flexShrink: 0, overflow: 'hidden',
    },
    birthdayAvatar: { borderWidth: 2, borderColor: '#F59E0B' },
    birthdayBadge: { position: 'absolute', bottom: -4, right: -4, fontSize: 14 },
    avatarImg: { width: 40, height: 40 },
    avatarText: { fontSize: 15, fontWeight: '700', color: colors.primary },
    commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    commentNick: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 18 },
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
      textAlignVertical: 'center', includeFontPadding: false,
    },
    sendBtn: {
      backgroundColor: colors.primary, borderRadius: 20,
      paddingHorizontal: 14, justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.45 },
    sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    mentionList: {
      maxHeight: 160,
      borderTopWidth: 1, borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    mentionItem: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    mentionAvatar: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    },
    mentionAvatarImg: { width: 32, height: 32 },
    mentionAvatarText: { fontSize: 13, fontWeight: '700', color: colors.primary },
    mentionNick: { fontSize: 14, fontWeight: '600', color: colors.primary },
  })
}
