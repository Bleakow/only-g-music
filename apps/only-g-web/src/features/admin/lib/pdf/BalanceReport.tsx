/**
 * Documento react-pdf del BALANCE GENERAL premium, unificado con el mismo sistema
 * visual del Informe. Portada (Activos · Pasivos · Patrimonio + ecuación) y una
 * página por sección de detalle (Activos, Pasivos) que paginan solas. La deuda a
 * socios (payouts) llega ya mezclada en las filas de pasivos desde el builder.
 */
import { Document, Page, View } from "@react-pdf/renderer";
import { C, s } from "./theme";
import {
  BrandHeader,
  Footer,
  SectionTitle,
  StatGrid,
  Callout,
  Table,
  PatrimonioCard,
  IconBank,
  IconExpense,
  IconProfit,
  IconPercent,
  type Column,
} from "./primitives";
import type { BalanceLabels, BalanceModel } from "./types";

const VALOR_COLS = (L: BalanceLabels): Column[] => [
  { header: L.colConcepto, flex: 2.5, strong: true },
  { header: L.colCategoria, flex: 1.7 },
  { header: L.colValor, flex: 1.4, align: "right" },
];

export function BalanceReport({
  model,
  L,
}: {
  model: BalanceModel;
  L: BalanceLabels;
}) {
  const footer = <Footer copy={L.footerCopy} note={L.footerNote} />;

  return (
    <Document title={L.docTitle} author="Only G Music">
      {/* ── Portada ── */}
      <Page size="A4" style={s.page}>
        <BrandHeader
          title={L.docTitle}
          subtitle={L.brand}
          meta={[{ label: L.generadoLabel, value: L.generadoValue }]}
        />

        <SectionTitle>{L.resumen}</SectionTitle>
        <StatGrid
          items={[
            { icon: <IconProfit />, label: L.assets, value: model.assets },
            { icon: <IconExpense />, label: L.liabilities, value: model.liabilities },
            {
              icon: <IconBank />,
              label: L.patrimonioNeto,
              value: model.patrimonio,
              valueColor: model.patrimonioNegative ? C.danger : C.accentDeep,
            },
          ]}
        />

        <Callout icon={<IconPercent />}>{L.ecuacion}</Callout>

        {footer}
      </Page>

      {/* ── Activos ── */}
      <Page size="A4" style={s.page}>
        <View style={s.pageHeading}>
          <SectionTitle>{L.seccionActivos}</SectionTitle>
        </View>
        <Table
          columns={VALOR_COLS(L)}
          rows={model.activosRows}
          total={{ label: L.totalActivos, value: model.totalActivos }}
          emptyLabel={L.sinActivos}
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
          total={{ label: L.totalPasivos, value: model.totalPasivos }}
          emptyLabel={L.sinPasivos}
        />
        <PatrimonioCard label={L.patrimonioNeto} value={model.patrimonio} />
        {footer}
      </Page>
    </Document>
  );
}
