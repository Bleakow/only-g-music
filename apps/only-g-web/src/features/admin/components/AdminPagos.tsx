"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { subscribePendingPayments } from "@/features/conversations/lib/conversations-repo";
import { openConversation } from "@/features/conversations/lib/open-conversation";
import { formatCOP } from "@only-g/shared-types/service";
import type { Conversation } from "@only-g/shared-types/conversation";
import { AdminPageHeader, adminCard, adminInner } from "./admin-ui";

/**
 * Lista de PAGOS PENDIENTES de revisión (chats de pago en `en_revision`). Cada
 * uno abre la burbuja en su conversación, donde el admin ve el comprobante y
 * confirma (botón en PagoPanel → Cloud Function confirmPayment).
 */
export function AdminPagos({ embedded = false }: { embedded?: boolean } = {}) {
  const t = useTranslations();
  const [pagos, setPagos] = useState<Conversation[]>([]);

  useEffect(() => subscribePendingPayments(setPagos), []);

  // Filas compartidas entre el uso embebido (pestaña de AdminContabilidad,
  // fuera de alcance de este rediseño) y la página standalone /admin/pagos.
  const rowClassName = embedded
    ? "border border-white/10 bg-white/[0.03]"
    : adminInner;

  const rows = pagos.map((c) => (
    <li key={c.id}>
      <button
        type="button"
        onClick={() => openConversation(c.id)}
        className={`hover:border-amethyst-300/50 flex w-full items-center justify-between gap-3 rounded-xl p-4 text-left transition ${rowClassName}`}
      >
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{c.ref?.id}</p>
          <p className="text-silver-400 text-sm">
            {formatCOP(c.pago?.monto ?? 0)}
            {c.pago?.metodo ? ` · ${t(`chat.metodos.${c.pago.metodo}`)}` : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs text-sky-200">
          {t("adminPagos.review")}
        </span>
      </button>
    </li>
  ));

  if (embedded) {
    return (
      <div>
        <h1 className="font-narrow mt-4 text-5xl font-bold uppercase sm:text-6xl">
          {t("adminPagos.title")}
        </h1>

        {pagos.length === 0 ? (
          <p className="text-silver-400 mt-10">{t("adminPagos.empty")}</p>
        ) : (
          <ul className="mt-8 flex flex-col gap-3">{rows}</ul>
        )}
      </div>
    );
  }

  return (
    <main className="pb-24">
      <AdminPageHeader
        eyebrow={t("adminDashboard.eyebrow")}
        title={t("adminPagos.title")}
      />

      <div className="px-6 sm:px-10">
        {pagos.length === 0 ? (
          <p className="text-silver-400">{t("adminPagos.empty")}</p>
        ) : (
          <div className={`${adminCard} p-5`}>
            <ul className="flex flex-col gap-3">{rows}</ul>
          </div>
        )}
      </div>
    </main>
  );
}
