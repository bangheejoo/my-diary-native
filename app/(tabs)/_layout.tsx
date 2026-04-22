import { Tabs, router } from 'expo-router'
import { useEffect } from 'react'
import { useAuth } from '../../src/context/AuthContext'
import { useTheme } from '../../src/context/ThemeContext'
import { ActivityIndicator, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export default function TabsLayout() {
  const { user, loading } = useAuth()
  const { colors } = useTheme()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/login')
    }
  }, [user, loading])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  if (!user) return null

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray500,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 75,
          paddingTop: 5,
          paddingBottom: 15,
        },
        tabBarLabelStyle: { fontSize: 10, marginTop: 3, fontWeight: '600', fontFamily: 'GmarketSansMedium' },
      }}
    >
      <Tabs.Screen
        name="main"
        options={{
          title: '조각',
          tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? 'book' : 'book-outline'} size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: '친구',
          tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? 'people' : 'people-outline'} size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          title: '내정보',
          tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={28} color={color} />,
        }}
      />
    </Tabs>
  )
}
