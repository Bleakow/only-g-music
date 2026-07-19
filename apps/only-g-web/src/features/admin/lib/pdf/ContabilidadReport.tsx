/**
 * Documento react-pdf del INFORME CONTABLE premium. Portada (resumen financiero
 * + visión general con gráfico y callout) y, a continuación, UNA PÁGINA POR
 * SECCIÓN de detalle (gastos, bienes, pasivos): las listas largas paginan solas
 * sin quedar apretadas en un recuadro. Puramente presentacional — recibe el
 * modelo ya formateado y las etiquetas ya traducidas.
 */
import { Document, Page, View } from "@react-pdf/renderer";
import { C, s } from "./theme";
import {
  BrandHeader,
  Footer,
  SectionTitle,
  StatGrid,
  Legend,
  BarChart,
  Callout,
  Table,
  PatrimonioCard,
  IconIncome,
  IconExpense,
  IconProfit,
  IconPercent,
  IconTrendDown,
  type Column,
} from "./primitives";
import type { ContabilidadLabels, ContabilidadModel } from "./types";

const GASTO_COLS = (L: ContabilidadLabels): Column[] => [
  { header: L.colFecha, flex: 1.1 },
  { header: L.colConcepto, flex: 2.3, strong: true },
  { header: L.colCategoria, flex: 1.5 },
  { header: L.colMonto, flex: 1.4, align: "right" },
];

const VALOR_COLS = (L: ContabilidadLabels): Column[] => [
  { header: L.colConcepto, flex: 2.5, strong: true },
  { header: L.colCategoria, flex: 1.7 },
  { header: L.colValor, flex: 1.4, align: "right" },
];

export function ContabilidadReport({
  model,
  L,
}: {
  model: ContabilidadModel;
  L: ContabilidadLabels;
}) {
  const footer = <Footer copy={L.footerCopy} note={L.footerNote} />;

  return (
    <Document title={L.docTitle} author="Only G Music">
      {/* ── Portada: resumen + visión general ── */}
      <Page size="A4" style={s.page}>
        <BrandHeader
          title={L.docTitle}
          subtitle={L.brand}
          meta={[
            { label: L.periodoLabel, value: L.periodoValue },
            { label: L.generadoLabel, value: L.generadoValue },
          ]}
        />

        <SectionTitle>{L.resumen}</SectionTitle>
        <StatGrid
          items={[
            { icon: <IconIncome />, label: L.ingresos, value: model.ingresos },
            { icon: <IconExpense />, label: L.gastos, value: model.gastos },
            {
              icon: <IconProfit />,
              label: L.utilidad,
              value: model.utilidad.value,
              valueColor: model.utilidad.negative ? C.danger : C.success,
            },
            {
              icon: <IconPercent />,
              label: L.margen,
              value: model.margen.value,
              valueColor: model.margen.negative ? C.danger : C.success,
            },
          ]}
        />

        <View style={{ height: 24 }} />

        <SectionTitle>{L.vision}</SectionTitle>
        <View style={s.card}>
          <Legend
            items={[
              {
                label: L.ingresos,
                value: model.chart.ingresos,
                display: model.chart.ingresosDisplay,
                color: C.accent,
              },
              {
                label: L.gastos,
                value: model.chart.gastos,
                display: model.chart.gastosDisplay,
                color: C.faint,
              },
            ]}
          />
          <BarChart
            axisMaxLabel={model.chart.maxDisplay}
            data={[
              {
                label: L.ingresos,
                value: model.chart.ingresos,
                display: model.chart.ingresosDisplay,
                color: C.accent,
              },
              {
                label: L.gastos,
                value: model.chart.gastos,
                display: model.chart.gastosDisplay,
                color: C.faint,
              },
            ]}
          />
          <Callout icon={<IconTrendDown />}>{L.nota}</Callout>
        </View>

        {footer}
      </Page>

      {/* ── Detalle de gastos ── */}
      <Page size="A4" style={s.page}>
        <View style={s.pageHeading}>
          <SectionTitle>{L.detalleGastos}</SectionTitle>
        </View>
        <Table
          columns={GASTO_COLS(L)}
          rows={model.gastosRows}
          total={{ label: L.total, value: model.gastosTotal }}
          emptyLabel={L.sinGastos}
        />
        {footer}
      </Page>

      {/* ── Bienes (activos) ── */}
      <Page size="A4" style={s.page}>
        <View style={s.pageHeading}>
          <SectionTitle>{L.seccionBienes}</SectionTitle>
        </View>
        <Table
          columns={VALOR_COLS(L)}
          rows={model.bienesRows}
          total={{ label: L.totalActivos, value: model.bienesTotal }}
          emptyLabel={L.sinBienes}
        />
        {footer}
      </Page>

      {/* ── Pasivos + Patrimonio ── */}
      <Page size="A4" style={s.page}>
        <View style={s.pageHeading}>
          <SectionTitle>{L.seccionPasivos}</SectionTitle>
        </View>
        <Table
          columns={VALOR_COLS(L)}
          rows={model.pasivosRows}
          total={{ label: L.totalPasivos, value: model.pasivosTotal }}
          emptyLabel={L.sinPasivos}
        />
        <PatrimonioCard label={L.patrimonioNeto} value={model.patrimonio} />
        {footer}
      </Page>
    </Document>
  );
}
