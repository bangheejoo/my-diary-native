import { ToastAndroid, Platform, Alert } from 'react-native'

// iOS는 Alert, Android는 ToastAndroid 사용
// 실제 프로덕션에서는 react-native-toast-message 같은 라이브러리 권장
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT)
  } else {
    // iOS에서는 간단한 알림 (비차단)
    // 실제로는 커스텀 토스트 컴포넌트를 사용하는 것이 좋음
    console.log(`[${type.toUpperCase()}] ${message}`)
  }
}

export function showAlert(title: string, message: string) {
  Alert.alert(title, message)
}
