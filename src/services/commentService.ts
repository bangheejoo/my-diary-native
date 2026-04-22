import { db } from './firebase'
import {
  collection,
  doc,
  deleteDoc,
  getDocs,
  getDoc,
  getCountFromServer,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'

export interface Comment {
  id: string
  postId: string
  uid: string
  content: string
  createdAt?: unknown
}

export async function getCommentCount(postId: string): Promise<number> {
  const q = query(collection(db, 'comments'), where('postId', '==', postId))
  const snap = await getCountFromServer(q)
  return snap.data().count
}

export async function getComments(postId: string): Promise<Comment[]> {
  const q = query(
    collection(db, 'comments'),
    where('postId', '==', postId),
    orderBy('createdAt', 'asc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Comment)
}

export async function addComment(
  postId: string,
  uid: string,
  content: string,
  mentionedUids: string[] = [],
): Promise<string> {
  const postSnap = await getDoc(doc(db, 'posts', postId))
  const postOwnerUid = postSnap.exists() ? postSnap.data().uid as string : null

  const batch = writeBatch(db)
  const commentRef = doc(collection(db, 'comments'))
  batch.set(commentRef, {
    postId,
    uid,
    content,
    createdAt: serverTimestamp(),
  })

  // 게시글 작성자에게 댓글 알림 (본인 제외)
  if (postOwnerUid && postOwnerUid !== uid) {
    const notifRef = doc(collection(db, 'notifications'))
    batch.set(notifRef, {
      toUid: postOwnerUid,
      fromUid: uid,
      type: 'comment',
      postId,
      read: false,
      createdAt: serverTimestamp(),
    })
  }

  // 멘션된 사용자에게 알림 (본인·중복만 제외, 게시글 작성자도 @언급 시 알림 허용)
  const sentMentionUids = new Set<string>()
  for (const mentionedUid of mentionedUids) {
    if (mentionedUid === uid) continue              // 자기 자신 언급 제외
    if (sentMentionUids.has(mentionedUid)) continue // 동일인 중복 언급 제외
    sentMentionUids.add(mentionedUid)
    const notifRef = doc(collection(db, 'notifications'))
    batch.set(notifRef, {
      toUid: mentionedUid,
      fromUid: uid,
      type: 'mention',
      postId,
      read: false,
      createdAt: serverTimestamp(),
    })
  }

  await batch.commit()
  return commentRef.id
}

export async function deleteComment(commentId: string): Promise<void> {
  await deleteDoc(doc(db, 'comments', commentId))
}

export async function deleteCommentsByPost(postId: string): Promise<void> {
  const q = query(collection(db, 'comments'), where('postId', '==', postId))
  const snap = await getDocs(q)
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
}
