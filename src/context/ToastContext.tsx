import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Platform } from 'react-native'

interface ToastMessage {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

let toastCounter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = ++toastCounter
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 2500)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={styles.container} pointerEvents="none">
        {toasts.map(t => (
          <View key={t.id} style={[styles.toast, t.type === 'error' ? styles.error : t.type === 'success' ? styles.success : styles.info]}>
            <Text style={styles.text}>{t.message}</Text>
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 6,
    maxWidth: 320,
  },
  success: { backgroundColor: '#16a34a' },
  error: { backgroundColor: '#ef4444' },
  info: { backgroundColor: '#374151' },
  text: { color: '#fff', fontSize: 14, textAlign: 'center' },
})
