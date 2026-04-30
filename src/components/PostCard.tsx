import { useState } from 'react'
import { View, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native'
import { Image } from 'expo-image'
import AppText from './AppText'
import LazyImage from './LazyImage'
import ProfileModal from './ProfileModal'
import type { Post } from '../services/postService'
import { Ionicons } from '@expo/vector-icons'
import { toKoreanDate, today, isBirthday, timeAgoFromDate } from '../utils/formatDate'
import { useTheme } from '../context/ThemeContext'
import ReactionBar from './ReactionBar'
import CommentSection from './CommentSection'

interface Props {
  post: Post
  currentUserUid?: string
  onEdit?: () => void
  readOnly?: boolean
  highlighted?: boolean
  authorName?: string
  authorThumb?: string | null
  authorBirthdate?: string | null
}

export default function PostCard({ post, currentUserUid, onEdit, readOnly = false, highlighted = false, authorName, authorThumb, authorBirthdate }: Props) {
  const { colors } = useTheme()
  const s = makeStyles(colors)

  const [profileTarget, setProfileTarget] = useState<{ uid: string; nickname: string; photoThumb?: string | null } | null>(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [authorThumbError, setAuthorThumbError] = useState(false)

  const badgeStyle = post.visibility === 'private' ? s.badgeGray
    : post.visibility === 'us' ? s.badgePink
    : s.badgeMint

  const badgeLabel = post.visibility === 'private' ? '나만보기'
    : post.visibility === 'us' ? '우리만보기'
    : '친구랑보기'

  const showInteraction = currentUserUid && (post.visibility !== 'private' || currentUserUid === post.uid)
  const isToday = post.recordDate === today()
  const isEditable = !readOnly && !!onEdit
  const cardStyle = [s.card, highlighted && s.cardHighlighted]

  const postTimeLabel = (() => {
    const created = (post.createdAt as { toDate?: () => Date })?.toDate?.()
    const updated = (post.updatedAt as { toDate?: () => Date })?.toDate?.()
    if (!created) return null
    const isEdited = updated && updated.getTime() - created.getTime() > 60_000
    return `${isEdited ? '수정됨' : '저장됨'} · ${timeAgoFromDate(isEdited ? updated! : created)}`
  })()

  const inner = (
    <>
      <View style={s.header}>
        {authorName ? (
          <TouchableOpacity
            style={s.authorRow}
            onPress={() => currentUserUid && setProfileTarget({ uid: post.uid, nickname: authorName, photoThumb: authorThumb })}
            activeOpacity={0.7}
          >
            <View style={{ position: 'relative' }}>
              <View style={[s.authorAvatar, isBirthday(authorBirthdate) && s.birthdayAvatar]}>
                {authorThumb && !authorThumbError
                  ? <Image source={{ uri: authorThumb }} style={s.authorAvatarImg} cachePolicy="memory-disk" onError={() => setAuthorThumbError(true)} />
                  : <AppText style={s.authorAvatarText}>{authorName[0]}</AppText>}
              </View>
              {isBirthday(authorBirthdate) && <AppText style={s.birthdayBadge}>🎂</AppText>}
            </View>
            <AppText style={s.authorName}>{authorName}</AppText>
          </TouchableOpacity>
        ) : (
          <View style={s.dateRow}>
            <AppText style={s.date}>{toKoreanDate(post.recordDate)}</AppText>
            {isToday && <View style={s.todayBadge}><AppText style={s.todayBadgeText}>오늘</AppText></View>}
          </View>
        )}
        <View style={[s.badge, badgeStyle]}>
          <AppText style={s.badgeText}>{badgeLabel}</AppText>
        </View>
      </View>

      {authorName && (
        <View style={s.dateRow}>
          <AppText style={s.date}>{toKoreanDate(post.recordDate)}</AppText>
          {isToday && <View style={s.todayBadge}><AppText style={s.todayBadgeText}>오늘</AppText></View>}
        </View>
      )}

      <AppText style={s.content}>{post.content}</AppText>

      {post.withNicknames && post.withNicknames.length > 0 && (
        <View style={s.withRow}>
          <Ionicons name="people-outline" size={13} color={colors.textMuted} />
          <AppText style={s.withText}>
            {post.withNicknames.map(n => `${n}님`).join(', ')}과 함께
          </AppText>
        </View>
      )}

      {post.imageUrl && (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => setShowImageModal(true)}
          onStartShouldSetResponder={() => true}
        >
          <LazyImage uri={post.imageUrl} style={s.image} />
        </TouchableOpacity>
      )}

      {postTimeLabel && (
        <AppText style={s.postTime}>{postTimeLabel}</AppText>
      )}

      {showInteraction && (
        <View style={s.interaction} onStartShouldSetResponder={() => true}>
          <ReactionBar postId={post.id} currentUserUid={currentUserUid} postOwnerUid={post.uid} />
          <CommentSection
            postId={post.id}
            postUid={post.uid}
            currentUserUid={currentUserUid}
            onProfilePress={(uid, nickname, photoThumb) =>
              setProfileTarget({ uid, nickname, photoThumb })
            }
          />
        </View>
      )}
    </>
  )

  return (
    <View>
      {isEditable ? (
        <TouchableOpacity style={cardStyle} onPress={onEdit} activeOpacity={0.8}>
          {inner}
        </TouchableOpacity>
      ) : (
        <View style={cardStyle}>
          {inner}
        </View>
      )}

      {post.imageUrl && (
        <Modal visible={showImageModal} transparent animationType="fade" onRequestClose={() => setShowImageModal(false)}>
          <Pressable style={s.imageOverlay} onPress={() => setShowImageModal(false)}>
            <Image
              source={{ uri: post.imageUrl }}
              style={s.imageFullscreen}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          </Pressable>
        </Modal>
      )}

      {currentUserUid && (
        <ProfileModal
          visible={!!profileTarget}
          uid={profileTarget?.uid ?? ''}
          currentUserUid={currentUserUid}
          nickname={profileTarget?.nickname ?? ''}
          photoThumb={profileTarget?.photoThumb}
          onClose={() => setProfileTarget(null)}
        />
      )}
    </View>
  )
}

function makeStyles(colors: ReturnType<typeof import('../theme/colors').getThemeColors>) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface, borderRadius: 16,
      padding: 18, borderWidth: 1, borderColor: colors.border, gap: 10,
    },
    cardHighlighted: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primaryLight2 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    authorAvatar: {
      width: 32, height: 32, borderRadius: 18,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    },
    birthdayAvatar: { borderWidth: 2, borderColor: '#F59E0B' },
    birthdayBadge: { position: 'absolute', bottom: -4, right: -4, fontSize: 12 },
    authorAvatarImg: { width: 32, height: 32 },
    authorAvatarText: { fontSize: 14, fontWeight: '700', color: colors.primary },
    authorName: { fontSize: 16, fontWeight: '700', color: colors.text, lineHeight: 20 },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    date: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
    todayBadge: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    todayBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
    badgeGray: { backgroundColor: colors.gray200 },
    badgePink: { backgroundColor: colors.primaryLight },
    badgeMint: { backgroundColor: colors.mint },
    badgeText: { fontSize: 13, fontWeight: '500', color: colors.badgeText },
    content: { fontSize: 15, color: colors.text, lineHeight: 28 },
    withRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    withText: { fontSize: 13, color: colors.textMuted, lineHeight: 17 },
    postTime: { fontSize: 12, color: colors.gray600, textAlign: 'right', marginRight: 7 },
    image: { width: '100%', aspectRatio: 1, borderRadius: 20 },
    imageOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
      justifyContent: 'center', alignItems: 'center',
    },
    imageFullscreen: { width: '100%', height: '100%' },
    interaction: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  })
}
