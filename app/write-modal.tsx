import { useState, useEffect } from 'react'
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image, Alert, KeyboardAvoidingView, Platform,
  Modal, Pressable,
} from 'react-native'
import AppText from '../src/components/AppText'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '../src/context/AuthContext'
import { useTheme } from '../src/context/ThemeContext'
import { useToast } from '../src/context/ToastContext'
import { createPost, updatePost, deletePost, getPost, getPostCountByDate } from '../src/services/postService'
import { uploadImage, deleteImage } from '../src/services/storageService'
import { getMyFriends } from '../src/services/friendService'
import { getUserProfile } from '../src/services/authService'
import { today, toKoreanDate } from '../src/utils/formatDate'
import AsyncStorage from '@react-native-async-storage/async-storage'
import CalendarView from '../src/components/CalendarView'

type Visibility = 'private' | 'friends' | 'us'

const VISIBILITY_OPTIONS: { value: Visibility; label: string; desc: string }[] = [
  { value: 'private', label: '나만보기', desc: '나만 볼 수 있어요' },
  { value: 'friends', label: '친구랑보기', desc: '내 친구들과 함께 볼 수 있어요' },
  { value: 'us', label: '우리만보기', desc: '특정 친구랑만 함께 봐요' },
]

export default function WriteModal() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const { showToast } = useToast()
  const { id } = useLocalSearchParams<{ id?: string }>()

  const [content, setContent] = useState('')
  const [recordDate, setRecordDate] = useState(today())
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null)
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null)
  const [targetUid, setTargetUid] = useState<string | null>(null)
  const [friends, setFriends] = useState<{ uid: string; nickname: string }[]>([])
  const [showFriendPicker, setShowFriendPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)

  useEffect(() => {
    async function loadDefaults() {
      const def = await AsyncStorage.getItem('defaultVisibility')
      if (def) setVisibility(def as Visibility)
    }
    loadDefaults()
  }, [])

  useEffect(() => {
    if (!user) return
    getMyFriends(user.uid).then(async list => {
      const profiles = await Promise.all(
        list.map(f => getUserProfile(f.friendUid).then(p => ({ uid: f.friendUid, nickname: p?.nickname ?? f.friendUid })))
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
    })
  }, [id])

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    })
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri)
    }
  }

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
        await updatePost(id, { content: content.trim(), recordDate, visibility, imageUrl: uploadedUrl, imageStoragePath: uploadedPath, targetUid: visibility === 'us' ? targetUid : null })
        showToast('조각을 다듬었어요', 'success')
      } else {
        await createPost({ uid: user.uid, content: content.trim(), recordDate, visibility, imageUrl: uploadedUrl, imageStoragePath: uploadedPath, targetUid: visibility === 'us' ? targetUid : null })
        showToast('조각을 모았어요', 'success')
      }
      router.back()
    } catch (err: unknown) {
      showToast((err as Error).message || '저장에 실패했어요', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    Alert.alert('조각 삭제', '이 조각을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
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
        },
      },
    ])
  }

  const s = makeStyles(colors)

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
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
          {/* 날짜 */}
          <View style={s.section}>
            <AppText style={s.label}>날짜</AppText>
            <TouchableOpacity style={s.datePicker} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <AppText style={s.datePickerText}>{toKoreanDate(recordDate)}</AppText>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* 내용 */}
          <View style={s.section}>
            <AppText style={s.label}>오늘의 조각</AppText>
            <TextInput
              style={[s.input, s.textarea]}
              multiline
              value={content}
              onChangeText={setContent}
              placeholder="오늘 하루 어떘나요? 오늘 하루의 조각을 모아 보세요"
              placeholderTextColor={colors.gray500}
              textAlignVertical="top"
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
              <AppText style={s.label}>공유할 친구 선택</AppText>
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
                <Image source={{ uri: imageUri || existingImageUrl! }} style={s.imagePreview} resizeMode="cover" />
              </View>
            ) : (
              <TouchableOpacity style={s.imagePicker} onPress={pickImage}>
                <Ionicons name="image-outline" size={28} color={colors.gray500} />
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
        <Pressable style={s.dateOverlay} onPress={() => setShowFriendPicker(false)}>
          <Pressable style={s.dateSheet} onPress={e => e.stopPropagation()}>
            <View style={s.dateSheetHeader}>
              <AppText style={s.dateSheetTitle}>같이 볼 친구 선택😍</AppText>
              <TouchableOpacity onPress={() => setShowFriendPicker(false)} style={s.sheetCloseBtn}>
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

      {/* 날짜 선택 모달 */}
      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={s.dateOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable style={s.dateSheet} onPress={e => e.stopPropagation()}>
            <View style={s.dateSheetHeader}>
              <AppText style={s.dateSheetTitle}>날짜 선택</AppText>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={s.sheetCloseBtn}>
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
    </SafeAreaView>
  )
}

function makeStyles(colors: ReturnType<typeof import('../src/theme/colors').getThemeColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 8, paddingVertical: 10,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 18, fontWeight: '700', color: colors.text },
    body: { padding: 16, gap: 20, paddingBottom: 40 },
    section: { gap: 10 },
    label: { fontSize: 16, fontWeight: '700', color: colors.text },
    input: {
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text,
      fontFamily: 'GmarketSansMedium', 
    },
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
    dateOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    dateSheet: {
      backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 20, paddingBottom: 34,
    },
    dateSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginRight: -8 },
    sheetCloseBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    dateSheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
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
    friendDropdownText: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600' },
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
  })
}
