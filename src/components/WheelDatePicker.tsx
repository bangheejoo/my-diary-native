import { useState, useEffect, useRef } from 'react'
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  Modal, Pressable, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native'
import AppText from './AppText'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'

const ITEM_H = 44
const VISIBLE = 5
const PAD = Math.floor(VISIBLE / 2) * ITEM_H

const NOW = new Date()
const YEAR_LIST = Array.from({ length: NOW.getFullYear() - 1900 + 1 }, (_, i) => NOW.getFullYear() - i)
const MONTH_LIST = Array.from({ length: 12 }, (_, i) => i + 1)

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function pad2(n: number) { return String(n).padStart(2, '0') }

interface Props {
  visible: boolean
  value: string  // YYYY-MM-DD
  onConfirm: (date: string) => void
  onClose: () => void
}

export default function WheelDatePicker({ visible, value, onConfirm, onClose }: Props) {
  const { colors } = useTheme()
  const s = makeStyles(colors)

  const initYear = value?.length >= 10 ? parseInt(value.slice(0, 4)) : 2000
  const initMonth = value?.length >= 10 ? parseInt(value.slice(5, 7)) : 1
  const initDay = value?.length >= 10 ? parseInt(value.slice(8, 10)) : 1

  const [year, setYear] = useState(initYear)
  const [month, setMonth] = useState(initMonth)
  const [day, setDay] = useState(initDay)

  const yearRef = useRef<ScrollView>(null)
  const monthRef = useRef<ScrollView>(null)
  const dayRef = useRef<ScrollView>(null)

  const dayList = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1)

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => {
      yearRef.current?.scrollTo({ y: YEAR_LIST.indexOf(year) * ITEM_H, animated: false })
      monthRef.current?.scrollTo({ y: (month - 1) * ITEM_H, animated: false })
      dayRef.current?.scrollTo({ y: (day - 1) * ITEM_H, animated: false })
    }, 50)
    return () => clearTimeout(t)
  }, [visible])

  useEffect(() => {
    const maxDay = daysInMonth(year, month)
    if (day > maxDay) {
      setDay(maxDay)
      dayRef.current?.scrollTo({ y: (maxDay - 1) * ITEM_H, animated: false })
    }
  }, [year, month])

  function renderCol(
    items: number[],
    selected: number,
    onSelect: (v: number) => void,
    format: (v: number) => string,
    scrollRef: React.RefObject<ScrollView | null>,
  ) {
    const selIdx = items.indexOf(selected)

    function handleEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
      const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H)
      const clamped = Math.max(0, Math.min(i, items.length - 1))
      if (items[clamped] !== undefined) onSelect(items[clamped])
    }

    return (
      <View style={s.colWrap}>
        <View pointerEvents="none" style={s.selHighlight} />
        <ScrollView
          ref={scrollRef}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: PAD }}
          onMomentumScrollEnd={handleEnd}
          onScrollEndDrag={handleEnd}
        >
          {items.map((item, i) => (
            <TouchableOpacity
              key={item}
              style={s.colItem}
              onPress={() => {
                scrollRef.current?.scrollTo({ y: i * ITEM_H, animated: true })
                onSelect(item)
              }}
            >
              <AppText style={[
                s.colItemText,
                i === selIdx && s.colItemTextSelected,
                Math.abs(i - selIdx) > 2 && s.colItemTextFar,
              ]}>{format(item)}</AppText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    )
  }

  function handleConfirm() {
    onConfirm(`${year}-${pad2(month)}-${pad2(day)}`)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
          <View style={s.sheetHeader}>
            <AppText style={s.sheetTitle}>생년월일 선택</AppText>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={s.colLabels}>
            <AppText style={[s.colLabel, { flex: 2 }]}>년</AppText>
            <AppText style={[s.colLabel, { flex: 1 }]}>월</AppText>
            <AppText style={[s.colLabel, { flex: 1 }]}>일</AppText>
          </View>

          <View style={s.wheels}>
            {renderCol(YEAR_LIST, year, setYear, v => String(v), yearRef)}
            {renderCol(MONTH_LIST, month, setMonth, pad2, monthRef)}
            {renderCol(dayList, day, setDay, pad2, dayRef)}
          </View>

          <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm}>
            <AppText style={s.confirmBtnText}>확인</AppText>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function makeStyles(colors: ReturnType<typeof import('../theme/colors').getThemeColors>) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 34,
    },
    sheetHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 16, marginRight: -8,
    },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    colLabels: { flexDirection: 'row', paddingBottom: 4 },
    colLabel: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.textMuted },
    wheels: { flexDirection: 'row', gap: 4 },
    colWrap: { flex: 1, height: ITEM_H * VISIBLE, overflow: 'hidden' },
    colItem: { height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
    colItemText: { fontSize: 16, color: colors.text, fontWeight: '500' },
    colItemTextSelected: { color: colors.primaryDark, fontWeight: '800', fontSize: 18 },
    colItemTextFar: { color: colors.gray400 },
    selHighlight: {
      position: 'absolute', top: PAD, left: 4, right: 4, height: ITEM_H,
      borderRadius: 10, borderWidth: 1.5, borderColor: colors.primaryLight,
      backgroundColor: colors.primaryLight, opacity: 0.7
    },
    confirmBtn: {
      marginTop: 20, backgroundColor: colors.primary,
      borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    },
    confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  })
}
