import { storage } from './firebase'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system/legacy'

const MAX_SIZE = 5 * 1024 * 1024

async function getFileSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri)
  return info.exists ? (info as FileSystem.FileInfo & { size?: number }).size ?? 0 : 0
}

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri)
  return response.blob()
}

async function compressImage(uri: string, width: number, quality: number): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  )
  return result.uri
}

export async function uploadImage(
  uri: string,
  uid: string
): Promise<{ url: string; storagePath: string }> {
  let targetUri = uri
  let size = await getFileSize(uri)

  if (size > MAX_SIZE) {
    targetUri = await compressImage(uri, 1920, 0.75)
    size = await getFileSize(targetUri)
  }
  if (size > MAX_SIZE) {
    targetUri = await compressImage(targetUri, 1920, 0.6)
    size = await getFileSize(targetUri)
  }
  if (size > MAX_SIZE) {
    throw new Error('이미지 용량이 5MB를 초과해요. 더 작은 이미지를 사용해 주세요')
  }

  const storagePath = `posts/${uid}/${Date.now()}.jpg`
  const blob = await uriToBlob(targetUri)
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, blob, { cacheControl: 'public, max-age=31536000', contentType: 'image/jpeg' })
  const url = await getDownloadURL(storageRef)
  return { url, storagePath }
}

export async function uploadProfilePhoto(
  uri: string,
  uid: string
): Promise<{ url: string; thumbUrl: string; storagePath: string }> {
  const MAX_PROFILE_SIZE = 2 * 1024 * 1024

  // 원본: 512px
  let fullUri = await compressImage(uri, 512, 0.8)
  let size = await getFileSize(fullUri)
  if (size > MAX_PROFILE_SIZE) {
    fullUri = await compressImage(uri, 512, 0.6)
  }

  // 썸네일: 96px
  const thumbUri = await compressImage(uri, 96, 0.8)

  const storagePath = `profiles/${uid}/avatar`
  const thumbPath = `profiles/${uid}/avatar_thumb`

  const [fullBlob, thumbBlob] = await Promise.all([
    uriToBlob(fullUri),
    uriToBlob(thumbUri),
  ])

  await Promise.all([
    uploadBytes(ref(storage, storagePath), fullBlob, { cacheControl: 'public, max-age=31536000', contentType: 'image/jpeg' }),
    uploadBytes(ref(storage, thumbPath), thumbBlob, { cacheControl: 'public, max-age=31536000', contentType: 'image/jpeg' }),
  ])

  const [url, thumbUrl] = await Promise.all([
    getDownloadURL(ref(storage, storagePath)),
    getDownloadURL(ref(storage, thumbPath)),
  ])

  return { url, thumbUrl, storagePath }
}

export async function deleteImage(storagePath: string) {
  if (!storagePath) return
  try {
    await deleteObject(ref(storage, storagePath))
  } catch (e: unknown) {
    if ((e as { code?: string }).code !== 'storage/object-not-found') throw e
  }
}
