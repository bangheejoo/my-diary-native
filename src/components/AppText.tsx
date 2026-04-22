import { Text, StyleSheet } from 'react-native'
import type { TextProps, TextStyle } from 'react-native'
import { useTheme } from '../context/ThemeContext'

interface AppTextProps extends TextProps {
  title?: boolean
}

function resolveFontFamily(weight: TextStyle['fontWeight'] | undefined, isTitle: boolean): string {
  if (isTitle) return 'Cafe24Ssurround'
  switch (weight) {
    case '100': case '200': case '300': return 'GmarketSansLight'
    case '700': case '800': case '900': case 'bold': return 'GmarketSansBold'
    default: return 'GmarketSansMedium'
  }
}

export default function AppText({ style, title = false, ...props }: AppTextProps) {
  const { fontScale } = useTheme()
  const flat = StyleSheet.flatten(style) as TextStyle | undefined
  const fontFamily = resolveFontFamily(flat?.fontWeight, title)
  const override: TextStyle = { fontFamily }
  if (flat?.fontSize != null) {
    override.fontSize = Math.round(flat.fontSize * fontScale)
  }
  return <Text {...props} style={[style, override]} />
}
