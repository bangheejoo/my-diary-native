import { useState } from 'react'
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import AppText from '../../src/components/AppText'
import { Link, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { logIn } from '../../src/services/authService'
import { useTheme } from '../../src/context/ThemeContext'
import { useToast } from '../../src/context/ToastContext'

export default function LoginPage() {
  const { colors } = useTheme()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  async function handleLogin() {
    const errs: typeof errors = {}
    if (!email.trim()) errs.email = '이메일을 입력해 주세요'
    if (!password) errs.password = '비밀번호를 입력해 주세요'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      await logIn(email.trim(), password)
      router.replace('/(tabs)/main')
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        showToast('이메일 또는 비밀번호가 올바르지 않아요', 'error')
      } else {
        showToast('로그인에 실패했어요', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const s = makeStyles(colors)

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <AppText title style={s.logo}>하루조각</AppText>
          <AppText style={s.sub}>소중한 하루의 조각을 모아 보세요</AppText>

          <View style={s.form}>
            <View style={s.field}>
              <TextInput
                style={[s.input, errors.email ? s.inputError : null]}
                placeholder="이메일을 입력해 주세요"
                placeholderTextColor={colors.gray500}
                value={email}
                onChangeText={v => { setEmail(v); setErrors(e => ({ ...e, email: undefined })) }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors.email && <AppText style={s.errMsg}>{errors.email}</AppText>}
            </View>

            <View style={s.field}>
              <TextInput
                style={[s.input, errors.password ? s.inputError : null]}
                placeholder="비밀번호를 입력해 주세요"
                placeholderTextColor={colors.gray500}
                value={password}
                onChangeText={v => { setPassword(v); setErrors(e => ({ ...e, password: undefined })) }}
                secureTextEntry
              />
              {errors.password && <AppText style={s.errMsg}>{errors.password}</AppText>}
            </View>

            <TouchableOpacity style={s.btnPrimary} onPress={handleLogin} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <AppText style={s.btnPrimaryText}>로그인</AppText>}
            </TouchableOpacity>

            <Link href="/(auth)/reset-password" asChild>
              <TouchableOpacity style={s.linkBtn}>
                <AppText style={s.linkText}>비밀번호를 잊으셨나요?</AppText>
              </TouchableOpacity>
            </Link>

            <View style={s.divider}>
              <View style={s.dividerLine} />
              <AppText style={s.dividerText}>또는</AppText>
              <View style={s.dividerLine} />
            </View>

            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity style={s.btnOutline}>
                <AppText style={s.btnOutlineText}>회원가입</AppText>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(colors: ReturnType<typeof import('../../src/theme/colors').getThemeColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    logo: { fontSize: 32, fontWeight: '800', color: colors.primary, textAlign: 'center', marginBottom: 8 },
    sub: { fontSize: 16, color: colors.textMuted, textAlign: 'center', marginBottom: 40 },
    form: { gap: 12 },
    field: { gap: 4 },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      fontFamily: 'GmarketSansMedium',
    },
    inputError: { borderColor: colors.danger },
    errMsg: { fontSize: 14, color: colors.danger, marginTop: 2 },
    btnPrimary: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 18 },
    btnOutline: {
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: 'center',
    },
    btnOutlineText: { color: colors.primary, fontWeight: '600', fontSize: 18 },
    linkBtn: { alignItems: 'center', paddingVertical: 10 },
    linkText: { color: colors.textMuted, fontSize: 14 },
    divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { color: colors.textMuted, fontSize: 14 },
  })
}
