import { useState, useEffect, useRef } from 'react'
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Modal, Pressable, Keyboard,
} from 'react-native'
import AppText from '../src/components/AppText'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '../src/context/AuthContext'
import { useTheme } from '../src/context/ThemeContext'
import { useToast } from '../src/context/ToastContext'
import { createPost, updatePost, deletePost, getPost, getPostCountByDate } from '../src/services/postService'
import { uploadImage, deleteImage } from '../src/services/storageService'
import { getMyFriends, sendWithNotifications } from '../src/services/friendService'
import { getUserProfile } from '../src/services/authService'
import { today, toKoreanDate } from '../src/utils/formatDate'
import AsyncStorage from '@react-native-async-storage/async-storage'
import CalendarView from '../src/components/CalendarView'
import { Image } from 'expo-image'
import { makeCommonStyles } from '../src/theme/commonStyles'

type Visibility = 'private' | 'friends' | 'us'

const TUTORIAL_TIPS = [
  {
    icon: 'calendar-outline',
    label: '날짜 선택',
    desc: '하루에는 최대 세 개의 조각을 남길 수 있어요',
  },
  {
    icon: 'eye-outline',
    label: '공개 범위',
    desc: '하루의 조각을 함께 나눌 친구를 선택해 보세요',
  },
  {
    icon: 'image-outline',
    label: '이미지',
    desc: '오늘을 담을 이미지가 있다면 함께 남겨 보세요',
  },
]

const VISIBILITY_OPTIONS: { value: Visibility; label: string; desc: string }[] = [
  { value: 'private', label: '나만보기', desc: '나만 볼 수 있어요' },
  { value: 'friends', label: '친구랑보기', desc: '내 친구들과 함께 볼 수 있어요' },
  { value: 'us', label: '우리만보기', desc: '특정 친구랑만 함께 봐요' },
]

export default function WriteModal() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const { showToast } = useToast()
  const { id, date } = useLocalSearchParams<{ id?: string; date?: string }>()
  const insets = useSafeAreaInsets()

  const [content, setContent] = useState('')
  const [showTutorial, setShowTutorial] = useState(false)
  const [recordDate, setRecordDate] = useState(() =>
    date && date <= today() ? date : today()
  )
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null)
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null)
  const [targetUid, setTargetUid] = useState<string | null>(null)
  const [friends, setFriends] = useState<{ uid: string; nickname: string; photoThumbUrl?: string | null }[]>([])
  const [showFriendPicker, setShowFriendPicker] = useState(false)
  const [withUids, setWithUids] = useState<string[]>([])
  const [withNicknames, setWithNicknames] = useState<string[]>([])
  const [showWithPicker, setShowWithPicker] = useState(false)
  const [showImageSourceSheet, setShowImageSourceSheet] = useState(false)
  const pendingImageActionRef = useRef<'camera' | 'gallery' | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [draftChecked, setDraftChecked] = useState(false)  // 초기 확인 완료 여부 (state → effect 재실행 트리거)
  const isPublishedRef = useRef(false)
  const hasDraftRef = useRef(false)             // 언마운트 cleanup용 (stale closure 방지)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftValuesRef = useRef({ content, recordDate, visibility, targetUid, withUids, withNicknames, imageUri })
  const draftKeyRef = useRef<string | null>(null)  // 언마운트 cleanup용
  const draftKey = user ? `write_draft_${user.uid}` : null

  useEffect(() => {
    async function loadDefaults() {
      const def = await AsyncStorage.getItem('defaultVisibility')
      if (def) setVisibility(def as Visibility)
      if (!id) {
        const done = await AsyncStorage.getItem('write_tutorial_done')
        if (!done) setShowTutorial(true)
      }
    }
    loadDefaults()
  }, [])

  useEffect(() => {
    if (!user) return
    getMyFriends(user.uid).then(async list => {
      const profiles = await Promise.all(
        list.map(f => getUserProfile(f.friendUid).then(p => ({
          uid: f.friendUid,
          nickname: p?.nickname ?? f.friendUid,
          photoThumbUrl: p?.photoThumbUrl ?? null,
        })))
      )
      setFriends(profiles)
    })
  }, [user])

  useEffect(() => {
    if (!id) return
    setIsEdit(true)
    getPost(id).then(post => {
      if (!post) return
      setContent(post.content)
      setRecordDate(post.recordDate)
      setVisibility(post.visibility as Visibility)
      setExistingImageUrl(post.imageUrl || null)
      setExistingImagePath(post.imageStoragePath || null)
      setTargetUid(post.targetUid || null)
      setWithUids(post.withUids || [])
      setWithNicknames(post.withNicknames || [])
    })
  }, [id])

  // 임시저장 감지 (새 글 작성 시만) — setDraftChecked(true)가 auto-save effect를 재트리거
  useEffect(() => {
    if (id || !draftKey) { if (!id) setDraftChecked(true); return }
    AsyncStorage.getItem(draftKey).then(raw => {
      if (!raw) { setDraftChecked(true); return }
      try {
        const draft = JSON.parse(raw)
        if (draft.content?.trim()) {
          hasDraftRef.current = true
          setHasDraft(true)
        }
      } catch {}
      setDraftChecked(true)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])

  // hasDraftRef / draftKeyRef 동기화 (unmount closure 용)
  useEffect(() => { hasDraftRef.current = hasDraft }, [hasDraft])
  useEffect(() => { draftKeyRef.current = draftKey }, [draftKey])

  // draftValuesRef 동기화
  useEffect(() => {
    draftValuesRef.current = { content, recordDate, visibility, targetUid, withUids, withNicknames, imageUri }
  }, [content, recordDate, visibility, targetUid, withUids, withNicknames, imageUri])

  // 자동 저장 (1.5초 debounce)
  // draftChecked(state)와 hasDraft(state)를 의존성에 포함 → 상태 변경 시 effect 재실행
  useEffect(() => {
    if (id || !draftChecked || hasDraft) return
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(async () => {
      const key = draftKeyRef.current
      if (!key) return
      const v = draftValuesRef.current
      if (!v.content.trim()) {
        await AsyncStorage.removeItem(key)
      } else {
        await AsyncStorage.setItem(key, JSON.stringify({ ...v, savedAt: new Date().toISOString() }))
      }
    }, 1500)
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current) }
  }, [content, recordDate, visibility, targetUid, withUids, withNicknames, imageUri, draftChecked, hasDraft])

  // 언마운트 시 최종 저장 (배너 미처리 상태면 기존 draft 보존)
  useEffect(() => {
    return () => {
      const key = draftKeyRef.current
      if (id || isPublishedRef.current || hasDraftRef.current || !key) return
      const v = draftValuesRef.current
      if (!v.content.trim()) { AsyncStorage.removeItem(key); return }
      AsyncStorage.setItem(key, JSON.stringify({ ...v, savedAt: new Date().toISOString() }))
    }
  }, [])

  async function loadDraft() {
    if (!draftKey) return
    const raw = await AsyncStorage.getItem(draftKey)
    if (!raw) { setHasDraft(false); return }
    try {
      const draft = JSON.parse(raw)
      if (draft.content) setContent(draft.content)
      if (draft.recordDate && draft.recordDate <= today()) setRecordDate(draft.recordDate)
      if (draft.visibility) setVisibility(draft.visibility as Visibility)
      setTargetUid(draft.targetUid ?? null)
      if (Array.isArray(draft.withUids)) setWithUids(draft.withUids)
      if (Array.isArray(draft.withNicknames)) setWithNicknames(draft.withNicknames)
      if (draft.imageUri) setImageUri(draft.imageUri)
    } catch {}
    setHasDraft(false)  // hasDraft=false → auto-save effect 재실행 → 복원된 내용으로 저장 시작
  }

  async function discardDraft() {
    if (draftKey) await AsyncStorage.removeItem(draftKey)
    setHasDraft(false)
  }

  // visibility·targetUid 변경 시 동반자 자동 정리
  useEffect(() => {
    if (visibility === 'private') {
      setWithUids([])
      setWithNicknames([])
    } else if (visibility === 'us') {
      // 우리만보기: targetUid로 선택된 친구만 허용
      if (targetUid) {
        setWithUids(prev => prev.filter(u => u === targetUid))
        setWithNicknames(prev => {
          const idx = withUids.indexOf(targetUid)
          return idx >= 0 ? [prev[idx]] : []
        })
      } else {
        setWithUids([])
        setWithNicknames([])
      }
    }
  }, [visibility, targetUid])

  function addCompanion(uid: string, nickname: string) {
    if (withUids.length >= 3 || withUids.includes(uid)) return
    setWithUids(prev => [...prev, uid])
    setWithNicknames(prev => [...prev, nickname])
    setShowWithPicker(false)
  }

  function removeCompanion(uid: string) {
    const idx = withUids.indexOf(uid)
    if (idx === -1) return
    setWithUids(prev => prev.filter((_, i) => i !== idx))
    setWithNicknames(prev => prev.filter((_, i) => i !== idx))
  }

  function openImageSourceSheet() {
    Keyboard.dismiss()
    setShowImageSourceSheet(true)
  }

  function pickFromCamera() {
    pendingImageActionRef.current = 'camera'
    setShowImageSourceSheet(false)
  }

  function pickFromGallery() {
    pendingImageActionRef.current = 'gallery'
    setShowImageSourceSheet(false)
  }

  async function runPendingImageAction() {
    const action = pendingImageActionRef.current
    if (!action) return
    pendingImageActionRef.current = null

    if (action === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        showToast('카메라 권한이 필요해요. 설정에서 허용해 주세요', 'error')
        return
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri)
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        showToast('사진 접근 권한이 필요해요. 설정에서 허용해 주세요', 'error')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
      if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri)
    }
  }

  // Android: onDismiss가 지원되지 않아 showImageSourceSheet가 false로 바뀐 후 실행
  useEffect(() => {
    if (showImageSourceSheet || Platform.OS === 'ios') return
    const timer = setTimeout(runPendingImageAction, 300)
    return () => clearTimeout(timer)
  }, [showImageSourceSheet])

  async function handleSave() {
    if (!user) return
    if (!content.trim()) { showToast('내용을 입력해 주세요', 'error'); return }
    if (!recordDate) { showToast('날짜를 입력해 주세요', 'error'); return }
    if (recordDate > today()) { showToast('오늘 이전의 날짜만 선택할 수 있어요', 'error'); return }
    if (visibility === 'us' && !targetUid) { showToast('같이 볼 친구를 선택해 주세요', 'error'); return }
    if (!isEdit) {
      const count = await getPostCountByDate(user.uid, recordDate)
      if (count >= 3) { showToast('동일 날짜에 최대 3개의 조각만 모을 수 있어요', 'error'); return }
    }

    setSaving(true)
    try {
      let uploadedUrl: string | null = existingImageUrl
      let uploadedPath: string | null = existingImagePath

      if (imageUri) {
        const res = await uploadImage(imageUri, user.uid)
        uploadedUrl = res.url
        uploadedPath = res.storagePath
        if (existingImagePath) await deleteImage(existingImagePath)
      }

      if (isEdit && id) {
        await updatePost(id, { content: content.trim(), recordDate, visibility, imageUrl: uploadedUrl, imageStoragePath: uploadedPath, targetUid: visibility === 'us' ? targetUid : null, withUids, withNicknames })
        showToast('조각을 다듬었어요', 'success')
      } else {
        const postId = await createPost({ uid: user.uid, content: content.trim(), recordDate, visibility, imageUrl: uploadedUrl, imageStoragePath: uploadedPath, targetUid: visibility === 'us' ? targetUid : null, withUids, withNicknames })
        if (withUids.length > 0) {
          sendWithNotifications(postId, user.uid, withUids).catch(() => {})
        }
        isPublishedRef.current = true
        if (draftKey) await AsyncStorage.removeItem(draftKey)
        showToast('조각을 모았어요', 'success')
      }
      router.back()
    } catch (err: unknown) {
      showToast((err as Error).message || '저장에 실패했어요', 'error')
    } finally {
      setSaving(false)
    }
  }

  function closeTutorial() {
    setShowTutorial(false)
  }

  async function neverShowTutorial() {
    await AsyncStorage.setItem('write_tutorial_done', 'true')
    setShowTutorial(false)
  }

  async function handleDelete() {
    if (!id) return
    const doDelete = async () => {
      setDeleting(true)
      try {
        if (existingImagePath) await deleteImage(existingImagePath)
        await deletePost(id)
        showToast('조각이 삭제됐어요')
        router.back()
      } catch {
        showToast('삭제에 실패했어요', 'error')
      } finally {
        setDeleting(false)
      }
    }
    if (Platform.OS === 'web') {
      if (window.confirm('이 조각을 삭제할까요?')) await doDelete()
      return
    }
    Alert.alert('조각 삭제', '이 조각을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: doDelete },
    ])
  }

  const s = makeStyles(colors)
  const cs = makeCommonStyles(colors)

  return (
    <SafeAreaView style={cs.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* 헤더 */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
          <AppText style={s.title}>{isEdit ? '조각 다듬기' : '조각 모으기'}</AppText>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={s.headerBtn}>
            {saving
              ? <ActivityIndicator color={colors.primary} size="small" />
              : <Ionicons name="checkmark" size={24} color={colors.primary} />}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {/* 임시저장 배너 */}
          {hasDraft && (
            <View style={[s.draftBanner, { backgroundColor: colors.primaryLight2, borderColor: colors.primary }]}>
              <View style={s.draftBannerTop}>
                <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                <AppText style={[s.draftBannerTitle, { color: colors.primary }]}>이전에 작성 중이던 내용이 있어요</AppText>
              </View>
              <View style={s.draftBannerBtns}>
                <TouchableOpacity style={[s.draftBtnPrimary, { backgroundColor: colors.primary }]} onPress={loadDraft}>
                  <AppText style={[s.draftBtnPrimaryText, { color: colors.white }]}>이어 쓰기</AppText>
                </TouchableOpacity>
                <TouchableOpacity style={[s.draftBtnSecondary, { borderColor: colors.border }]} onPress={discardDraft}>
                  <AppText style={[s.draftBtnSecondaryText, { color: colors.textMuted }]}>버리기</AppText>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 날짜 */}
          <View style={s.section}>
            <AppText style={s.label}>날짜</AppText>
            <TouchableOpacity style={s.datePicker} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <AppText style={s.datePickerText}>{toKoreanDate(recordDate)}</AppText>
              {recordDate === today() && (
                <View style={s.todayBadge}>
                  <AppText style={s.todayBadgeText}>오늘</AppText>
                </View>
              )}
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* 내용 */}
          <View style={s.section}>
            <View style={s.labelRow}>
              <AppText style={s.label}>오늘의 조각</AppText>
              <AppText style={[s.charCount, content.length >= 500 && s.charCountMax]}>
                {content.length}/500
              </AppText>
            </View>
            <TextInput
              style={[cs.input, s.textarea]}
              multiline
              value={content}
              onChangeText={setContent}
              placeholder="오늘 하루는 어땠나요? 오늘의 조각을 모아 보세요"
              placeholderTextColor={colors.gray500}
              textAlignVertical="top"
              maxLength={500}
            />
          </View>

          {/* 공개 범위 */}
          <View style={s.section}>
            <AppText style={s.label}>공개 범위</AppText>
            {VISIBILITY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[s.visibilityBtn, visibility === opt.value && s.visibilityBtnActive]}
                onPress={() => setVisibility(opt.value)}
              >
                <AppText style={[s.visibilityLabel, visibility === opt.value && s.visibilityLabelActive]}>{opt.label}</AppText>
                <AppText style={s.visibilityDesc}>{opt.desc}</AppText>
              </TouchableOpacity>
            ))}
          </View>

          {/* 우리만보기 친구 선택 */}
          {visibility === 'us' && (
            <View style={s.section}>
              <AppText style={s.label}>함께 볼 친구 선택</AppText>
              <TouchableOpacity
                style={s.friendDropdown}
                onPress={() => friends.length > 0 && setShowFriendPicker(true)}
              >
                <AppText style={[s.friendDropdownText, !targetUid && { color: colors.gray500 }]}>
                  {friends.length === 0
                    ? '등록된 친구가 없어요'
                    : (friends.find(f => f.uid === targetUid)?.nickname ?? '친구를 선택해 주세요')}
                </AppText>
                {friends.length > 0 && <Ionicons name="chevron-down" size={16} color={colors.textMuted} />}
              </TouchableOpacity>
            </View>
          )}

          {/* 함께한 사람 */}
          {visibility !== 'private' && friends.length > 0 && (visibility !== 'us' || !!targetUid) && (
            <View style={s.section}>
              <AppText style={s.label}>함께한 사람 (선택)</AppText>
              {withUids.length > 0 && (
                <View style={s.withChips}>
                  {withUids.map((uid, i) => (
                    <View key={uid} style={s.withChip}>
                      <AppText style={[s.withChipText, { color: colors.primary }]}>{withNicknames[i]}</AppText>
                      <TouchableOpacity onPress={() => removeCompanion(uid)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              {(() => {
                const maxCount = visibility === 'us' ? 1 : 3
                const canAdd = withUids.length < maxCount
                const label = visibility === 'us' ? '함께 볼 친구 추가 (최대 1명)' : '함께한 친구 추가 (최대 3명)'
                return canAdd ? (
                  <TouchableOpacity style={s.addWithBtn} onPress={() => setShowWithPicker(true)} activeOpacity={0.7}>
                    <Ionicons name="person-add-outline" size={16} color={colors.primary} />
                    <AppText style={[s.addWithBtnText, { color: colors.primary }]}>{label}</AppText>
                  </TouchableOpacity>
                ) : null
              })()}
            </View>
          )}

          {/* 이미지 */}
          <View style={s.section}>
            <View style={s.imageLabelRow}>
              <AppText style={s.label}>이미지 (선택)</AppText>
              {(imageUri || existingImageUrl) && (
                <TouchableOpacity
                  onPress={() => { setImageUri(null); setExistingImageUrl(null); setExistingImagePath(null) }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <AppText style={s.removeImageText}>✕ 이미지 제거</AppText>
                </TouchableOpacity>
              )}
            </View>
            {(imageUri || existingImageUrl) ? (
              <View style={s.imagePreviewWrap}>
                <Image source={{ uri: imageUri || existingImageUrl! }} style={s.imagePreview} contentFit="cover" />
              </View>
            ) : (
              <TouchableOpacity style={s.imagePicker} onPress={openImageSourceSheet}>
                <Ionicons name="image-outline" size={34} color={colors.gray500} />
                <AppText style={s.imagePickerText}>이미지 추가</AppText>
              </TouchableOpacity>
            )}
          </View>

          {/* 삭제 버튼 (수정 모드) */}
          {isEdit && (
            <TouchableOpacity style={s.deleteBtn} onPress={handleDelete} disabled={deleting}>
              {deleting
                ? <ActivityIndicator color={colors.danger} size="small" />
                : <AppText style={s.deleteBtnText}>이 조각 삭제하기</AppText>}
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 친구 선택 모달 */}
      <Modal visible={showFriendPicker} transparent animationType="slide" onRequestClose={() => setShowFriendPicker(false)}>
        <Pressable style={cs.sheetOverlay} onPress={() => setShowFriendPicker(false)}>
          <Pressable style={s.dateSheet} onPress={e => e.stopPropagation()}>
            <View style={s.dateSheetHeader}>
              <AppText style={s.dateSheetTitle}>같이 볼 친구 선택😍</AppText>
              <TouchableOpacity onPress={() => setShowFriendPicker(false)} style={cs.sheetCloseBtn}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {friends.map(f => (
              <TouchableOpacity
                key={f.uid}
                style={[s.friendSheetRow, targetUid === f.uid && s.friendSheetRowActive]}
                onPress={() => { setTargetUid(f.uid); setShowFriendPicker(false) }}
              >
                <AppText style={[s.friendSheetText, targetUid === f.uid && s.friendSheetTextActive]}>{f.nickname}</AppText>
                {targetUid === f.uid && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* 함께한 사람 선택 모달 */}
      <Modal visible={showWithPicker} transparent animationType="slide" onRequestClose={() => setShowWithPicker(false)}>
        <Pressable style={cs.sheetOverlay} onPress={() => setShowWithPicker(false)}>
          <Pressable style={s.dateSheet} onPress={e => e.stopPropagation()}>
            <View style={s.dateSheetHeader}>
              <AppText style={s.dateSheetTitle}>함께한 친구 선택</AppText>
              <TouchableOpacity onPress={() => setShowWithPicker(false)} style={cs.sheetCloseBtn}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <AppText style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>
              {visibility === 'us' ? '함께 볼 친구 1명만 선택할 수 있어요' : '최대 3명까지 선택할 수 있어요'}
            </AppText>
            {(() => {
              const pool = visibility === 'us'
                ? friends.filter(f => f.uid === targetUid && !withUids.includes(f.uid))
                : friends.filter(f => !withUids.includes(f.uid))
              return pool.map(f => (
                <TouchableOpacity
                  key={f.uid}
                  style={s.friendSheetRow}
                  onPress={() => addCompanion(f.uid, f.nickname)}
                >
                  <AppText style={s.friendSheetText}>{f.nickname}</AppText>
                </TouchableOpacity>
              ))
            })()}
            {(() => {
              const pool = visibility === 'us'
                ? friends.filter(f => f.uid === targetUid && !withUids.includes(f.uid))
                : friends.filter(f => !withUids.includes(f.uid))
              return pool.length === 0 ? (
                <AppText style={{ color: colors.textMuted, textAlign: 'center', paddingVertical: 20, fontSize: 14 }}>
                  더 이상 추가할 친구가 없어요
                </AppText>
              ) : null
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* 날짜 선택 모달 */}
      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={cs.sheetOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable style={s.dateSheet} onPress={e => e.stopPropagation()}>
            <View style={s.dateSheetHeader}>
              <AppText style={s.dateSheetTitle}>날짜 선택</AppText>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={cs.sheetCloseBtn}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <CalendarView
              selectedDate={recordDate}
              onSelectDate={date => { setRecordDate(date); setShowDatePicker(false) }}
            />
          </Pressable>
        </Pressable>
      </Modal>
      {/* 이미지 소스 선택 시트 */}
      <Modal visible={showImageSourceSheet} transparent animationType="slide" onRequestClose={() => setShowImageSourceSheet(false)} onDismiss={runPendingImageAction}>
        <Pressable style={cs.sheetOverlay} onPress={() => setShowImageSourceSheet(false)}>
          <Pressable style={[cs.sheet, { gap: 4 }]} onPress={e => e.stopPropagation()}>
            <View style={cs.sheetHeader}>
              <AppText style={cs.sheetTitle}>이미지 추가</AppText>
              <TouchableOpacity style={cs.sheetCloseBtn} onPress={() => setShowImageSourceSheet(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.imageSourceBtn} onPress={pickFromCamera} activeOpacity={0.7}>
              <View style={[s.imageSourceIconBox, { backgroundColor: colors.primaryLight2 }]}>
                <Ionicons name="camera-outline" size={26} color={colors.primary} />
              </View>
              <View style={s.imageSourceTexts}>
                <AppText style={[s.imageSourceTitle, { color: colors.text }]}>카메라로 찍기</AppText>
                <AppText style={[s.imageSourceDesc, { color: colors.textMuted }]}>지금 순간을 담아 보세요</AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
            </TouchableOpacity>

            <TouchableOpacity style={s.imageSourceBtn} onPress={pickFromGallery} activeOpacity={0.7}>
              <View style={[s.imageSourceIconBox, { backgroundColor: colors.primaryLight2 }]}>
                <Ionicons name="images-outline" size={26} color={colors.primary} />
              </View>
              <View style={s.imageSourceTexts}>
                <AppText style={[s.imageSourceTitle, { color: colors.text }]}>앨범에서 선택</AppText>
                <AppText style={[s.imageSourceDesc, { color: colors.textMuted }]}>기억 속 사진을 불러와 보세요</AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 작성 튜토리얼 */}
      <Modal visible={showTutorial} transparent animationType="fade" statusBarTranslucent>
        <Pressable style={cs.tutorialOverlay} onPress={closeTutorial}>
          <Pressable
            style={[cs.tutorialCloseBtn, { top: insets.top + 10 }]}
            onPress={closeTutorial}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>

          <Pressable style={[cs.tutorialCard, { backgroundColor: colors.surface }]} onPress={e => e.stopPropagation()}>
            <AppText title style={[cs.tutorialCardTitle, { textAlign: 'center', marginBottom: 24, color: colors.text }]}>
              📖 작성 화면 안내
            </AppText>

            {TUTORIAL_TIPS.map((tip, i) => (
              <View key={i}>
                <View style={cs.tutorialRow}>
                  <View style={[cs.tutorialIconBox, { backgroundColor: colors.primaryLight2 }]}>
                    <Ionicons name={tip.icon as any} size={22} color={colors.primary} />
                  </View>
                  <View style={cs.tutorialTextWrap}>
                    <AppText style={[cs.tutorialLabel, { color: colors.text }]}>{tip.label}</AppText>
                    <AppText style={[cs.tutorialDesc, { color: colors.textMuted }]}>{tip.desc}</AppText>
                  </View>
                </View>
                {i < TUTORIAL_TIPS.length - 1 && (
                  <View style={[cs.tutorialDivider, { backgroundColor: colors.border }]} />
                )}
              </View>
            ))}

            <Pressable
              style={[cs.tutorialDoneBtn, { backgroundColor: colors.primary }]}
              onPress={closeTutorial}
            >
              <AppText style={[cs.tutorialDoneBtnText, { color: colors.white }]}>확인했어요</AppText>
            </Pressable>
            <Pressable style={cs.tutorialNeverBtn} onPress={neverShowTutorial}>
              <AppText style={[cs.tutorialNeverText, { color: colors.textMuted }]}>다신 안보기🚫</AppText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

function makeStyles(colors: ReturnType<typeof import('../src/theme/colors').getThemeColors>) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 8, paddingVertical: 10,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 18, fontWeight: '700', color: colors.text },
    body: { padding: 16, gap: 20, paddingBottom: 40 },
    section: { gap: 10 },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    label: { fontSize: 16, fontWeight: '700', color: colors.text },
    charCount: { fontSize: 13, color: colors.textMuted },
    charCountMax: { color: colors.danger, fontWeight: '700' },
    textarea: { minHeight: 140, lineHeight: 26 },
    visibilityBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    visibilityBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight2 },
    visibilityLabel: { fontSize: 15, fontWeight: '500', color: colors.text },
    visibilityLabelActive: { color: colors.primary },
    visibilityDesc: { fontSize: 13, color: colors.textMuted },
    datePicker: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
    },
    datePickerText: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600' },
    todayBadge: {
      backgroundColor: colors.primary,
      borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
    },
    todayBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    dateSheet: {
      backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 20, paddingBottom: 34,
    },
    dateSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginRight: -8 },
    dateSheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    imageSourceBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingVertical: 14, paddingHorizontal: 4,
    },
    imageSourceIconBox: {
      width: 48, height: 48, borderRadius: 14,
      justifyContent: 'center', alignItems: 'center',
    },
    imageSourceTexts: { flex: 1, gap: 8 },
    imageSourceTitle: { fontSize: 17, fontWeight: '700', marginTop: 3 },
    imageSourceDesc: { fontSize: 14, lineHeight: 19 },
    imagePicker: {
      borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border,
      borderRadius: 10, paddingVertical: 28, alignItems: 'center', gap: 8,
    },
    imagePickerText: { color: colors.textMuted, fontSize: 16 },
    imageLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    imagePreviewWrap: {},
    imagePreview: { width: '100%', aspectRatio: 1, borderRadius: 10 },
    removeImageText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
    friendBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    friendDropdown: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
    },
    friendDropdownText: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600', lineHeight: 19 },
    withChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    withChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.primaryLight2,
      borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    },
    withChipText: { fontSize: 14, fontWeight: '600' },
    addWithBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed',
      borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14,
    },
    addWithBtnText: { fontSize: 14, fontWeight: '600' },
    friendSheetRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 18, paddingHorizontal: 4
    },
    friendSheetRowActive: { backgroundColor: colors.primaryLight2, borderRadius: 10, paddingHorizontal: 12, marginHorizontal: -8 },
    friendSheetText: { fontSize: 15, color: colors.text },
    friendSheetTextActive: { color: colors.primary, fontWeight: '700' },
    deleteBtn: {
      backgroundColor: colors.danger || '#fee2e2',
      borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 8,
    },
    deleteBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
    draftBanner: {
      borderWidth: 1, borderRadius: 12,
      padding: 14, gap: 12,
    },
    draftBannerTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    draftBannerTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
    draftBannerBtns: { flexDirection: 'row', gap: 8 },
    draftBtnPrimary: { flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
    draftBtnPrimaryText: { fontSize: 14, fontWeight: '700' },
    draftBtnSecondary: { flex: 1, borderRadius: 8, borderWidth: 1, paddingVertical: 9, alignItems: 'center' },
    draftBtnSecondaryText: { fontSize: 14, fontWeight: '600' },
  })
}
