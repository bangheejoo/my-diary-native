import { Platform } from 'react-native'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../services/firebase'

if (Platform.OS !== 'web') {
  const Notifications = require('expo-notifications')
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
}

export async function registerPushToken(uid: string): Promise<void> {
  if (Platform.OS === 'web') return

  const Device = require('expo-device')
  const Notifications = require('expo-notifications')
  const Constants = require('expo-constants').default

  if (!Device.isDevice) return

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '기본 알림',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    })
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
  const token = tokenData.data

  await updateDoc(doc(db, 'users', uid), { expoPushToken: token })
}
