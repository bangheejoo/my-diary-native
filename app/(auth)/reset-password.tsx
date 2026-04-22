import { useState } from 'react'
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import AppText from '../../src/components/AppText'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { sendPasswordReset } from '../../src/services/authService'
import { useTheme } from '../../src/context/ThemeContext'
import { useToast } from '../../src/context/ToastContext'

export default function ResetPasswordPage() {
  const { colors } = useTheme()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleReset() {
    if (!email.trim()) { showToast('이메일을 입력해 주세요', 'error'); return }
    setLoading(true)
    try {
      await sendPasswordReset(email.trim())
      setSent(true)
    } catch {
      showToast('이메일 발송에 실패했어요. 이메일을 확인해 주세요', 'error')
    } finally {
      setLoading(false)
    }
  }

  const s = makeStyles(colors)

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <AppText style={s.back}>〈 로그인가기</AppText>
        </TouchableOpacity>

        <AppText style={s.title}>비밀번호 찾기</AppText>
        <AppText style={s.desc}>가입한 이메일로 비밀번호 재설정 메일을 보내드려요</AppText>

        {sent ? (
          <View style={s.successBox}>
            <AppText style={s.successText}>✉️ 이메일을 발송했어요{'\n'}메일함을 확인해 주세요</AppText>
            <TouchableOpacity style={s.btnOutline} onPress={() => router.back()}>
              <AppText style={s.btnOutlineText}>로그인하러가기</AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <TextInput
              style={s.input}
              placeholder="이메일을 입력해 주세요"
              placeholderTextColor={colors.gray500}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={s.btnPrimary} onPress={handleReset} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <AppText style={s.btnPrimaryText}>재설정 메일 보내기</AppText>}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(colors: ReturnType<typeof import('../../src/theme/colors').getThemeColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    backBtn: { padding: 8, marginLeft: -8, marginBottom: 30 },
    back: { fontSize: 18, color: colors.textMuted },
    title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 12 },
    desc: { fontSize: 16, color: colors.textMuted, marginBottom: 32 },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      fontFamily: 'GmarketSansMedium',
    },
    btnPrimary: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 18 },
    btnOutline: { borderWidth: 1.5, borderColor: colors.primaryDark2, borderRadius: 15, alignItems: 'center', marginTop: 14 },
    btnOutlineText: { color: colors.primaryDark2, fontWeight: '600', fontSize: 14, padding: 12 },
    successBox: { alignItems: 'center', gap: 10, padding: 24, backgroundColor: colors.primaryLight, borderRadius: 15 },
    successText: { fontSize: 16, color: colors.text, textAlign: 'center', lineHeight: 24 },
  })
}
