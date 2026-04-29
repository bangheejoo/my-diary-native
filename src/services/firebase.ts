import { initializeApp } from 'firebase/app'
import { initializeAuth, getReactNativePersistence, browserLocalPersistence } from 'firebase/auth'
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { Platform } from 'react-native'

const firebaseConfig = {
  apiKey: 'AIzaSyBV8L1IBl2C0756ow7LLywUnrRVbnPvH9c',
  authDomain: 'myself-da51a.firebaseapp.com',
  projectId: 'myself-da51a',
  storageBucket: 'myself-da51a.firebasestorage.app',
  messagingSenderId: '113820162484',
  appId: '1:113820162484:web:a0825b3b7eee6c7305bae1',
}

const app = initializeApp(firebaseConfig)

export const auth = initializeAuth(app, {
  persistence: Platform.OS === 'web'
    ? browserLocalPersistence
    : getReactNativePersistence(ReactNativeAsyncStorage),
})
export const db = getFirestore(app)
export const storage = getStorage(app)
