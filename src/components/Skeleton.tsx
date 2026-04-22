import { useEffect, useRef } from 'react'
import { Animated, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { useTheme } from '../context/ThemeContext'

export function SkeletonBox({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme()
  const anim = useRef(new Animated.Value(0.35)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  return <Animated.View style={[{ backgroundColor: colors.gray200, opacity: anim }, style]} />
}

export function SkeletonPostCard() {
  const { colors } = useTheme()
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonBox style={{ width: 80, height: 14, borderRadius: 6 }} />
        <SkeletonBox style={{ width: 62, height: 22, borderRadius: 11 }} />
      </View>
      <View style={{ gap: 7 }}>
        <SkeletonBox style={{ width: '100%', height: 13, borderRadius: 6 }} />
        <SkeletonBox style={{ width: '80%', height: 13, borderRadius: 6 }} />
        <SkeletonBox style={{ width: '55%', height: 13, borderRadius: 6 }} />
      </View>
    </View>
  )
}

export function SkeletonNotifItem() {
  const { colors } = useTheme()
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' }}>
      <SkeletonBox style={{ width: 36, height: 36, borderRadius: 18 }} />
      <View style={{ flex: 1, gap: 7 }}>
        <SkeletonBox style={{ width: '75%', height: 13, borderRadius: 6 }} />
        <SkeletonBox style={{ width: 44, height: 11, borderRadius: 5 }} />
      </View>
    </View>
  )
}

export function SkeletonFriendRow() {
  const { colors } = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <SkeletonBox style={{ width: 40, height: 40, borderRadius: 20 }} />
      <View style={{ flex: 1, gap: 7 }}>
        <SkeletonBox style={{ width: 100, height: 14, borderRadius: 6 }} />
        <SkeletonBox style={{ width: 140, height: 12, borderRadius: 5 }} />
      </View>
    </View>
  )
}
