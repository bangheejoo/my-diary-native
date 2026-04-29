import { auth, db, storage } from './firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  collection,
  where,
  getDocs,
  limit,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { ref, deleteObject } from 'firebase/storage'

export interface NotifSettings {
  all: boolean
  friendRequest: boolean
  commentReaction: boolean
  mention: boolean
}

export const DEFAULT_NOTIF_SETTINGS: NotifSettings = {
  all: true,
  friendRequest: true,
  commentReaction: true,
  mention: true,
}

export interface UserProfile {
  uid: string
  email: string
  nickname: string
  phone: string
  birthdate: string
  bio?: string
  privateBirthdate?: boolean
  privatePhone?: boolean
  photoUrl?: string | null
  photoThumbUrl?: string | null
  notifSettings?: NotifSettings
}

export async function isNicknameTaken(nickname: string, excludeUid: string | null = null): Promise<boolean> {
  const snap = await getDoc(doc(db, 'nicknames', nickname))
  if (!snap.exists()) return false
  if (excludeUid && snap.data().uid === excludeUid) return false
  return true
}

export async function signUp({
  email,
  password,
  nickname,
  phone,
  birthdate,
}: {
  email: string
  password: string
  nickname: string
  phone: string
  birthdate: string
}) {
  const nickExists = await isNicknameTaken(nickname)
  if (nickExists) throw new Error('이미 사용 중인 닉네임이예요')

  const cred = await createUserWithEmailAndPassword(auth, email, password)
  const uid = cred.user.uid

  const batch = writeBatch(db)
  batch.set(doc(db, 'users', uid), {
    email,
    nickname,
    phone,
    birthdate,
    notifSettings: DEFAULT_NOTIF_SETTINGS,
    createdAt: serverTimestamp(),
  })
  batch.set(doc(db, 'nicknames', nickname), { uid })
  await batch.commit()

  return cred.user
}

export async function logIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

export async function logOut() {
  const uid = auth.currentUser?.uid
  if (uid) {
    await updateDoc(doc(db, 'users', uid), { expoPushToken: null }).catch(() => {})
  }
  await signOut(auth)
}

export async function sendPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email)
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return { uid, ...snap.data() } as UserProfile
}

export async function updateNickname(uid: string, newNickname: string) {
  const taken = await isNicknameTaken(newNickname, uid)
  if (taken) throw new Error('이미 사용 중인 닉네임이예요')

  const userSnap = await getDoc(doc(db, 'users', uid))
  const oldNickname = userSnap.data()?.nickname

  const batch = writeBatch(db)
  if (oldNickname) batch.delete(doc(db, 'nicknames', oldNickname))
  batch.set(doc(db, 'nicknames', newNickname), { uid })
  batch.update(doc(db, 'users', uid), { nickname: newNickname })
  await batch.commit()
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const user = auth.currentUser
  if (!user || !user.email) throw new Error('로그인이 필요해요')
  const cred = EmailAuthProvider.credential(user.email, currentPassword)
  await reauthenticateWithCredential(user, cred)
  await updatePassword(user, newPassword)
}

export async function updateNotifSettings(uid: string, settings: NotifSettings): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { notifSettings: settings })
}

export async function updateProfilePhoto(uid: string, photoUrl: string, photoThumbUrl?: string) {
  await updateDoc(doc(db, 'users', uid), { photoUrl, ...(photoThumbUrl ? { photoThumbUrl } : {}) })
}

export async function updateBio(uid: string, bio: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { bio: bio.trim() })
}

export async function updatePrivacySettings(uid: string, settings: { privateBirthdate?: boolean; privatePhone?: boolean }): Promise<void> {
  await updateDoc(doc(db, 'users', uid), settings)
}

async function safeDeleteStorageObject(path: string) {
  try { await deleteObject(ref(storage, path)) } catch { /* 없으면 무시 */ }
}

export async function deleteAccount(password: string): Promise<void> {
  const user = auth.currentUser
  if (!user || !user.email) throw new Error('로그인이 필요해요')

  // 1. 재인증 (Firebase 보안 정책)
  const cred = EmailAuthProvider.credential(user.email, password)
  await reauthenticateWithCredential(user, cred)

  const uid = user.uid

  // 2. 닉네임 조회 (nicknames 컬렉션 삭제용)
  const userSnap = await getDoc(doc(db, 'users', uid))
  const nickname = userSnap.exists() ? (userSnap.data().nickname as string) : null

  // 3. 프로필 사진 Storage 삭제
  await Promise.all([
    safeDeleteStorageObject(`profiles/${uid}/avatar`),
    safeDeleteStorageObject(`profiles/${uid}/avatar_thumb`),
  ])

  // 4. 내 게시글 전체 삭제 (이미지 + 댓글 + 공감 서브컬렉션 포함)
  const postsSnap = await getDocs(query(collection(db, 'posts'), where('uid', '==', uid)))
  await Promise.all(postsSnap.docs.map(async postDoc => {
    const data = postDoc.data()
    if (data.imageStoragePath) await safeDeleteStorageObject(data.imageStoragePath)
    // 댓글 삭제
    const commentsQ = query(collection(db, 'comments'), where('postId', '==', postDoc.id))
    const commentsSnap = await getDocs(commentsQ)
    await Promise.all(commentsSnap.docs.map(d => deleteDoc(d.ref)))
    // 공감 서브컬렉션 삭제
    const reactionsSnap = await getDocs(collection(db, 'posts', postDoc.id, 'reactions'))
    await Promise.all(reactionsSnap.docs.map(d => deleteDoc(d.ref)))
    await deleteDoc(postDoc.ref)
  }))

  // 5. 다른 게시글에 달린 내 댓글 삭제
  const myCommentsSnap = await getDocs(query(collection(db, 'comments'), where('uid', '==', uid)))
  await Promise.all(myCommentsSnap.docs.map(d => deleteDoc(d.ref)))

  // 6. 친구 관계 삭제 (양방향)
  const friendshipsSnap = await getDocs(query(collection(db, 'friendships'), where('users', 'array-contains', uid)))
  await Promise.all(friendshipsSnap.docs.map(d => deleteDoc(d.ref)))

  // 7. 알림 삭제 (수신 + 발신)
  const [notifsTo, notifsFrom] = await Promise.all([
    getDocs(query(collection(db, 'notifications'), where('toUid', '==', uid))),
    getDocs(query(collection(db, 'notifications'), where('fromUid', '==', uid))),
  ])
  await Promise.all([
    ...notifsTo.docs.map(d => deleteDoc(d.ref)),
    ...notifsFrom.docs.map(d => deleteDoc(d.ref)),
  ])

  // 8. 유저 프로필 + 닉네임 예약 삭제
  const batch = writeBatch(db)
  batch.delete(doc(db, 'users', uid))
  if (nickname) batch.delete(doc(db, 'nicknames', nickname))
  await batch.commit()

  // 9. Firebase Auth 계정 삭제 (마지막에 수행)
  await user.delete()
}

export async function searchUser(keyword: string): Promise<UserProfile[]> {
  if (!keyword.trim()) return []
  const q = keyword.toLowerCase()

  const snap = await getDocs(query(collection(db, 'users'), limit(300)))
  const results: UserProfile[] = []
  snap.forEach(d => {
    const data = d.data()
    if (
      (data.email as string || '').toLowerCase().includes(q) ||
      (data.nickname as string || '').toLowerCase().includes(q)
    ) {
      results.push({ uid: d.id, ...data } as UserProfile)
    }
  })
  return results
}
