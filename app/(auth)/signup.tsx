import { useState } from 'react'
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import AppText from '../../src/components/AppText'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { signUp, isNicknameTaken } from '../../src/services/authService'
import { isValidNickname, isValidPassword } from '../../src/utils/validation'
import { useTheme } from '../../src/context/ThemeContext'
import { useToast } from '../../src/context/ToastContext'
import WheelDatePicker from '../../src/components/WheelDatePicker'

export default function SignupPage() {
  const { colors } = useTheme()
  const { showToast } = useToast()

  const [form, setForm] = useState({ email: '', nickname: '', password: '', confirm: '', phone: '', birthdate: '' })
  const [errors, setErrors] = useState<Partial<typeof form>>({})
  const [nickStatus, setNickStatus] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [nickChecking, setNickChecking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showBirthPicker, setShowBirthPicker] = useState(false)

  function set(key: keyof typeof form, val: string) {
    setForm(f => ({ ...f, [key]: val }))
    setErrors(e => ({ ...e, [key]: undefined }))
    if (key === 'nickname') setNickStatus('idle')
  }

  async function handleNickCheck() {
    const nick = form.nickname.trim()
    if (!isValidNickname(nick)) { setErrors(e => ({ ...e, nickname: '닉네임은 2~12자로 입력해 주세요' })); setNickStatus('fail'); return }
    setNickChecking(true)
    try {
      const taken = await isNicknameTaken(nick)
      if (taken) { setNickStatus('fail'); setErrors(e => ({ ...e, nickname: '이미 사용 중인 닉네임이예요' })) }
      else { setNickStatus('ok'); setErrors(e => ({ ...e, nickname: undefined })) }
    } catch { showToast('닉네임 확인 중 오류가 발생했어요', 'error') }
    finally { setNickChecking(false) }
  }

  async function handleSubmit() {
    const errs: Partial<typeof form> = {}
    if (!form.email.trim()) errs.email = '이메일을 입력해 주세요'
    if (!isValidNickname(form.nickname.trim())) errs.nickname = '닉네임은 2~12자로 입력해 주세요'
    else if (nickStatus !== 'ok') errs.nickname = '닉네임 중복확인을 해주세요'
    if (!isValidPassword(form.password)) errs.password = '영문+숫자 포함 8자 이상이어야 해요'
    if (form.password !== form.confirm) errs.confirm = '비밀번호가 일치하지 않아요'
    if (!form.phone.trim()) errs.phone = '휴대폰 번호를 입력해 주세요'
    if (!form.birthdate.trim()) errs.birthdate = '생년월일을 입력해 주세요'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      await signUp({ email: form.email.trim(), nickname: form.nickname.trim(), password: form.password, phone: form.phone.trim(), birthdate: form.birthdate.trim() })
      showToast('회원가입이 완료됐어요', 'success')
      router.replace('/(tabs)/main')
    } catch (err: unknown) {
      showToast((err as Error).message || '회원가입에 실패했어요', 'error')
    } finally {
      setLoading(false)
    }
  }

  const s = makeStyles(colors)

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <AppText style={s.back}>〈 </AppText>
          </TouchableOpacity>

          <AppText style={s.title}>회원가입</AppText>
          <AppText style={s.desc}>회원이 되어 하루의 조각을 모아 보세요</AppText>

          {([
            { key: 'email', label: '이메일 (아이디)', placeholder: '이메일을 입력해 주세요', keyboardType: 'email-address' as const, autoCapitalize: 'none' as const },
            { key: 'phone', label: '휴대폰 번호', placeholder: '-없이 입력해 주세요', keyboardType: 'phone-pad' as const, autoCapitalize: 'none' as const },
          ] as Array<{ key: keyof typeof form; label: string; placeholder: string; keyboardType?: 'email-address' | 'phone-pad' | 'default'; autoCapitalize?: 'none' | 'sentences' }>).map(f => (
            <View key={f.key} style={s.field}>
              <AppText style={s.label}>{f.label}</AppText>
              <TextInput
                style={[s.input, errors[f.key] ? s.inputError : null]}
                placeholder={f.placeholder}
                placeholderTextColor={colors.gray500}
                value={form[f.key]}
                onChangeText={v => set(f.key, v)}
                keyboardType={f.keyboardType}
                autoCapitalize={f.autoCapitalize}
                autoCorrect={false}
              />
              {errors[f.key] && <AppText style={s.errMsg}>{errors[f.key]}</AppText>}
            </View>
          ))}

          {/* 생년월일 */}
          <View style={s.field}>
            <AppText style={s.label}>생년월일</AppText>
            <TouchableOpacity
              style={[s.input, s.dateTrigger, errors.birthdate ? s.inputError : null]}
              onPress={() => setShowBirthPicker(true)}
            >
              {form.birthdate ? (
                <AppText style={s.dateTriggerText}>{form.birthdate}</AppText>
              ) : (
                <AppText style={[s.dateTriggerText, { color: colors.gray500 }]}>날짜를 선택해 주세요</AppText>
              )}
              <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {errors.birthdate && <AppText style={s.errMsg}>{errors.birthdate}</AppText>}
          </View>

          {/* 닉네임 (중복확인 포함) */}
          <View style={s.field}>
            <AppText style={s.label}>닉네임</AppText>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[s.input, { flex: 1 }, errors.nickname ? s.inputError : nickStatus === 'ok' ? s.inputOk : null]}
                placeholder="2~12자로 입력해 주세요"
                placeholderTextColor={colors.gray500}
                value={form.nickname}
                onChangeText={v => set('nickname', v)}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[s.checkBtn, nickStatus === 'ok' ? s.checkBtnOk : null]}
                onPress={handleNickCheck}
                disabled={nickChecking}
              >
                {nickChecking ? <ActivityIndicator color={colors.primary} size="small" /> : <AppText style={s.checkBtnText}>{nickStatus === 'ok' ? '확인완료' : '중복확인'}</AppText>}
              </TouchableOpacity>
            </View>
            {errors.nickname && <AppText style={s.errMsg}>{errors.nickname}</AppText>}
            {nickStatus === 'ok' && !errors.nickname && <AppText style={[s.errMsg, { color: '#16a34a' }]}>사용 가능한 닉네임이예요</AppText>}
          </View>

          {/* 비밀번호 */}
          <View style={s.field}>
            <AppText style={s.label}>비밀번호</AppText>
            <TextInput style={[s.input, errors.password ? s.inputError : null]} placeholder="영문+숫자 포함 8자 이상으로 입력해 주세요" placeholderTextColor={colors.gray500} value={form.password} onChangeText={v => set('password', v)} secureTextEntry />
            {errors.password && <AppText style={s.errMsg}>{errors.password}</AppText>}
          </View>
          <View style={s.field}>
            <AppText style={s.label}>비밀번호 확인</AppText>
            <TextInput style={[s.input, errors.confirm ? s.inputError : null]} placeholder="비밀번호를 다시 입력해 주세요" placeholderTextColor={colors.gray500} value={form.confirm} onChangeText={v => set('confirm', v)} secureTextEntry />
            {errors.confirm && <AppText style={s.errMsg}>{errors.confirm}</AppText>}
          </View>

          <TouchableOpacity style={s.btnPrimary} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <AppText style={s.btnPrimaryText}>가입하기</AppText>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <WheelDatePicker
        visible={showBirthPicker}
        value={form.birthdate || '2000-01-01'}
        onConfirm={date => { set('birthdate', date); setShowBirthPicker(false) }}
        onClose={() => setShowBirthPicker(false)}
      />
    </SafeAreaView>
  )
}

function makeStyles(colors: ReturnType<typeof import('../../src/theme/colors').getThemeColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    container: { padding: 24, paddingBottom: 48 },
    backBtn: { padding: 8, marginLeft: -8, marginBottom: 30 },
    back: { fontSize: 18, color: colors.textMuted },
    title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 12 },
    desc: { fontSize: 16, color: colors.textMuted, marginBottom: 32 },
    field: { marginBottom: 18 },
    label: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 8 },
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
    inputError: { borderColor: colors.danger },
    dateTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dateTriggerText: { fontSize: 16, color: colors.text },
    inputOk: { borderColor: '#16a34a' },
    errMsg: { fontSize: 14, color: colors.danger, marginTop: 4 },
    checkBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 80,
    },
    checkBtnOk: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
    checkBtnText: { fontSize: 15, color: colors.text, fontWeight: '600' },
    btnPrimary: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 12,
    },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  })
}
