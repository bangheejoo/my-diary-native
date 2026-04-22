import { Redirect } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { useAuth } from '../src/context/AuthContext'
import { useTheme } from '../src/context/ThemeContext'

export default function Index() {
  const { user, loading } = useAuth()
  const { colors } = useTheme()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  return user ? <Redirect href="/(tabs)/main" /> : <Redirect href="/(auth)/login" />
}
