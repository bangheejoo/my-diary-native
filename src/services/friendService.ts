import { auth, db } from './firebase'
import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'

export interface Friendship {
  friendshipId: string
  friendUid: string
  users: string[]
  status: 'pending' | 'accepted'
  requesterId: string
  receiverId: string
}

export interface Notification {
  id: string
  toUid: string
  fromUid: string
  type: 'friendRequest' | 'friendAccepted' | 'comment' | 'reaction' | 'mention'
  friendshipId?: string
  postId?: string
  reactionType?: string
  read: boolean
  createdAt?: unknown
}

function makeFriendshipId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_')
}

export async function sendFriendRequest(fromUid: string, toUid: string) {
  const fid = makeFriendshipId(fromUid, toUid)

  const existingSnap = await getDoc(doc(db, 'friendships', fid))
  if (existingSnap.exists()) {
    const status = existingSnap.data().status
    if (status === 'accepted') throw new Error('이미 친구예요')
    if (status === 'pending') throw new Error('이미 친구 요청을 보냈어요')
  }

  const batch = writeBatch(db)
  batch.set(doc(db, 'friendships', fid), {
    users: [fromUid, toUid].sort(),
    status: 'pending',
    requesterId: fromUid,
    receiverId: toUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  const notifRef = doc(collection(db, 'notifications'))
  batch.set(notifRef, {
    toUid,
    fromUid,
    type: 'friendRequest',
    friendshipId: fid,
    read: false,
    createdAt: serverTimestamp(),
  })

  await batch.commit()
}

export async function acceptFriendRequest(friendshipId_: string, fromUid: string) {
  const currentUid = auth.currentUser?.uid
  if (!currentUid) throw new Error('로그인이 필요해요')

  const batch = writeBatch(db)
  batch.update(doc(db, 'friendships', friendshipId_), {
    status: 'accepted',
    updatedAt: serverTimestamp(),
  })

  const notifRef = doc(collection(db, 'notifications'))
  batch.set(notifRef, {
    toUid: fromUid,
    fromUid: currentUid,
    type: 'friendAccepted',
    friendshipId: friendshipId_,
    read: false,
    createdAt: serverTimestamp(),
  })

  const notifsQ = query(
    collection(db, 'notifications'),
    where('friendshipId', '==', friendshipId_),
    where('type', '==', 'friendRequest'),
    where('toUid', '==', currentUid)
  )
  const notifSnap = await getDocs(notifsQ)
  notifSnap.docs.forEach(d => batch.update(d.ref, { read: true }))

  await batch.commit()
}

export async function rejectFriendRequest(friendshipId_: string, currentUid: string) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'friendships', friendshipId_))

  const notifsQ = query(
    collection(db, 'notifications'),
    where('friendshipId', '==', friendshipId_),
    where('toUid', '==', currentUid)
  )
  const notifSnap = await getDocs(notifsQ)
  notifSnap.docs.forEach(d => batch.update(d.ref, { read: true }))

  await batch.commit()
}

export async function removeFriend(uid1: string, uid2: string) {
  const fid = makeFriendshipId(uid1, uid2)
  await deleteDoc(doc(db, 'friendships', fid))
}

export async function getMyFriends(uid: string): Promise<Friendship[]> {
  const q = query(
    collection(db, 'friendships'),
    where('users', 'array-contains', uid),
    where('status', '==', 'accepted')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data()
    const friendUid = data.users.find((u: string) => u !== uid)
    return { friendshipId: d.id, friendUid, ...data } as Friendship
  })
}

export async function getMyNotifications(uid: string): Promise<Notification[]> {
  const q = query(collection(db, 'notifications'), where('toUid', '==', uid))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }) as Notification)
    .sort((a, b) => {
      const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0
      const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0
      return tb - ta
    })
}

export async function markNotificationRead(notifId: string) {
  await updateDoc(doc(db, 'notifications', notifId), { read: true })
}

export async function markAllNotificationsRead(uid: string) {
  const q = query(
    collection(db, 'notifications'),
    where('toUid', '==', uid),
    where('read', '==', false)
  )
  const snap = await getDocs(q)
  if (snap.empty) return
  const batch = writeBatch(db)
  snap.docs.forEach(d => batch.update(d.ref, { read: true }))
  await batch.commit()
}

export async function getFriendshipStatus(uid1: string, uid2: string) {
  const fid = makeFriendshipId(uid1, uid2)
  const snap = await getDoc(doc(db, 'friendships', fid))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}
