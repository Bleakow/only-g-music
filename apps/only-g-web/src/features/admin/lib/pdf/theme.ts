/**
 * Tokens y estilos base del sistema de PDF premium (react-pdf). Paleta amatista
 * sobre papel blanco, tipografía Helvetica integrada (sin registrar fuentes woff
 * para evitar el parseo frágil de react-pdf). Compartido por el Informe Contable
 * y el Balance para que ambos hablen el mismo idioma visual.
 *
 * Unidades en puntos (pt): 1pt = 1/72". Página A4 ≈ 595 × 842 pt.
 */
import { StyleSheet } from "@react-pdf/renderer";

/** Familias Helvetica EXPLÍCITAS: evitan sorpresas del mapeo fontWeight→familia. */
export const F = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  oblique: "Helvetica-Oblique",
} as const;

/** Paleta. Amatista de marca (#7C3AED) como acento; papel blanco, tinta pizarra. */
export const C = {
  paper: "#FFFFFF",
  ink: "#0F172A", // titulares
  body: "#334155", // texto
  muted: "#64748B", // etiquetas
  faint: "#94A3B8", // metadatos / ejes
  line: "#E2E8F0", // bordes
  lineSoft: "#EEF1F5", // separadores suaves
  accent: "#7C3AED", // amatista
  accentDeep: "#5B21B6",
  accentSoft: "#EDE9FE", // círculos de icono
  accentBg: "#F5F3FF", // cabecera de tabla / callout
  danger: "#DC2626",
  success: "#059669",
  zebra: "#FAFAFC",
  cardBorder: "#E8E8F0",
} as const;

export const PAGE_PAD_X = 42;
export const PAGE_PAD_TOP = 40;
export const PAGE_PAD_BOTTOM = 62; // hueco reservado para el pie fijo

export const s = StyleSheet.create({
  page: {
    backgroundColor: C.paper,
    paddingHorizontal: PAGE_PAD_X,
    paddingTop: PAGE_PAD_TOP,
    paddingBottom: PAGE_PAD_BOTTOM,
    fontFamily: F.regular,
    fontSize: 9.5,
    color: C.body,
    lineHeight: 1.4,
  },

  // ---- Cabecera de marca (portada) ----
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    marginBottom: 22,
  },
  // marginLeft negativo: acerca el bloque logo+divisor a la esquina izquierda.
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginLeft: -12,
  },
  logo: { width: 75, height: 80 }, // only-g-logo-lockup.png (recortado, ~0.937)
  brandDivider: { width: 1, height: 64, backgroundColor: C.line },
  headerRight: { alignItems: "flex-end", maxWidth: 320 },
  docTitle: {
    fontFamily: F.bold,
    fontSize: 21,
    letterSpacing: 0.5,
    color: C.ink,
    textAlign: "right",
  },
  docSub: {
    fontFamily: F.bold,
    fontSize: 9,
    letterSpacing: 3,
    color: C.accent,
    marginTop: 9,
    textAlign: "right",
  },
  metaLine: { fontSize: 8.5, color: C.muted, marginTop: 6, textAlign: "right" },
  metaStrong: { fontFamily: F.bold, color: C.body },

  // ---- Títulos de sección ----
  sectionTitle: {
    fontFamily: F.bold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: C.ink,
  },
  sectionUnderline: {
    width: 26,
    height: 2.5,
    backgroundColor: C.accent,
    borderRadius: 2,
    marginTop: 5,
    marginBottom: 12,
  },

  // ---- Stat cards ----
  statRow: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 7.5,
    letterSpacing: 1.5,
    color: C.muted,
    textTransform: "uppercase",
  },
  statValue: { fontFamily: F.bold, fontSize: 17, marginTop: 5, color: C.ink },
  statAccentBar: {
    width: 22,
    height: 2,
    backgroundColor: C.accent,
    borderRadius: 2,
    marginTop: 8,
  },

  // ---- Card genérica ----
  card: {
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 10,
    padding: 16,
  },

  // ---- Gráfico de barras ----
  legendRow: { flexDirection: "row", gap: 18, marginBottom: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 9, height: 9, borderRadius: 2 },
  legendText: { fontSize: 9, color: C.body },
  legendValue: { fontFamily: F.bold, color: C.ink },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  barLabel: { width: 58, fontSize: 8.5, color: C.muted },
  barTrack: {
    flex: 1,
    height: 20,
    backgroundColor: C.lineSoft,
    borderRadius: 4,
    position: "relative",
  },
  barFill: { height: 20, borderRadius: 4 },
  barValue: {
    width: 74,
    fontSize: 8.5,
    fontFamily: F.bold,
    color: C.body,
    textAlign: "right",
  },
  axisRow: { flexDirection: "row", marginTop: 2, paddingLeft: 58 },

  // ---- Callout ----
  callout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.accentBg,
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  calloutIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.4,
    borderColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  calloutText: { flex: 1, fontSize: 9, color: C.body, lineHeight: 1.45 },

  // ---- Tabla ----
  tableHead: {
    flexDirection: "row",
    backgroundColor: C.accentBg,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  th: {
    fontSize: 7.5,
    fontFamily: F.bold,
    letterSpacing: 1,
    color: C.muted,
    textTransform: "uppercase",
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.lineSoft,
  },
  td: { fontSize: 9, color: C.body },
  tdStrong: { fontFamily: F.bold, color: C.ink },
  totalRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.ink,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginTop: 2,
  },
  totalLabel: {
    flex: 1,
    fontFamily: F.bold,
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: "#FFFFFF",
  },
  totalValue: {
    fontFamily: F.bold,
    fontSize: 11,
    color: "#FFFFFF",
    textAlign: "right",
  },
  empty: {
    paddingVertical: 26,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: C.lineSoft,
  },
  emptyText: { fontSize: 9, color: C.faint, fontFamily: F.oblique },

  // ---- Patrimonio (card de cierre) ----
  patrimonioCard: {
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 12,
    backgroundColor: C.accentBg,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "center",
    marginTop: 18,
  },
  patrimonioLabel: {
    fontSize: 8,
    letterSpacing: 2,
    color: C.accentDeep,
    textTransform: "uppercase",
  },
  patrimonioValue: {
    fontFamily: F.bold,
    fontSize: 26,
    color: C.accentDeep,
    marginTop: 8,
  },

  // ---- Pie fijo ----
  footer: {
    position: "absolute",
    left: PAGE_PAD_X,
    right: PAGE_PAD_X,
    bottom: 26,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 8,
  },
  footerCopy: { fontSize: 8, fontFamily: F.bold, color: C.body },
  footerNote: { fontSize: 7.5, color: C.faint, marginTop: 2 },
  footerPage: { fontSize: 8, color: C.muted },

  // ---- Título de página de sección (páginas de tabla) ----
  pageHeading: { marginBottom: 14 },
});
