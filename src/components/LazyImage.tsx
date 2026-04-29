import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { SkeletonBox } from './Skeleton'

interface Props {
  uri: string
  style?: object
  resizeMode?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
}

export default function LazyImage({ uri, style, resizeMode = 'cover' }: Props) {
  const [showSkeleton, setShowSkeleton] = useState(true)
  const flat = StyleSheet.flatten(style) as Record<string, unknown> | undefined
  const borderRadius = (flat?.borderRadius as number) ?? 0

  return (
    <View style={[style, { overflow: 'hidden' }]}>
      {showSkeleton && (
        <SkeletonBox style={[StyleSheet.absoluteFill, { borderRadius }]} />
      )}
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit={resizeMode}
        transition={250}
        cachePolicy="memory-disk"
        onLoad={() => setShowSkeleton(false)}
        onError={() => setShowSkeleton(false)}
      />
    </View>
  )
}
