import { useState, useEffect, useRef } from 'react'
import {
  View, TouchableOpacity, StyleSheet, Modal, Pressable,
  ScrollView, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native'
import AppText from './AppText'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'
import { getMyPosts } from '../services/postService'
import { today } from '../utils/formatDate'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

const PICK_H = 44
const PICK_VISIBLE = 5
const PICK_PAD = Math.floor(PICK_VISIBLE / 2) * PICK_H

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}
function lastDateOfMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

interface Props {
  uid?: string
  selectedDate: string | null
  onSelectDate: (dateStr: string) => void
  postDates?: Set<string>
}

export default function CalendarView({ uid, selectedDate, onSelectDate, postDates: externalDates }: Props) {
  const { colors } = useTheme()
  const todayStr = today()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [postDates, setPostDates] = useState<Set<string>>(externalDates ?? new Set())

  // 년/월 피커
  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(year)
  const [pickerMonth, setPickerMonth] = useState(month + 1)
  const yearScrollRef = useRef<ScrollView>(null)
  const monthScrollRef = useRef<ScrollView>(null)

  const MIN_YEAR = 2000
  const yearOptions = Array.from(
    { length: now.getFullYear() - MIN_YEAR + 1 },
    (_, i) => now.getFullYear() - i
  )
  const maxPickerMonth = pickerYear === now.getFullYear() ? now.getMonth() + 1 : 12
  const monthOptions = Array.from({ length: maxPickerMonth }, (_, i) => i + 1)

  useEffect(() => {
    if (externalDates) { setPostDates(externalDates); return }
    if (!uid) return
    getMyPosts(uid).then(posts => {
      setPostDates(new Set(posts.map(p => p.recordDate)))
    }).catch(() => {})
  }, [uid, externalDates])

  // 피커에서 년도 변경 시 월이 최대치 초과하면 클램프
  useEffect(() => {
    if (!showPicker) return
    if (pickerMonth > maxPickerMonth) {
      setPickerMonth(maxPickerMonth)
      monthScrollRef.current?.scrollTo({ y: (maxPickerMonth - 1) * PICK_H, animated: false })
    }
  }, [pickerYear, showPicker])

  // 피커 열릴 때 현재 년/월로 스크롤 초기화
  useEffect(() => {
    if (!showPicker) return
    const yearIdx = yearOptions.indexOf(pickerYear)
    const t = setTimeout(() => {
      yearScrollRef.current?.scrollTo({ y: yearIdx * PICK_H, animated: false })
      monthScrollRef.current?.scrollTo({ y: (pickerMonth - 1) * PICK_H, animated: false })
    }, 50)
    return () => clearTimeout(t)
  }, [showPicker])

  function openPicker() {
    setPickerYear(year)
    setPickerMonth(month + 1)
    setShowPicker(true)
  }

  function confirmPicker() {
    setYear(pickerYear)
    setMonth(pickerMonth - 1)
    setShowPicker(false)
  }

  function renderCol(
    items: number[],
    selected: number,
    onSelect: (v: number) => void,
    format: (v: number) => string,
    scrollRef: React.RefObject<ScrollView | null>,
  ) {
    const selIdx = items.indexOf(selected)

    function handleEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
      const i = Math.round(e.nativeEvent.contentOffset.y / PICK_H)
      const clamped = Math.max(0, Math.min(i, items.length - 1))
      if (items[clamped] !== undefined) onSelect(items[clamped])
    }

    return (
      <View style={s.colWrap}>
        <View pointerEvents="none" style={s.selHighlight} />
        <ScrollView
          ref={scrollRef}
          snapToInterval={PICK_H}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: PICK_PAD }}
          onMomentumScrollEnd={handleEnd}
          onScrollEndDrag={handleEnd}
        >
          {items.map((item, i) => (
            <TouchableOpacity
              key={item}
              style={s.colItem}
              onPress={() => {
                scrollRef.current?.scrollTo({ y: i * PICK_H, animated: true })
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

  function pad(n: number) { return String(n).padStart(2, '0') }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth())) return
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const firstDay = firstDayOfMonth(year, month)
  const lastDate = lastDateOfMonth(year, month)
  const canGoNext = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth())
  const s = makeStyles(colors)

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
          <AppText style={s.navText}>‹</AppText>
        </TouchableOpacity>

        <TouchableOpacity onPress={openPicker} style={s.titleBtn} activeOpacity={0.7}>
          <AppText style={s.title}>{year}년 {month + 1}월</AppText>
          <Ionicons name="calendar-outline" size={14} color={colors.text} style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        {canGoNext
          ? <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
              <AppText style={s.navText}>›</AppText>
            </TouchableOpacity>
          : <View style={s.navBtn} />
        }
      </View>

      <View style={s.grid}>
        {DAY_NAMES.map(d => (
          <View key={d} style={s.dayName}>
            <AppText style={[s.dayNameText, d === '일' && { color: '#ef4444' }, d === '토' && { color: '#3b82f6' }]}>{d}</AppText>
          </View>
        ))}
        {Array.from({ length: firstDay }, (_, i) => <View key={`e-${i}`} style={s.cell} />)}
        {Array.from({ length: lastDate }, (_, i) => {
          const d = i + 1
          const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`
          const isFuture = dateStr > todayStr
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          const hasPost = postDates.has(dateStr)
          const dayOfWeek = (firstDay + i) % 7
          return (
            <TouchableOpacity
              key={dateStr}
              style={[s.cell, isToday && s.cellToday, isSelected && s.cellSelected]}
              onPress={() => !isFuture && onSelectDate(dateStr)}
              activeOpacity={isFuture ? 1 : 0.7}
              disabled={isFuture}
            >
              <AppText style={[
                s.cellText,
                isFuture && s.cellTextFuture,
                isSelected && s.cellTextSelected,
                isToday && !isSelected && { color: colors.primary },
                dayOfWeek === 0 && !isSelected && !isFuture && { color: '#ef4444' },
                dayOfWeek === 6 && !isSelected && !isFuture && { color: '#3b82f6' },
              ]}>{d}</AppText>
              {hasPost && <View style={[s.dot, isSelected && s.dotSelected]} />}
            </TouchableOpacity>
          )
        })}
      </View>

      {/* 년/월 피커 모달 */}
      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <Pressable style={s.overlay} onPress={() => setShowPicker(false)}>
          <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
            <View style={s.sheetHeader}>
              <AppText style={s.sheetTitle}>년 / 월 이동</AppText>
              <TouchableOpacity onPress={() => setShowPicker(false)} style={s.sheetCloseBtn}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={s.colLabels}>
              <AppText style={[s.colLabel, { flex: 2 }]}>년</AppText>
              <AppText style={[s.colLabel, { flex: 1 }]}>월</AppText>
            </View>

            <View style={s.wheels}>
              <View style={{ flex: 2 }}>
                {renderCol(yearOptions, pickerYear, setPickerYear, v => String(v), yearScrollRef)}
              </View>
              <View style={{ flex: 1 }}>
                {renderCol(monthOptions, pickerMonth, setPickerMonth, v => String(v).padStart(2, '0'), monthScrollRef)}
              </View>
            </View>

            <TouchableOpacity style={s.confirmBtn} onPress={confirmPicker}>
              <AppText style={s.confirmBtnText}>이동하기</AppText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

function makeStyles(colors: ReturnType<typeof import('../theme/colors').getThemeColors>) {
  return StyleSheet.create({
    container: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    navBtn: { padding: 8 },
    navText: { fontSize: 35, color: colors.text, fontWeight: '300' },
    titleBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10 },
    title: { fontSize: 16, fontWeight: '700', color: colors.text },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayName: { width: '14.28%', alignItems: 'center', paddingVertical: 10 },
    dayNameText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 15 },
    cellToday: { backgroundColor: colors.primaryLight2, borderRadius: 15 },
    cellSelected: { backgroundColor: colors.primary, borderRadius: 15 },
    cellText: { fontSize: 13, color: colors.text, fontWeight: '500' },
    cellTextFuture: { color: colors.gray300 },
    cellTextSelected: { color: '#fff', fontWeight: '700' },
    dot: { position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary },
    dotSelected: { backgroundColor: '#fff' },
    // 피커 모달
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
    sheetCloseBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    colLabels: { flexDirection: 'row', paddingBottom: 4 },
    colLabel: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.textMuted },
    wheels: { flexDirection: 'row', gap: 4 },
    colWrap: { height: PICK_H * PICK_VISIBLE, overflow: 'hidden' },
    colItem: { height: PICK_H, justifyContent: 'center', alignItems: 'center' },
    colItemText: { fontSize: 16, color: colors.text, fontWeight: '500' },
    colItemTextSelected: { color: colors.primaryDark, fontWeight: '800', fontSize: 18 },
    colItemTextFar: { color: colors.gray400 },
    selHighlight: {
      position: 'absolute', top: PICK_PAD, left: 4, right: 4, height: PICK_H,
      borderRadius: 10, borderWidth: 1.5, borderColor: colors.primaryLight,
      backgroundColor: colors.primaryLight, opacity: 0.7,
    },
    confirmBtn: {
      marginTop: 20, backgroundColor: colors.primary,
      borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    },
    confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  })
}
