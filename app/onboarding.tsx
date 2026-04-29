import React, { useRef, useState, useEffect } from 'react'
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../src/context/ThemeContext'
import { useAuth } from '../src/context/AuthContext'
import AppText from '../src/components/AppText'
import type { AppColors } from '../src/theme/colors'

const { width } = Dimensions.get('window')

// ── 애니메이션 훅 ────────────────────────────────────────────────────

// scale (useNativeDriver: true 가능)
function usePulseAnim(delay: number) {
  const val = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const id = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1.32, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(val, { toValue: 1.0,  duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start()
    }, delay)
    return () => clearTimeout(id)
  }, [])
  return val
}

// height / width (layout 프로퍼티 → useNativeDriver: false)
function useLayoutAnim(base: number, max: number, duration: number, delay: number) {
  const val = useRef(new Animated.Value(base)).current
  useEffect(() => {
    const id = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: max,  duration, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(val, { toValue: base, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ])
      ).start()
    }, delay)
    return () => clearTimeout(id)
  }, [])
  return val
}

// ── 일러스트 ─────────────────────────────────────────────────────────

function Illust1({ colors }: { colors: AppColors }) {
  const p1 = usePulseAnim(0)
  const p2 = usePulseAnim(350)
  const p3 = usePulseAnim(700)
  const p4 = usePulseAnim(1050)

  return (
    <View style={{ width: 280, height: 260, alignItems: 'center', justifyContent: 'center', marginBottom: 44 }}>
      <View style={{ width: 180, height: 180, borderRadius: 90, backgroundColor: colors.primaryLight2, alignItems: 'center', justifyContent: 'center' }}>
        <AppText style={{ fontSize: 80 }}>📖</AppText>
      </View>
      <Animated.View style={[pill, { backgroundColor: colors.primaryLight, top: 4, right: 36, opacity: 0.85, transform: [{ scale: p1 }] }]}>
        <AppText style={{ fontSize: 20 }}>🍑</AppText>
      </Animated.View>
      <Animated.View style={[pill, { backgroundColor: colors.mintDark, top: 34, left: 5, opacity: 0.85, transform: [{ scale: p2 }] }]}>
        <AppText style={{ fontSize: 20 }}>🤍</AppText>
      </Animated.View>
      <Animated.View style={[pill, { backgroundColor: colors.primaryDark, bottom: 26, right: 18, opacity: 0.85, transform: [{ scale: p3 }] }]}>
        <AppText style={{ fontSize: 20 }}>💬</AppText>
      </Animated.View>
      <Animated.View style={[pill, { backgroundColor: colors.mint, bottom: 4, left: 28, opacity: 0.85, transform: [{ scale: p4 }] }]}>
        <AppText style={{ fontSize: 20 }}>🍀</AppText>
      </Animated.View>
    </View>
  )
}

function Illust2({ colors }: { colors: AppColors }) {
  const h1 = useLayoutAnim(88,  126, 900, 0)
  const h2 = useLayoutAnim(118, 160, 900, 350)
  const h3 = useLayoutAnim(88,  126, 900, 700)

  return (
    <View style={{ width: 280, height: 260, alignItems: 'center', justifyContent: 'center', marginBottom: 44 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
        <Animated.View style={[visCard, { backgroundColor: colors.primaryLight2, height: h1 }]}>
          <Ionicons name="lock-closed" size={28} color={colors.primary} />
          <AppText style={{ fontSize: 12, fontWeight: '700', color: colors.primary, textAlign: 'center' }}>나만보기</AppText>
        </Animated.View>
        <Animated.View style={[visCard, { backgroundColor: colors.primaryLight, height: h2 }]}>
          <Ionicons name="people" size={28} color={colors.primaryDark} />
          <AppText style={{ fontSize: 12, fontWeight: '700', color: colors.primaryDark, textAlign: 'center' }}>친구랑보기</AppText>
        </Animated.View>
        <Animated.View style={[visCard, { backgroundColor: colors.mint, height: h3 }]}>
          <Ionicons name="heart" size={28} color={colors.mintDark} />
          <AppText style={{ fontSize: 12, fontWeight: '700', color: colors.mintDark, textAlign: 'center' }}>우리만보기</AppText>
        </Animated.View>
      </View>
    </View>
  )
}

function Illust3({ colors }: { colors: AppColors }) {
  const w1 = useLayoutAnim(218, 262, 1000, 0)
  const w2 = useLayoutAnim(185, 228, 1000, 500)

  return (
    <View style={{ width: 280, height: 260, justifyContent: 'center', marginBottom: 44, gap: 12 }}>
      <Animated.View style={[bubble, { backgroundColor: colors.primaryLight2, overflow: 'hidden', width: w1 }]}>
        <Ionicons name="chatbubble-ellipses" size={18} color={colors.primaryDark} />
        <AppText numberOfLines={1} style={{ fontSize: 15, color: colors.primaryDark, marginLeft: 8, lineHeight: 22, flexShrink: 1 }}>
          오늘 하루 어땠어? 😊
        </AppText>
      </Animated.View>
      <Animated.View style={[bubble, { backgroundColor: colors.mint, marginLeft: 40, overflow: 'hidden', width: w2 }]}>
        <AppText numberOfLines={1} style={{ fontSize: 15, color: colors.mintDark, lineHeight: 22, flexShrink: 1 }}>
          <AppText style={{ fontWeight: '700', color: colors.mintDark }}>@친구 </AppText>
          사진 너무 예쁘다!
        </AppText>
      </Animated.View>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4, marginTop: 2 }}>
        {['❤️', '😮', '😢', '😄', '👏'].map((emoji, i) => (
          <View
            key={i}
            style={{ width: 46, height: 46, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <AppText style={{ fontSize: 22 }}>{emoji}</AppText>
          </View>
        ))}
      </View>
    </View>
  )
}

// ── 공통 상수 ────────────────────────────────────────────────────────

const pill: object = {
  position: 'absolute',
  width: 58, height: 58, borderRadius: 50,
  alignItems: 'center', justifyContent: 'center',
}

const visCard: object = {
  width: 82, borderRadius: 24,
  alignItems: 'center', justifyContent: 'center',
  gap: 10, overflow: 'hidden',
}

const bubble: object = {
  flexDirection: 'row', alignItems: 'center',
  borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12,
}

const PAGES = [
  {
    id: '1',
    title: '하루를 조각처럼\n남겨보세요',
    subtitle: '작은 순간들이 모여,\n나만의 이야기가 돼요',
  },
  {
    id: '2',
    title: '기록은 나만 간직하거나\n소중한 사람들과 나눌 수 있어요',
    subtitle: '나만보기, 친구랑보기, 우리만보기로\n공개 범위를 자유롭게 설정해요',
  },
  {
    id: '3',
    title: '친구와 하루를 나누고\n따뜻한 마음을 전해보세요',
    subtitle: '댓글, 언급, 이모지로\n서로의 하루에 공감해요',
  },
]

// ── 메인 컴포넌트 ────────────────────────────────────────────────────

export default function Onboarding() {
  const { colors } = useTheme()
  const { user } = useAuth()
  const [currentIndex, setCurrentIndex] = useState(0)
  const flatRef = useRef<FlatList>(null)
  const scrollX = useRef(new Animated.Value(0)).current
  const s = makeStyles(colors)

  const finish = async () => {
    await AsyncStorage.setItem('onboarding_done', 'true')
    router.replace(user ? '/(tabs)/main' : '/(auth)/login')
  }

  const goNext = () => {
    flatRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true })
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <View style={s.headerRow}>
        <TouchableOpacity
          style={s.skipBtn}
          onPress={finish}
          disabled={currentIndex >= 2}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <AppText style={[s.skipText, { color: currentIndex < 2 ? colors.textMuted : 'transparent' }]}>
            건너뛰기
          </AppText>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatRef}
        data={PAGES}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={e => {
          setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }}
        renderItem={({ item, index }) => {
          const inputRange = [(index - 1) * width, index * width, (index + 1) * width]
          const opacity    = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: 'clamp' })
          const translateY = scrollX.interpolate({ inputRange, outputRange: [24, 0, 24], extrapolate: 'clamp' })
          return (
            <View style={[s.page, { width }]}>
              {index === 0 ? <Illust1 colors={colors} /> :
               index === 1 ? <Illust2 colors={colors} /> :
               <Illust3 colors={colors} />}
              <Animated.View style={{ opacity, transform: [{ translateY }], alignItems: 'center' }}>
                <AppText title style={[s.pageTitle, { color: colors.text }]}>{item.title}</AppText>
                <AppText style={[s.pageSubtitle, { color: colors.textMuted }]}>{item.subtitle}</AppText>
              </Animated.View>
            </View>
          )
        }}
      />

      <View style={s.footer}>
        <View style={s.dots}>
          {PAGES.map((_, i) => {
            const dotWidth = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            })
            const dotOpacity = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.35, 1, 0.35],
              extrapolate: 'clamp',
            })
            return (
              <Animated.View
                key={i}
                style={[s.dot, { width: dotWidth, opacity: dotOpacity, backgroundColor: colors.primary }]}
              />
            )
          })}
        </View>

        {currentIndex === 2 ? (
          <TouchableOpacity style={[s.startBtn, { backgroundColor: colors.primary }]} onPress={finish}>
            <AppText style={[s.startBtnText, { color: colors.white }]}>시작하기</AppText>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.nextBtn, { borderColor: colors.primary }]} onPress={goNext}>
            <Ionicons name="arrow-forward" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1 },
    headerRow: { alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 4 },
    skipBtn: { padding: 8 },
    skipText: { fontSize: 15, fontWeight: '600' },
    page: {
      flex: 1, paddingHorizontal: 32,
      alignItems: 'center', justifyContent: 'center',
      paddingTop: 16, paddingBottom: 16,
    },
    pageTitle: {
      fontSize: 22, fontWeight: '700',
      textAlign: 'center', lineHeight: 32, marginBottom: 14,
    },
    pageSubtitle: { fontSize: 16, textAlign: 'center', lineHeight: 22 },
    footer: { paddingHorizontal: 32, paddingBottom: 24, alignItems: 'center', gap: 28 },
    dots: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { height: 8, borderRadius: 4 },
    nextBtn: {
      width: 56, height: 56, borderRadius: 28,
      borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    },
    startBtn: {
      width: '100%', height: 56,
      borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    },
    startBtnText: { fontSize: 17, fontWeight: '700' },
  })
}
