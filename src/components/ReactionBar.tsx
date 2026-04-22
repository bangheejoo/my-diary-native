import { useState, useEffect } from 'react'
import { View, TouchableOpacity, StyleSheet, Modal, Pressable, Image } from 'react-native'
import AppText from './AppText'
import { getReactions, setReaction, REACTION_LIST } from '../services/reactionService'
import type { ReactionType, ReactionMap } from '../services/reactionService'
import { getUserProfile } from '../services/authService'
import { useTheme } from '../context/ThemeContext'

interface Props {
  postId: string
  currentUserUid: string
  postOwnerUid: string
}

export default function ReactionBar({ postId, currentUserUid, postOwnerUid }: Props) {
  const { colors } = useTheme()
  const [reactions, setReactions] = useState<ReactionMap>({ heart: [], funny: [], sad: [], surprised: [], cheer: [] })
  const [showPicker, setShowPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [viewingReaction, setViewingReaction] = useState<ReactionType | null>(null)
  const [reactionUsers, setReactionUsers] = useState<{ uid: string; nickname: string; photoThumbUrl?: string | null }[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  const myReaction = REACTION_LIST.find(r => reactions[r.type].includes(currentUserUid))?.type ?? null

  useEffect(() => {
    getReactions(postId).then(setReactions).catch(() => {})
  }, [postId])

  async function handleReact(type: ReactionType) {
    if (loading) return
    setLoading(true)
    const isSame = myReaction === type
    const next = isSame ? null : type

    // 낙관적 업데이트
    setReactions(prev => {
      const updated = { ...prev }
      if (myReaction) updated[myReaction] = updated[myReaction].filter(u => u !== currentUserUid)
      if (next) updated[next] = [...updated[next], currentUserUid]
      return updated
    })
    setShowPicker(false)

    try {
      await setReaction(postId, currentUserUid, next, postOwnerUid)
    } catch {
      // 실패 시 원래 상태 복원
      getReactions(postId).then(setReactions).catch(() => {})
    } finally {
      setLoading(false)
    }
  }

  async function handleViewReaction(type: ReactionType) {
    const uids = reactions[type]
    if (uids.length === 0) return
    setViewingReaction(type)
    setLoadingUsers(true)
    try {
      const profiles = await Promise.all(uids.map(uid => getUserProfile(uid)))
      setReactionUsers(uids.map((uid, i) => ({ uid, nickname: profiles[i]?.nickname ?? '알 수 없음', photoThumbUrl: profiles[i]?.photoThumbUrl ?? profiles[i]?.photoUrl })))
    } catch {
      setReactionUsers(uids.map(uid => ({ uid, nickname: '알 수 없음' })))
    } finally {
      setLoadingUsers(false)
    }
  }

  const s = makeStyles(colors)

  return (
    <View style={s.container}>
      <View style={s.row}>
        {/* 현재 공감 현황 */}
        <View style={s.summary}>
          {REACTION_LIST.filter(r => reactions[r.type].length > 0).map(r => (
            <TouchableOpacity
              key={r.type}
              style={[s.reactionChip, myReaction === r.type && s.reactionChipActive]}
              onPress={() => handleViewReaction(r.type)}
              activeOpacity={0.7}
            >
              <AppText style={s.reactionEmoji}>{r.emoji}</AppText>
              <AppText style={[s.reactionCount, myReaction === r.type && s.reactionCountActive]}>
                {reactions[r.type].length}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>

        {/* 공감 버튼 */}
        <TouchableOpacity style={[s.reactBtn, myReaction && s.reactBtnActive]} onPress={() => setShowPicker(true)}>
          <AppText style={[s.reactBtnText, myReaction && s.reactBtnTextActive]}>
            {myReaction ? `${REACTION_LIST.find(r => r.type === myReaction)?.emoji}` : '공감 +'}
          </AppText>
        </TouchableOpacity>
      </View>

      {/* 이모지 선택 모달 */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <Pressable style={s.overlay} onPress={() => setShowPicker(false)}>
          <Pressable style={s.picker} onPress={e => e.stopPropagation()}>
            <AppText style={s.pickerTitle}>친구에게 공감을 보내요</AppText>
            <View style={s.emojiRow}>
              {REACTION_LIST.map(r => (
                <TouchableOpacity
                  key={r.type}
                  style={[s.emojiBtn, myReaction === r.type && s.emojiBtnActive]}
                  onPress={() => handleReact(r.type)}
                >
                  <AppText style={s.emojiIcon}>{r.emoji}</AppText>
                  <AppText style={[s.emojiLabel, myReaction === r.type && s.emojiLabelActive]}>{r.label}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 공감한 사람 목록 모달 */}
      <Modal visible={!!viewingReaction} transparent animationType="fade" onRequestClose={() => setViewingReaction(null)}>
        <Pressable style={s.overlay} onPress={() => setViewingReaction(null)}>
          <Pressable style={s.userListModal} onPress={e => e.stopPropagation()}>
            {viewingReaction && (
              <>
                <AppText style={s.userListTitle}>
                  {REACTION_LIST.find(r => r.type === viewingReaction)?.emoji}{'  '}
                  {REACTION_LIST.find(r => r.type === viewingReaction)?.label}
                </AppText>
                {loadingUsers ? (
                  <View style={s.userListLoading}>
                    <AppText style={s.userListLoadingText}>불러오는 중...</AppText>
                  </View>
                ) : (
                  reactionUsers.map(u => (
                    <View key={u.uid} style={s.userRow}>
                      <View style={s.userAvatar}>
                        {u.photoThumbUrl
                          ? <Image source={{ uri: u.photoThumbUrl }} style={s.userAvatarImg} />
                          : <AppText style={s.userAvatarText}>{u.nickname[0]}</AppText>}
                      </View>
                      <AppText style={s.userNickname}>{u.nickname}</AppText>
                      {u.uid === currentUserUid && (
                        <AppText style={s.userMeBadge}>나</AppText>
                      )}
                    </View>
                  ))
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

function makeStyles(colors: ReturnType<typeof import('../theme/colors').getThemeColors>) {
  return StyleSheet.create({
    container: {},
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
    reactionChip: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: colors.gray100, borderRadius: 20,
      paddingHorizontal: 8, paddingVertical: 3,
      borderWidth: 1, borderColor: colors.border,
    },
    reactionChipActive: { backgroundColor: colors.primaryLight2, borderColor: colors.primary },
    reactionEmoji: { fontSize: 15 },
    reactionCount: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
    reactionCountActive: { color: colors.primary },
    reactBtn: {
      paddingHorizontal: 12, paddingVertical: 5, flexShrink: 0,
      borderRadius: 20, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    reactBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight2 },
    reactBtnText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
    reactBtnTextActive: { color: colors.primary, fontSize: 16 },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
    picker: {
      backgroundColor: colors.surface, borderRadius: 16,
      padding: 20, width: 350, gap: 14,
    },
    pickerTitle: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
    emojiRow: { flexDirection: 'row', justifyContent: 'space-around' },
    emojiBtn: {
      alignItems: 'center', gap: 4, padding: 8, borderRadius: 10,
      borderWidth: 1.5, borderColor: 'transparent',
    },
    emojiBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight2 },
    emojiIcon: { fontSize: 26 },
    emojiLabel: { fontSize: 12, color: colors.textMuted },
    emojiLabelActive: { color: colors.primary },
    userListModal: {
      backgroundColor: colors.surface, borderRadius: 16,
      padding: 20, width: 280, gap: 10, maxHeight: 360,
    },
    userListTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
    userListLoading: { alignItems: 'center', paddingVertical: 12 },
    userListLoadingText: { fontSize: 14, color: colors.textMuted },
    userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    userAvatar: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center',
      overflow: 'hidden',
    },
    userAvatarImg: { width: 32, height: 32 },
    userAvatarText: { fontSize: 15, fontWeight: '700', color: colors.primary },
    userNickname: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600' },
    userMeBadge: { fontSize: 14, color: colors.mintDark, fontWeight: '700', backgroundColor: colors.mint, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 12 },
  })
}
