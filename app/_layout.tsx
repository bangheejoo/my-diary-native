import { useEffect, useRef } from 'react'
import { Stack, router } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthProvider, useAuth } from '../src/context/AuthContext'
import { ThemeProvider } from '../src/context/ThemeContext'
import { ToastProvider } from '../src/context/ToastContext'
import { StyleSheet } from 'react-native'
import { useFonts } from 'expo-font'
import { fontAssets } from '../src/theme/fonts'
import * as Notifications from 'expo-notifications'
import { registerPushToken } from '../src/utils/registerPushToken'
import { markNotificationRead } from '../src/services/friendService'

type NotifData = { postId?: string; type?: string; notifId?: string }

function handleNotifNavigation(data: NotifData) {
  if (data?.notifId) {
    markNotificationRead(data.notifId).catch(() => {})
  }
  if (data?.postId) {
    router.push({ pathname: '/(tabs)/main', params: { highlightPostId: data.postId } })
  } else if (data?.type === 'friendRequest' || data?.type === 'friendAccepted') {
    router.push({ pathname: '/(tabs)/mypage', params: { tab: 'notifications' } })
  }
}

function PushNotificationSetup() {
  const { user } = useAuth()
  const responseListener = useRef<Notifications.EventSubscription | null>(null)

  useEffect(() => {
    if (user) registerPushToken(user.uid).catch(() => {})
  }, [user])

  useEffect(() => {
    // 앱이 완전히 종료된 상태에서 알림 탭으로 실행된 경우 처리
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return
      const data = response.notification.request.content.data as NotifData
      handleNotifNavigation(data)
    })

    // 백그라운드 상태에서 알림 탭 시 처리
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as NotifData
      handleNotifNavigation(data)
    })
    return () => responseListener.current?.remove()
  }, [])

  return null
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontAssets)

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <PushNotificationSetup />
            <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 220 }} />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
