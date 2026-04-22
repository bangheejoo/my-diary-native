import { useState, useRef } from 'react'
import { Animated, View, StyleSheet } from 'react-native'
import { SkeletonBox } from './Skeleton'

interface Props {
  uri: string
  style?: object
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center'
}

export default function LazyImage({ uri, style, resizeMode = 'cover' }: Props) {
  const [loaded, setLoaded] = useState(false)
  const opacity = useRef(new Animated.Value(0)).current
  const flat = StyleSheet.flatten(style) as Record<string, unknown> | undefined
  const borderRadius = (flat?.borderRadius as number) ?? 0

  function onLoad() {
    setLoaded(true)
    Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start()
  }

  return (
    <View style={[style, { overflow: 'hidden' }]}>
      {!loaded && (
        <SkeletonBox style={[StyleSheet.absoluteFill, { borderRadius }]} />
      )}
      <Animated.Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, { opacity }]}
        resizeMode={resizeMode}
        onLoad={onLoad}
      />
    </View>
  )
}
