import { db } from './firebase'
import {
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'

export type ReactionType = 'heart' | 'funny' | 'sad' | 'surprised' | 'cheer'

export const REACTION_LIST: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'heart',     emoji: '❤️',  label: '좋아요'  },
  { type: 'funny',     emoji: '😄',  label: '재밌어요' },
  { type: 'sad',       emoji: '😢',  label: '슬퍼요'  },
  { type: 'surprised', emoji: '😮',  label: '놀라워요' },
  { type: 'cheer',     emoji: '👏',  label: '축하해요' },
]

export type ReactionMap = Record<ReactionType, string[]>

const EMPTY_MAP = (): ReactionMap => ({
  heart: [], funny: [], sad: [], surprised: [], cheer: [],
})

/** 게시글의 모든 공감 조회 — { type → uid[] } */
export async function getReactions(postId: string): Promise<ReactionMap> {
  const snap = await getDocs(collection(db, 'posts', postId, 'reactions'))
  const result = EMPTY_MAP()
  snap.forEach(d => {
    const type = d.data().type as ReactionType
    if (type in result) result[type].push(d.id) // document ID = uid
  })
  return result
}

/** 공감 설정 — type=null이면 내 공감 삭제 */
export async function setReaction(
  postId: string,
  uid: string,
  type: ReactionType | null,
  postOwnerUid?: string,
): Promise<void> {
  const ref = doc(db, 'posts', postId, 'reactions', uid)

  if (type === null) {
    await deleteDoc(ref)
    return
  }

  const existing = await getDoc(ref)
  const isNew = !existing.exists()

  const batch = writeBatch(db)
  batch.set(ref, { type, createdAt: serverTimestamp() })

  if (isNew && postOwnerUid && postOwnerUid !== uid) {
    const notifRef = doc(collection(db, 'notifications'))
    batch.set(notifRef, {
      toUid: postOwnerUid,
      fromUid: uid,
      type: 'reaction',
      postId,
      reactionType: type,
      read: false,
      createdAt: serverTimestamp(),
    })
  }

  await batch.commit()
}
