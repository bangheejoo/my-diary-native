import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../src/context/AuthContext'
import { useTheme } from '../src/context/ThemeContext'

export default function Index() {
  const { user, loading } = useAuth()
  const { colors } = useTheme()
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem('onboarding_done').then(val => {
      setOnboardingDone(val === 'true')
      setOnboardingChecked(true)
    })
  }, [])

  if (loading || !onboardingChecked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  if (!onboardingDone) return <Redirect href="/onboarding" />
  return user ? <Redirect href="/(tabs)/main" /> : <Redirect href="/(auth)/login" />
}
