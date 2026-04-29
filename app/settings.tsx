import { useState, useEffect } from 'react'
import {
  View, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Switch,
} from 'react-native'
import AppText from '../src/components/AppText'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../src/context/AuthContext'
import { useTheme } from '../src/context/ThemeContext'
import { useToast } from '../src/context/ToastContext'
import { deleteAccount, updateNotifSettings } from '../src/services/authService'
import type { NotifSettings } from '../src/services/authService'
import { DEFAULT_NOTIF_SETTINGS } from '../src/services/authService'
import type { ColorTheme } from '../src/theme/colors'
import { makeCommonStyles } from '../src/theme/commonStyles'

type Visibility = 'private' | 'friends' | 'us'

const COLOR_OPTIONS: { value: ColorTheme; label: string; colors: string[] }[] = [
  { value: 'pink',   label: '핑크',   colors: ['#F29199', '#F2BDC1', '#CEF2E8'] },
  { value: 'blue',   label: '블루',   colors: ['#6aa3ff', '#BFD9FF', '#FFE2BD'] },
  { value: 'green',  label: '그린',   colors: ['#9bd428', '#b8f051', '#90ddd3'] },
  { value: 'yellow', label: '옐로우', colors: ['#fcd06a', '#ffea98', '#93df6d'] },
  { value: 'purple', label: '퍼플',   colors: ['#b993ff', '#cfb8ea', '#F7CAC9'] },
  { value: 'coral', label: '코랄',   colors: ['#FF9A8B', '#FFC3A0', '#FFE8D6'] },
]

const VISIBILITY_OPTIONS: { value: Visibility; label: string; desc: string }[] = [
  { value: 'private', label: '나만보기', desc: '나만 볼 수 있어요' },
  { value: 'friends', label: '친구랑보기', desc: '친구들과 함께 볼 수 있어요' },
  { value: 'us', label: '우리만보기', desc: '특정 친구랑만 함께 봐요' },
]

const FONT_OPTIONS: { value: 'sm' | 'md' | 'lg'; label: string }[] = [
  { value: 'sm', label: '작게' },
  { value: 'md', label: '보통' },
  { value: 'lg', label: '크게' },
]

export default function SettingsPage() {
  const { user, profile } = useAuth()
  const { colors, colorTheme, isDark, fontSize, setColorTheme, toggleDark, setFontSize } = useTheme()
  const { showToast } = useToast()

  const [defaultVisibility, setDefaultVisibilityState] = useState<Visibility>('private')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [notifSettings, setNotifSettings] = useState<NotifSettings>(DEFAULT_NOTIF_SETTINGS)

  // profile에 notifSettings 있으면 우선 적용, 없으면 AsyncStorage 캐시 사용
  useEffect(() => {
    async function load() {
      if (profile?.notifSettings) {
        setNotifSettings(profile.notifSettings)
        await AsyncStorage.setItem('notifSettings', JSON.stringify(profile.notifSettings))
        return
      }
      const cached = await AsyncStorage.getItem('notifSettings')
      if (cached) {
        try { setNotifSettings(JSON.parse(cached)) } catch {}
      }
    }
    load()
  }, [profile])

  async function handleNotifToggle(key: keyof NotifSettings) {
    const updated = { ...notifSettings, [key]: !notifSettings[key] }
    setNotifSettings(updated)
    await AsyncStorage.setItem('notifSettings', JSON.stringify(updated))
    if (user) updateNotifSettings(user.uid, updated).catch(() => {})
  }

  async function handleDefaultVisibility(v: Visibility) {
    setDefaultVisibilityState(v)
    await AsyncStorage.setItem('defaultVisibility', v)
    showToast('기본 공개범위가 변경됐어요')
  }

  async function handleDeleteAccount() {
    if (!deletePassword.trim()) { showToast('비밀번호를 입력해 주세요', 'error'); return }
    setDeleting(true)
    try {
      await deleteAccount(deletePassword)
      await AsyncStorage.multiRemove(['colorTheme', 'darkMode', 'fontSize', 'defaultVisibility', `write_draft_${user!.uid}`])
      showToast('계정이 삭제됐어요')
      router.replace('/(auth)/login')
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        showToast('비밀번호가 올바르지 않아요', 'error')
      } else {
        showToast((err as Error).message || '계정 삭제에 실패했어요', 'error')
      }
    } finally {
      setDeleting(false)
    }
  }

  const s = makeStyles(colors)
  const cs = makeCommonStyles(colors)

  return (
    <SafeAreaView style={cs.safe} edges={['top']}>
      <View style={cs.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <AppText style={s.title}>설정하기</AppText>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {/* 테마 */}
        <View style={s.section}>
          <AppText style={cs.sectionTitle}>테마</AppText>
          <View style={s.themeRow}>
            {[
              { label: '라이트모드', dark: false },
              { label: '다크모드',  dark: true  },
            ].map(opt => (
              <TouchableOpacity
                key={String(opt.dark)}
                style={[s.themeBtn, isDark === opt.dark && s.themeBtnActive]}
                onPress={() => { if (isDark !== opt.dark) toggleDark() }}
              >
                <Ionicons name={opt.dark ? 'moon-outline':'sunny-outline'} size={34} color={colors.gray500} style={isDark === opt.dark && s.themeBtnTextActive} />
                <AppText style={[s.themeBtnText, isDark === opt.dark && s.themeBtnTextActive]}>{opt.label}</AppText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 색상 */}
        <View style={s.section}>
          <AppText style={cs.sectionTitle}>색상 테마</AppText>
          <View style={s.colorRow}>
            {COLOR_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[s.colorBtn, colorTheme === opt.value && s.colorBtnActive]}
                onPress={() => setColorTheme(opt.value)}
              >
                <View style={s.swatchRow}>
                  {opt.colors.map((c, i) => (
                    <View key={i} style={[s.swatch, { backgroundColor: c }]} />
                  ))}
                </View>
                <AppText style={[s.colorLabel, colorTheme === opt.value && s.colorLabelActive]}>{opt.label}</AppText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 폰트 크기 */}
        <View style={s.section}>
          <AppText style={cs.sectionTitle}>글자 크기</AppText>
          <View style={s.fontRow}>
            {FONT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[s.fontBtn, fontSize === opt.value && s.fontBtnActive]}
                onPress={() => setFontSize(opt.value)}
              >
                <AppText style={[s.fontBtnText, fontSize === opt.value && s.fontBtnTextActive]}>{opt.label}</AppText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 기본 공개범위 */}
        <View style={s.section}>
          <AppText style={cs.sectionTitle}>기본 공개범위</AppText>
          {VISIBILITY_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[s.visibilityBtn, defaultVisibility === opt.value && s.visibilityBtnActive]}
              onPress={() => handleDefaultVisibility(opt.value)}
            >
              <AppText style={[s.visibilityLabel, defaultVisibility === opt.value && s.visibilityLabelActive]}>{opt.label}</AppText>
              <AppText style={[s.visibilityDesc, defaultVisibility === opt.value && s.visibilityDescActive]}>{opt.desc}</AppText>
            </TouchableOpacity>
          ))}
        </View>

        {/* 알림 설정 */}
        <View style={s.section}>
          <AppText style={cs.sectionTitle}>알림 설정</AppText>

          {/* 전체 알림 */}
          <View style={s.notifRow}>
            <AppText style={s.notifLabel}>전체 알림</AppText>
            <Switch
              value={notifSettings.all}
              onValueChange={() => handleNotifToggle('all')}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={colors.white}
            />
          </View>

          {/* 세부 항목 */}
          {([
            { key: 'friendRequest' as const, label: '친구 요청 · 수락' },
            { key: 'commentReaction' as const, label: '댓글 · 공감' },
            { key: 'mention' as const, label: '언급' },
          ]).map(({ key, label }) => (
            <View key={key} style={[s.notifRow, !notifSettings.all && s.notifRowDisabled]}>
              <AppText style={[s.notifSubLabel, !notifSettings.all && s.notifLabelMuted]}>{label}</AppText>
              <Switch
                value={notifSettings[key]}
                onValueChange={() => handleNotifToggle(key)}
                disabled={!notifSettings.all}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={colors.white}
              />
            </View>
          ))}
        </View>

        {/* 가이드 다시 보기 */}
        <View style={s.section}>
          <AppText style={cs.sectionTitle}>가이드</AppText>
          <AppText style={[s.guideDesc, { color: colors.textMuted }]}>
          📖 온보딩과 각 화면의 튜토리얼을 언제든 다시 볼 수 있어요
          </AppText>
          <TouchableOpacity
            style={[s.guideBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={async () => {
              await AsyncStorage.multiRemove([
                'onboarding_done',
                'write_tutorial_done',
                'friends_tutorial_done',
              ])
              router.replace('/onboarding')
            }}
          >
            <AppText style={[s.guideBtnText, { color: colors.textMuted }]}>가이드 다시 보기</AppText>
            <Ionicons name="chevron-forward" size={18} color={colors.gray500} />
          </TouchableOpacity>
        </View>

        {/* 계정 삭제 */}
        <View style={[s.section, { marginTop: 12 }]}>
          <AppText style={cs.sectionTitle}>계정 삭제</AppText>
          <AppText style={s.dangerDesc}>🚫 계정을 삭제하면 모든 데이터가 삭제되며 복구할 수 없어요</AppText>
          <TouchableOpacity style={s.dangerBtn} onPress={() => setShowDeleteModal(true)}>
            <AppText style={s.dangerBtnText}>계정 삭제</AppText>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 계정 삭제 확인 모달 */}
      {showDeleteModal && (
        <View style={cs.confirmOverlay}>
          <View style={cs.confirmModal}>
            <AppText style={s.deleteModalTitle}>계정을 정말 삭제할까요?</AppText>
            <AppText style={s.deleteModalDesc}>삭제된 데이터는 복구할 수 없어요🔥</AppText>
            <TextInput
              style={cs.input}
              placeholder="비밀번호를 입력해 주세요"
              placeholderTextColor={colors.gray500}
              value={deletePassword}
              onChangeText={setDeletePassword}
              secureTextEntry
            />
            <View style={cs.confirmActions}>
              <TouchableOpacity style={cs.confirmCancelBtn} onPress={() => { setShowDeleteModal(false); setDeletePassword('') }}>
                <AppText style={cs.confirmCancelText}>취소</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={cs.confirmDangerBtn} onPress={handleDeleteAccount} disabled={deleting}>
                {deleting ? <ActivityIndicator color="#fff" size="small" /> : <AppText style={cs.confirmDangerText}>삭제하기</AppText>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

function makeStyles(colors: ReturnType<typeof import('../src/theme/colors').getThemeColors>) {
  return StyleSheet.create({
    backBtn: { width: 44, height: 44, justifyContent: 'center' },
    title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
    body: { padding: 16, paddingBottom: 48, gap: 20 },
    section: { gap: 10 },
    themeRow: { flexDirection: 'row', gap: 8 },
    themeBtn: {
      flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16,
      borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    themeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight2, opacity: 0.7 },
    themeBtnIcon: { fontSize: 24 },
    themeBtnText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
    themeBtnTextActive: { color: colors.primaryDark, fontWeight: '700' },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    colorBtn: {
      alignItems: 'center', gap: 10, padding: 20, borderRadius: 10, minWidth: 90,
      borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, flex: 1
    },
    colorBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight2, opacity: 0.7 },
    swatchRow: { flexDirection: 'row', gap: 2 },
    swatch: { width: 14, height: 14, borderRadius: 7 },
    colorLabel: { fontSize: 15, color: colors.textMuted, fontWeight: '600' },
    colorLabelActive: { color: colors.primaryDark, fontWeight: '700' },
    fontRow: { flexDirection: 'row', gap: 8 },
    fontBtn: {
      flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10,
      borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
    },
    fontBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight2, opacity: 0.7 },
    fontBtnText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
    fontBtnTextActive: { color: colors.primaryDark, fontWeight: '700' },
    visibilityBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
    },
    visibilityBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight2, opacity: 0.7 },
    visibilityLabel: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
    visibilityLabelActive: { color: colors.primaryDark, fontWeight: '700' },
    visibilityDesc: { fontSize: 14, color: colors.gray500 },
    visibilityDescActive: { color: colors.primaryDark },
    notifRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 12, paddingHorizontal: 14,
      backgroundColor: colors.surface, borderRadius: 10,
      borderWidth: 1, borderColor: colors.border,
    },
    notifRowDisabled: { opacity: 0.45 },
    notifLabel: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
    notifSubLabel: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
    notifLabelMuted: { color: colors.textMuted },
    guideDesc: { fontSize: 14, lineHeight: 19 },
    guideBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 14, borderRadius: 10, borderWidth: 1.5,
    },
    guideBtnText: { fontSize: 15, fontWeight: '600', flex: 1 },
    dangerDesc: { fontSize: 14, color: colors.textMuted, lineHeight: 18 },
    dangerBtn: {
      borderWidth: 1.5, borderColor: colors.primaryDark, borderRadius: 10, paddingVertical: 13, alignItems: 'center',
    },
    dangerBtnText: { color: colors.primaryDark, fontWeight: '700', fontSize: 15 },
    deleteModalTitle: { fontSize: 21, fontWeight: '700', color: colors.text },
    deleteModalDesc: { fontSize: 15, color: colors.textMuted, lineHeight: 18 },
  })
}
