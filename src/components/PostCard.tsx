import { View, Image, TouchableOpacity, StyleSheet } from 'react-native'
import AppText from './AppText'
import LazyImage from './LazyImage'
import type { Post } from '../services/postService'
import { toKoreanDate } from '../utils/formatDate'
import { useTheme } from '../context/ThemeContext'
import ReactionBar from './ReactionBar'
import CommentSection from './CommentSection'

interface Props {
  post: Post
  currentUserUid?: string
  onEdit?: () => void
  readOnly?: boolean
  highlighted?: boolean
  // 친구 피드용 작성자 표시
  authorName?: string
  authorThumb?: string | null
}

export default function PostCard({ post, currentUserUid, onEdit, readOnly = false, highlighted = false, authorName, authorThumb }: Props) {
  const { colors } = useTheme()
  const s = makeStyles(colors)

  const badgeStyle = post.visibility === 'private' ? s.badgeGray
    : post.visibility === 'us' ? s.badgePink
    : s.badgeMint

  const badgeLabel = post.visibility === 'private' ? '나만보기'
    : post.visibility === 'us' ? '우리만보기'
    : '친구랑보기'

  const showInteraction = currentUserUid && (post.visibility !== 'private' || currentUserUid === post.uid)

  return (
    <TouchableOpacity
      style={[s.card, highlighted && s.cardHighlighted]}
      onPress={!readOnly && onEdit ? onEdit : undefined}
      activeOpacity={readOnly || !onEdit ? 1 : 0.8}
    >
      <View style={s.header}>
        {/* 친구 피드에서 작성자 표시 */}
        {authorName ? (
          <View style={s.authorRow}>
            <View style={s.authorAvatar}>
              {authorThumb
                ? <Image source={{ uri: authorThumb }} style={s.authorAvatarImg} />
                : <AppText style={s.authorAvatarText}>{authorName[0]}</AppText>}
            </View>
            <AppText style={s.authorName}>{authorName}</AppText>
          </View>
        ) : (
          <AppText style={s.date}>{toKoreanDate(post.recordDate)}</AppText>
        )}
        <View style={[s.badge, badgeStyle]}>
          <AppText style={s.badgeText}>{badgeLabel}</AppText>
        </View>
      </View>

      {/* 친구 피드에서 날짜 별도 표시 */}
      {authorName && (
        <AppText style={s.date}>{toKoreanDate(post.recordDate)}</AppText>
      )}

      <AppText style={s.content}>{post.content}</AppText>

      {post.imageUrl && (
        <LazyImage uri={post.imageUrl} style={s.image} />
      )}

      {/* 공감 + 댓글 */}
      {showInteraction && (
        <View style={s.interaction} onStartShouldSetResponder={() => true}>
          <ReactionBar postId={post.id} currentUserUid={currentUserUid} postOwnerUid={post.uid} />
          <CommentSection postId={post.id} postUid={post.uid} currentUserUid={currentUserUid} />
        </View>
      )}
    </TouchableOpacity>
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
    authorAvatarImg: { width: 32, height: 32 },
    authorAvatarText: { fontSize: 14, fontWeight: '700', color: colors.primary },
    authorName: { fontSize: 16, fontWeight: '700', color: colors.text },
    date: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
    badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
    badgeGray: { backgroundColor: colors.gray200 },
    badgePink: { backgroundColor: colors.primaryLight },
    badgeMint: { backgroundColor: colors.mint },
    badgeText: { fontSize: 13, fontWeight: '500', color: colors.text },
    content: { fontSize: 15, color: colors.text, lineHeight: 28 },
    image: { width: '100%', aspectRatio: 1, borderRadius: 20 },
    interaction: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  })
}
