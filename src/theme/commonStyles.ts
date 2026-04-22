import { StyleSheet } from 'react-native'
import type { AppColors } from './colors'

export function makeCommonStyles(colors: AppColors) {
  return StyleSheet.create({
    // ── Layout ──────────────────────────────────────────────
    safe: { flex: 1, backgroundColor: colors.bg },

    // ── Page header ─────────────────────────────────────────
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    headerIconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

    // ── Back button ──────────────────────────────────────────
    backBtn: { padding: 8, marginLeft: -8, marginBottom: 30 },
    backText: { fontSize: 18, color: colors.textMuted },

    // ── Form ────────────────────────────────────────────────
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, color: colors.text,
      fontFamily: 'GmarketSansMedium',
    },
    inputError: { borderColor: colors.danger },
    inputOk:    { borderColor: '#16a34a' },
    errMsg:     { fontSize: 14, color: colors.danger, marginTop: 4 },
    fieldLabel: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 8 },

    // ── Buttons ──────────────────────────────────────────────
    btnPrimary: {
      backgroundColor: colors.primary,
      borderRadius: 10, paddingVertical: 14, alignItems: 'center',
    },
    btnPrimaryText: { color: colors.white, fontWeight: '700', fontSize: 16 },
    btnOutline: {
      borderWidth: 1.5, borderColor: colors.primary,
      borderRadius: 10, paddingVertical: 13, alignItems: 'center',
    },
    btnOutlineText: { color: colors.primary, fontWeight: '600', fontSize: 16 },
    btnDanger: {
      borderWidth: 1.5, borderColor: colors.danger,
      borderRadius: 10, paddingVertical: 13, alignItems: 'center',
    },
    btnDangerText: { color: colors.danger, fontWeight: '700', fontSize: 15 },

    // ── Section ──────────────────────────────────────────────
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },

    // ── Empty state ──────────────────────────────────────────
    emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 16 },

    // ── Confirm / Alert modal ────────────────────────────────
    confirmOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center', alignItems: 'center', zIndex: 100,
    },
    confirmModal: {
      backgroundColor: colors.surface, borderRadius: 16,
      padding: 24, width: '88%', gap: 12,
    },
    confirmTitle:      { fontSize: 20, fontWeight: '700', color: colors.text },
    confirmDesc:       { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
    confirmActions:    { flexDirection: 'row', gap: 8, marginTop: 4 },
    confirmCancelBtn:  { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    confirmCancelText: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
    confirmDangerBtn:  { flex: 1, backgroundColor: colors.danger, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    confirmDangerText: { fontSize: 15, fontWeight: '700', color: colors.white },

    // ── Bottom sheet ─────────────────────────────────────────
    sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 20, paddingBottom: 34,
    },
    sheetHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 16,
    },
    sheetTitle:    { fontSize: 18, fontWeight: '700', color: colors.text },
    sheetCloseBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  })
}

export type CommonStyles = ReturnType<typeof makeCommonStyles>
