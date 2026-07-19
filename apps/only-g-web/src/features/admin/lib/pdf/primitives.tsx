/**
 * Primitivas visuales del PDF premium (react-pdf): cabecera de marca, pie con
 * numeración, títulos de sección, stat cards con iconos vectoriales, gráfico de
 * barras horizontal, callout y tabla paginable. Los iconos son SVG (trazos), no
 * glifos Unicode — Helvetica no trae flechas y saldrían como tofu.
 *
 * Todo aquí es PURO/presentacional: recibe texto ya formateado y traducido.
 */
import type { ReactNode } from "react";
import {
  View,
  Text,
  Image,
  Svg,
  Line,
  Polyline,
  Polygon,
  Rect,
} from "@react-pdf/renderer";
import { C, F, s } from "./theme";

// ───────────────────────── Iconos (SVG, 18×18) ─────────────────────────

const IC = 16; // tamaño de dibujo dentro del círculo

export function IconIncome() {
  return (
    <Svg width={IC} height={IC} viewBox="0 0 18 18">
      <Line x1={4} y1={14} x2={14} y2={5} stroke={C.accent} strokeWidth={1.6} />
      <Polyline
        points="9,5 14,5 14,10"
        stroke={C.accent}
        strokeWidth={1.6}
        fill="none"
      />
    </Svg>
  );
}

export function IconExpense() {
  return (
    <Svg width={IC} height={IC} viewBox="0 0 18 18">
      <Line x1={9} y1={4} x2={9} y2={14} stroke={C.accent} strokeWidth={1.6} />
      <Polyline
        points="5,10 9,14 13,10"
        stroke={C.accent}
        strokeWidth={1.6}
        fill="none"
      />
    </Svg>
  );
}

export function IconProfit() {
  return (
    <Svg width={IC} height={IC} viewBox="0 0 18 18">
      <Rect x={3.5} y={11} width={3} height={4} fill={C.accent} rx={0.8} />
      <Rect x={7.5} y={8} width={3} height={7} fill={C.accent} rx={0.8} />
      <Rect x={11.5} y={4.5} width={3} height={10.5} fill={C.accent} rx={0.8} />
    </Svg>
  );
}

export function IconBank() {
  return (
    <Svg width={IC} height={IC} viewBox="0 0 18 18">
      <Polygon points="9,3 15.5,7 2.5,7" fill={C.accent} />
      <Rect x={3.5} y={8} width={1.7} height={5.5} fill={C.accent} />
      <Rect x={8.15} y={8} width={1.7} height={5.5} fill={C.accent} />
      <Rect x={12.8} y={8} width={1.7} height={5.5} fill={C.accent} />
      <Rect x={2.5} y={14.2} width={13} height={1.6} fill={C.accent} rx={0.6} />
    </Svg>
  );
}

/** Flecha descendente para el callout (tono negativo). */
export function IconTrendDown() {
  return (
    <Svg width={15} height={15} viewBox="0 0 18 18">
      <Line x1={4} y1={5} x2={14} y2={13} stroke={C.accent} strokeWidth={1.6} />
      <Polyline
        points="9,13 14,13 14,8"
        stroke={C.accent}
        strokeWidth={1.6}
        fill="none"
      />
    </Svg>
  );
}

/** El "%" sí existe en Helvetica (ASCII) → Text es más nítido que un SVG. */
export function IconPercent() {
  return (
    <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.accent }}>%</Text>
  );
}

// ───────────────────────── Cabecera de marca ─────────────────────────

export interface HeaderMeta {
  label: string;
  value: string;
}

export function BrandHeader({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle: string;
  meta: HeaderMeta[];
}) {
  return (
    <View style={s.header} fixed={false}>
      <View style={s.brandLockup}>
        {/* Logo de marca (only-g-logo-mascara RECORTADO: mismo blanco, sin el 33%
            de margen transparente izquierdo que lo hacía verse "centrado"). react-pdf
            Image genera PDF (no DOM) y su tipo no acepta `alt`; la regla no aplica. */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src="/only-g-logo-lockup.png" style={s.logo} />
        <View style={s.brandDivider} />
      </View>
      <View style={s.headerRight}>
        <Text style={s.docTitle}>{title}</Text>
        <Text style={s.docSub}>{subtitle}</Text>
        {meta.map((m) => (
          <Text key={m.label} style={s.metaLine}>
            <Text style={s.metaStrong}>{m.label} </Text>
            {m.value}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ───────────────────────── Pie fijo ─────────────────────────

export function Footer({ copy, note }: { copy: string; note: string }) {
  return (
    <View style={s.footer} fixed>
      <View>
        <Text style={s.footerCopy}>{copy}</Text>
        <Text style={s.footerNote}>{note}</Text>
      </View>
      <Text
        style={s.footerPage}
        render={({ pageNumber, totalPages }) =>
          `${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

// ───────────────────────── Títulos de sección ─────────────────────────

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <View>
      <Text style={s.sectionTitle}>{children}</Text>
      <View style={s.sectionUnderline} />
    </View>
  );
}

// ───────────────────────── Stat cards ─────────────────────────

export interface StatItem {
  icon: ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}

export function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <View style={s.statRow}>
      {items.map((it) => (
        <View key={it.label} style={s.statCard}>
          <View style={s.iconCircle}>{it.icon}</View>
          <Text style={s.statLabel}>{it.label}</Text>
          <Text style={[s.statValue, it.valueColor ? { color: it.valueColor } : {}]}>
            {it.value}
          </Text>
          <View style={s.statAccentBar} />
        </View>
      ))}
    </View>
  );
}

// ───────────────────────── Gráfico de barras ─────────────────────────

export interface BarDatum {
  label: string;
  value: number;
  color: string;
  display: string;
}

export function Legend({ items }: { items: BarDatum[] }) {
  return (
    <View style={s.legendRow}>
      {items.map((it) => (
        <View key={it.label} style={s.legendItem}>
          <View style={[s.legendSwatch, { backgroundColor: it.color }]} />
          <Text style={s.legendText}>
            {it.label} <Text style={s.legendValue}>{it.display}</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

export function BarChart({
  data,
  axisMaxLabel,
}: {
  data: BarDatum[];
  axisMaxLabel: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View>
      {data.map((d) => {
        const pct = Math.max(2, Math.round((d.value / max) * 100));
        return (
          <View key={d.label} style={s.barRow}>
            <Text style={s.barLabel}>{d.label}</Text>
            <View style={s.barTrack}>
              <View
                style={[s.barFill, { width: `${pct}%`, backgroundColor: d.color }]}
              />
            </View>
            <Text style={s.barValue}>{d.display}</Text>
          </View>
        );
      })}
      <View style={s.axisRow}>
        <Text style={{ fontSize: 7, color: C.faint }}>0</Text>
        <Text style={{ fontSize: 7, color: C.faint, marginLeft: "auto" }}>
          {axisMaxLabel}
        </Text>
      </View>
    </View>
  );
}

// ───────────────────────── Callout ─────────────────────────

export function Callout({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={s.callout} wrap={false}>
      <View style={s.calloutIcon}>{icon}</View>
      <Text style={s.calloutText}>{children}</Text>
    </View>
  );
}

// ───────────────────────── Tabla paginable ─────────────────────────

export interface Column {
  header: string;
  flex: number;
  align?: "left" | "right";
  strong?: boolean;
}

export function Table({
  columns,
  rows,
  total,
  emptyLabel,
}: {
  columns: Column[];
  rows: string[][];
  total?: { label: string; value: string };
  emptyLabel: string;
}) {
  return (
    <View>
      {/* Cabecera de columnas: `fixed` → se repite en CADA página que abarque la
          tabla (patrón canónico de react-pdf; al no ser absolute, no se solapa). */}
      <View style={s.tableHead} fixed>
        {columns.map((c, i) => (
          <Text
            key={i}
            style={[
              s.th,
              { flex: c.flex, textAlign: c.align ?? "left" },
            ]}
          >
            {c.header}
          </Text>
        ))}
      </View>

      {rows.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>{emptyLabel}</Text>
        </View>
      ) : (
        rows.map((cells, ri) => (
          <View
            key={ri}
            style={[s.tr, ri % 2 === 1 ? { backgroundColor: C.zebra } : {}]}
            wrap={false}
          >
            {columns.map((c, ci) => (
              <Text
                key={ci}
                style={[
                  s.td,
                  { flex: c.flex, textAlign: c.align ?? "left" },
                  c.strong ? s.tdStrong : {},
                ]}
              >
                {cells[ci] ?? ""}
              </Text>
            ))}
          </View>
        ))
      )}

      {total && (
        <View style={s.totalRow} wrap={false}>
          <Text style={s.totalLabel}>{total.label}</Text>
          <Text style={s.totalValue}>{total.value}</Text>
        </View>
      )}
    </View>
  );
}

// ───────────────────────── Patrimonio (card de cierre) ─────────────────────────

export function PatrimonioCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={s.patrimonioCard} wrap={false}>
      <View style={s.iconCircle}>
        <IconBank />
      </View>
      <Text style={s.patrimonioLabel}>{label}</Text>
      <Text style={s.patrimonioValue}>{value}</Text>
    </View>
  );
}
