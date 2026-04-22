import { useState, useEffect } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import AppText from './AppText'
import { useTheme } from '../context/ThemeContext'
import { getMyPosts } from '../services/postService'
import { today } from '../utils/formatDate'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

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
  postDates?: Set<string>   // 외부에서 주입 시 (친구 피드용)
}

export default function CalendarView({ uid, selectedDate, onSelectDate, postDates: externalDates }: Props) {
  const { colors } = useTheme()
  const todayStr = today()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [postDates, setPostDates] = useState<Set<string>>(externalDates ?? new Set())

  useEffect(() => {
    if (externalDates) { setPostDates(externalDates); return }
    if (!uid) return
    getMyPosts(uid).then(posts => {
      setPostDates(new Set(posts.map(p => p.recordDate)))
    }).catch(() => {})
  }, [uid, externalDates])

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
  const s = makeStyles(colors)

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
          <AppText style={s.navText}>‹</AppText>
        </TouchableOpacity>
        <AppText style={s.title}>{year}년 {month + 1}월</AppText>
        <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
          <AppText style={s.navText}>›</AppText>
        </TouchableOpacity>
      </View>

      <View style={s.grid}>
        {DAY_NAMES.map(d => (
          <View key={d} style={s.dayName}><AppText style={[s.dayNameText, d === '일' && { color: '#ef4444' }, d === '토' && { color: '#3b82f6' }]}>{d}</AppText></View>
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
                dayOfWeek === 0 && !isSelected && { color: '#ef4444' },
                dayOfWeek === 6 && !isSelected && { color: '#3b82f6' },
              ]}>{d}</AppText>
              {hasPost && <View style={[s.dot, isSelected && s.dotSelected]} />}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

function makeStyles(colors: ReturnType<typeof import('../theme/colors').getThemeColors>) {
  return StyleSheet.create({
    container: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    navBtn: { padding: 8 },
    navText: { fontSize: 35, color: colors.text, fontWeight: '300' },
    title: { fontSize: 16, fontWeight: '700', color: colors.text },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayName: { width: '14.28%', alignItems: 'center', paddingVertical: 10 },
    dayNameText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 15 },
    cellToday: { backgroundColor: colors.primaryLight2, borderRadius: 15 },
    cellSelected: { backgroundColor: colors.primary, borderRadius: 15 },
    cellText: { fontSize: 13, color: colors.text, fontWeight: '500' },
    cellTextFuture: { color: colors.gray300 },
    cellTextSelected: { color: '#fff', fontWeight: '700' },
    dot: { width: 4, height: 4, borderRadius: 5, backgroundColor: colors.primary },
    dotSelected: { backgroundColor: '#fff' },
  })
}
