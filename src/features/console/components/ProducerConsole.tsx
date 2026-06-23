"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/features/auth/components/AuthProvider";
import {
  subscribeSessionsByProductor,
  startSesion,
  endSesion,
} from "@/features/booking/lib/sessions-repo";
import {
  type Sesion,
  GRACIA_AUTO_INICIO_MIN,
  debeAutoIniciar,
} from "@/domain/booking";
import { badgeClass } from "@/features/solicitudes/lib/estados";
import { Button } from "@/components/ui/Button";

/** Formatea una duración en ms a `H:MM:SS` (o `M:SS` si < 1h). */
function fmtDur(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function fmtFecha(ms: number, locale: string): string {
  return new Date(ms).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ProducerConsole() {
  const { user } = useAuth();
  const t = useTranslations();
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number>(0);
  const autoStarting = useRef<Set<string>>(new Set());

  // Reloj que late cada segundo (temporizadores en vivo + chequeo de gracia).
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Suscripción en vivo a las sesiones del productor.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeSessionsByProductor(user.uid, (list) => {
      setSesiones(list);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  // Auto-inicio por gracia: si pasaron 30 min de la hora y sigue programada,
  // arranca sola (client-side, mientras la consola esté abierta — 14b lo hará
  // server-authoritative). El set evita disparos duplicados antes del snapshot.
  useEffect(() => {
    if (!now) return;
    for (const s of sesiones) {
      if (debeAutoIniciar(s, now) && !autoStarting.current.has(s.id)) {
        autoStarting.current.add(s.id);
        startSesion(s.id, now).catch(() => autoStarting.current.delete(s.id));
      }
    }
  }, [sesiones, now]);

  const activas = sesiones.filter(
    (s) => s.estado === "programada" || s.estado === "en_curso",
  );
  const historial = sesiones.filter(
    (s) => s.estado === "finalizada" || s.estado === "cancelada",
  );

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-6 pb-24 pt-28 sm:px-12">
      <p className="text-sm uppercase tracking-[4px] text-amethyst-300">
        {t("roles.productor")}
      </p>
      <h1 className="mt-2 font-narrow text-5xl font-bold uppercase sm:text-6xl">
        {t("userMenu.console")}
      </h1>
      <p className="mt-3 text-silver-300">
        {t("producerConsole.description", {
          graceMins: GRACIA_AUTO_INICIO_MIN,
        })}
      </p>

      {loading ? (
        <p className="mt-10 text-silver-300">{t("common.loading")}</p>
      ) : sesiones.length === 0 ? (
        <p className="mt-10 text-silver-400">
          {t("producerConsole.empty")}
        </p>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="font-narrow text-2xl font-bold uppercase text-white">
              {t("producerConsole.activeSection")}
            </h2>
            {activas.length === 0 ? (
              <p className="mt-2 text-silver-400">
                {t("producerConsole.nothingInQueue")}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {activas.map((s) => (
                  <SesionCard key={s.id} sesion={s} now={now} />
                ))}
              </ul>
            )}
          </section>

          {historial.length > 0 && (
            <section className="mt-10">
              <h2 className="font-narrow text-2xl font-bold uppercase text-white">
                {t("producerConsole.historySection")}
              </h2>
              <ul className="mt-4 flex flex-col gap-2">
                {historial.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-sm opacity-70"
                  >
                    <span className="min-w-0 truncate text-silver-200">
                      {s.serviceName}
                      {s.clientName ? ` · ${s.clientName}` : ""}
                    </span>
                    <span className="shrink-0 text-silver-400">
                      {s.estado === "finalizada" && s.startedAt && s.endedAt
                        ? fmtDur(s.endedAt - s.startedAt)
                        : t(`status.${s.estado}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function SesionCard({ sesion, now }: { sesion: Sesion; now: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);

  async function onStart() {
    setBusy(true);
    try {
      await startSesion(sesion.id, Date.now());
    } finally {
      setBusy(false);
    }
  }
  async function onEnd() {
    setBusy(true);
    try {
      await endSesion(sesion.id, Date.now());
    } finally {
      setBusy(false);
    }
  }

  const enCurso = sesion.estado === "en_curso";
  const graceAt = sesion.scheduledStart + GRACIA_AUTO_INICIO_MIN * 60_000;

  let aviso: string;
  if (enCurso) {
    aviso = t("producerConsole.avisoEnCurso", {
      dur: fmtDur(now - (sesion.startedAt ?? now)),
    });
  } else if (now < sesion.scheduledStart) {
    aviso = t("producerConsole.avisoProgramada", {
      fecha: fmtFecha(sesion.scheduledStart, locale),
    });
  } else if (now < graceAt) {
    aviso = t("producerConsole.avisoAutoInicia", {
      dur: fmtDur(graceAt - now),
    });
  } else {
    aviso = t("producerConsole.avisoIniciando");
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="min-w-0">
        <p className="truncate font-semibold text-white">
          {sesion.serviceName}
          {sesion.clientName ? (
            <span className="text-silver-400"> · {sesion.clientName}</span>
          ) : null}
        </p>
        <p
          className={`text-sm ${enCurso ? "font-semibold tabular-nums text-emerald-300" : "text-silver-400"}`}
        >
          {aviso}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs ${badgeClass(sesion.estado)}`}
        >
          {t(`status.${sesion.estado}`)}
        </span>
        {enCurso ? (
          <Button size="sm" variant="danger" onClick={onEnd} loading={busy}>
            {t("producerConsole.endButton")}
          </Button>
        ) : (
          <Button size="sm" onClick={onStart} loading={busy}>
            {t("producerConsole.startButton")}
          </Button>
        )}
      </div>
    </li>
  );
}
