import { useEffect, useRef, type ReactNode } from 'react'
import { Stack, router } from 'expo-router'
import Head from 'expo-router/head'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthProvider, useAuth } from '../src/context/AuthContext'
import { ThemeProvider, useTheme } from '../src/context/ThemeContext'
import { ToastProvider } from '../src/context/ToastContext'
import { Platform, StyleSheet, View } from 'react-native'
import { useFonts } from 'expo-font'
import { fontAssets } from '../src/theme/fonts'
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
  const responseListenerRef = useRef<{ remove: () => void } | null>(null)

  useEffect(() => {
    if (user) registerPushToken(user.uid).catch(() => {})
  }, [user])

  useEffect(() => {
    if (Platform.OS === 'web') return

    const Notifications = require('expo-notifications')

    Notifications.getLastNotificationResponseAsync().then((response: any) => {
      if (!response) return
      const data = response.notification.request.content.data as NotifData
      handleNotifNavigation(data)
    })

    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data as NotifData
      handleNotifNavigation(data)
    })
    return () => responseListenerRef.current?.remove()
  }, [])

  return null
}

function WebContainer({ children }: { children: ReactNode }) {
  const { colors, isDark } = useTheme()
  if (Platform.OS !== 'web') return <>{children}</>
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#0a0e17' : '#e5e7eb' }}>
      <View style={{
        flex: 1,
        maxWidth: 430,
        width: '100%',
        alignSelf: 'center',
        backgroundColor: colors.bg,
        overflow: 'hidden',
      }}>
        {children}
      </View>
    </View>
  )
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontAssets)

  if (!fontsLoaded) return null

  return (
    <>
      {Platform.OS === 'web' && (
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <style>{`
            html, body, #root { height: 100%; margin: 0; padding: 0; }
            * { box-sizing: border-box; }
          `}</style>
        </Head>
      )}
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <WebContainer>
              <PushNotificationSetup />
              <Stack screenOptions={{ headerShown: false, animation: Platform.OS === 'web' ? 'none' : 'fade', animationDuration: 220 }} />
            </WebContainer>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
    </>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
