"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ARTES_AUTOSERVICIO,
  esArteAutoservicio,
  TALENT_ROLES,
  type Role,
} from "@only-g/shared-types/user";
import {
  CONVENIO_TIPOS,
  convenioPendiente,
  type ConvenioRequest,
  type ConvenioTipo,
} from "@only-g/shared-types/convenio";
import type { SectionPrefs } from "@only-g/shared-types/profile-sections";
import {
  perfilVisible,
  type ArtistProfile,
} from "@only-g/shared-types/artist-profile";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { Alert } from "@/components/ui/Alert";
import { GlassModal } from "@/components/ui/GlassModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";
import {
  ActivityIcon,
  CheckIcon,
  ClockIcon,
  CrownIcon,
  DiscIcon,
  ImageIcon,
  InfoIcon,
  MicIcon,
  MusicIcon,
  ShoppingBagIcon,
  SlidersIcon,
} from "@/components/icons";
import { getProfileBySlug, updateProfile } from "../../lib/artist-profile-repo";
import { actualizarMisArtes } from "../../lib/artes-repo";
import {
  createConvenioRequest,
  listMyConvenios,
} from "@/features/convenios/lib/convenio-repo";
import { SectionManager } from "../profile/SectionManager";

/**
 * "Perfiles y convenios" — §06 del OGM.pen (frame `sdWn5`, "Convenios — Panel").
 *
 * Estructura tomada del mockup, en este orden y por esta razón:
 *   1. EXPLAINER — por qué existen dos clases de perfil. Va primero porque toda
 *      la pantalla se entiende o no se entiende con esa frase.
 *   2. TUS CONVENIOS — lo que ya pediste, con su estado. Solo si hay algo.
 *   3. SOLICITAR — tarjeta por cada convenio que aún puedes pedir.
 *   4. PERFILES LIBRES — los que se encienden solos, en una tarjeta destacada
 *      con la banda de membresía (crear es gratis; PUBLICAR necesita membresía).
 *   5. SECCIONES — añadido nuestro, no está en §06: el gestor de §05 embebido
 *      para poder marcar y desmarcar sin entrar al modo edición.
 */

const ARTE_ICON: Partial<Record<Role, typeof MusicIcon>> = {
  artista: MicIcon,
  dj: DiscIcon,
  bailarin: ActivityIcon,
  presentador: MusicIcon,
  beatmaker: ShoppingBagIcon,
  productor: SlidersIcon,
  modelo: ImageIcon,
};

/** En qué punto está un convenio para este usuario. */
type EstadoConvenio = "activo" | "revision" | "rechazado" | "disponible";

function estadoDe(
  tipo: ConvenioTipo,
  roles: Role[],
  solicitudes: ConvenioRequest[],
): { estado: EstadoConvenio; solicitud?: ConvenioRequest } {
  if (roles.includes(tipo as Role)) return { estado: "activo" };
  // Las solicitudes llegan de más nueva a más vieja: la primera que coincide es
  // la que manda, para que un rechazo viejo no tape una petición nueva.
  const solicitud = solicitudes.find((s) => s.tipo === tipo);
  if (convenioPendiente(solicitud)) return { estado: "revision", solicitud };
  if (solicitud?.estado === "rechazada") {
    return { estado: "rechazado", solicitud };
  }
  return { estado: "disponible", solicitud };
}

export function PerfilesConvenios() {
  const t = useTranslations();
  const { user, account, refreshAccount } = useAuth();

  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [solicitudes, setSolicitudes] = useState<ConvenioRequest[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<Role | null>(null);
  const [pidiendo, setPidiendo] = useState<ConvenioTipo | null>(null);

  const slug = account?.artistSlug;

  const cargar = useCallback(async () => {
    if (!user) return;
    setCargando(true);
    try {
      const [p, s] = await Promise.all([
        slug ? getProfileBySlug(slug) : Promise.resolve(null),
        listMyConvenios(user.uid),
      ]);
      setProfile(p);
      setSolicitudes(s);
    } catch (e) {
      console.error("[perfiles] carga:", e);
      setError(t("perfilesConvenios.errors.load"));
    } finally {
      setCargando(false);
    }
  }, [user, slug, t]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const roles = (account?.roles ?? []) as Role[];
  // Artes activas: las disciplinas del perfil; sin perfil aún, los roles de
  // talento de la cuenta (se pueden elegir antes de crearlo).
  const activas: Role[] =
    profile?.disciplines ?? roles.filter((r) => TALENT_ROLES.includes(r));

  const conEstado = CONVENIO_TIPOS.map((tipo) => ({
    tipo,
    ...estadoDe(tipo, roles, solicitudes),
  }));
  const mios = conEstado.filter((c) => c.estado !== "disponible");
  const pedibles = conEstado.filter(
    (c) => c.estado === "disponible" || c.estado === "rechazado",
  );

  async function alternarArte(arte: Role, encender: boolean) {
    if (!esArteAutoservicio(arte)) return;
    setGuardando(arte);
    setError(null);
    const libres = activas.filter(esArteAutoservicio);
    const siguientes = encender
      ? [...new Set([...libres, arte])]
      : libres.filter((r) => r !== arte);
    try {
      const disciplines = await actualizarMisArtes(siguientes);
      setProfile((p) => (p ? { ...p, disciplines } : p));
      // Los roles de la cuenta también cambiaron: sin refrescarlos, el menú y
      // los gates de la app seguirían con la foto vieja hasta recargar.
      await refreshAccount();
    } catch (e) {
      console.error("[perfiles] artes:", e);
      setError(
        e instanceof Error && e.message
          ? e.message
          : t("perfilesConvenios.errors.save"),
      );
    } finally {
      setGuardando(null);
    }
  }

  async function pedirConvenio(tipo: ConvenioTipo, mensaje: string) {
    if (!user) return;
    await createConvenioRequest({
      uid: user.uid,
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      tipo,
      mensaje: mensaje.trim() || undefined,
    });
    setPidiendo(null);
    await cargar();
  }

  async function guardarSecciones(prefs: SectionPrefs) {
    if (!slug || !profile) return;
    setProfile({ ...profile, sectionPrefs: prefs });
    try {
      await updateProfile(slug, { sectionPrefs: prefs });
    } catch (e) {
      console.error("[perfiles] secciones:", e);
      setError(t("perfilesConvenios.errors.save"));
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-6 pt-28 pb-24 sm:px-8">
      <p className="text-amethyst-300 text-sm tracking-[4px] uppercase">
        {t("perfilesConvenios.eyebrow")}
      </p>
      <h1 className="font-narrow mt-2 text-5xl font-bold uppercase sm:text-6xl">
        {t("perfilesConvenios.title")}
      </h1>

      {/* Explainer (§06): la frase que explica toda la pantalla. */}
      <div className="border-amethyst-300/20 bg-amethyst-500/5 mt-6 flex items-center gap-4 rounded-2xl border p-5">
        <span className="border-amethyst-300/25 bg-amethyst-500/15 text-amethyst-300 grid size-11 shrink-0 place-items-center rounded-xl border">
          <InfoIcon className="size-5" />
        </span>
        <p className="text-silver-300 text-sm leading-relaxed">
          {t("perfilesConvenios.explainer")}
        </p>
      </div>

      {error && <Alert className="mt-6">{error}</Alert>}

      {cargando ? (
        <div className="mt-12 flex flex-col gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      ) : (
        <>
          {mios.length > 0 && (
            <Seccion title={t("perfilesConvenios.misConveniosTitle")}>
              <div className="flex flex-col gap-3">
                {mios.map(({ tipo, estado, solicitud }) => (
                  <ConvenioRow
                    key={tipo}
                    tipo={tipo}
                    estado={estado}
                    solicitud={solicitud}
                  />
                ))}
              </div>
            </Seccion>
          )}

          {pedibles.length > 0 && (
            <Seccion title={t("perfilesConvenios.solicitarTitle")}>
              <div className="grid gap-5 md:grid-cols-3">
                {pedibles.map(({ tipo }) => (
                  <ConvenioCard
                    key={tipo}
                    tipo={tipo}
                    destacado={tipo === "modelo"}
                    onPedir={() => setPidiendo(tipo)}
                  />
                ))}
              </div>
            </Seccion>
          )}

          {/* Perfiles libres: una sola tarjeta destacada, como en el mockup. */}
          <section className="mt-12">
            {/* El degradado del mockup (#3b0764 → #171326) resulta ser
                amethyst-900 → ink-panel: mismos tokens, no valores sueltos. */}
            <div className="border-amethyst-300/35 from-amethyst-900 to-ink-panel rounded-3xl border bg-linear-to-bl p-7 shadow-[0_10px_34px_rgba(59,7,100,0.4)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-narrow text-2xl font-bold tracking-wide text-white uppercase">
                    {t("perfilesConvenios.libresTitle")}
                  </h2>
                  <p className="text-silver-300 mt-1 text-sm">
                    {t("perfilesConvenios.libresHint")}
                  </p>
                </div>
                <span className="border-success/35 bg-success/10 text-success inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-bold tracking-[1px] uppercase">
                  <CheckIcon className="size-3.5" />
                  {t("perfilesConvenios.sinComision")}
                </span>
              </div>

              <div className="mt-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                {ARTES_AUTOSERVICIO.map((arte) => (
                  <ArteLibre
                    key={arte}
                    arte={arte}
                    activa={activas.includes(arte)}
                    ocupada={guardando === arte}
                    onToggle={(v) => alternarArte(arte, v)}
                  />
                ))}
              </div>

              <BandaMembresia profile={profile} />
            </div>
          </section>

          <Seccion title={t("perfilesConvenios.seccionesTitle")}>
            <p className="text-silver-400 -mt-3 mb-5 text-sm leading-relaxed">
              {t("perfilesConvenios.seccionesHint")}
            </p>
            {profile ? (
              <SectionManager
                disciplines={activas}
                prefs={profile.sectionPrefs}
                onChange={guardarSecciones}
              />
            ) : (
              <div className={`${glassSurfaceSoft} rounded-[18px] p-6`}>
                <GlassSheen />
                <p className="text-silver-300 relative text-sm">
                  {t("perfilesConvenios.sinPerfil")}
                </p>
                <Link
                  href="/artista/nuevo"
                  className="btn-amethyst relative mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-xs font-semibold tracking-[1px] uppercase"
                >
                  {t("perfilesConvenios.crearPerfil")}
                </Link>
              </div>
            )}
          </Seccion>
        </>
      )}

      <PedirConvenioModal
        tipo={pidiendo}
        onClose={() => setPidiendo(null)}
        onSend={pedirConvenio}
      />
    </main>
  );
}

function Seccion({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-narrow mb-5 text-2xl font-bold tracking-wide text-white uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Fila de un convenio que ya pediste, con su estado. */
function ConvenioRow({
  tipo,
  estado,
  solicitud,
}: {
  tipo: ConvenioTipo;
  estado: EstadoConvenio;
  solicitud?: ConvenioRequest;
}) {
  const t = useTranslations();
  const Icon = ARTE_ICON[tipo as Role] ?? MusicIcon;
  const activo = estado === "activo";
  return (
    <div className="bg-ink-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 px-6 py-5">
      <div className="flex min-w-0 items-center gap-4">
        <span className="border-amethyst-300/25 bg-amethyst-500/10 text-amethyst-300 grid size-13 shrink-0 place-items-center rounded-[13px] border">
          <Icon className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="font-narrow text-lg font-bold tracking-wide text-white">
            {t(`roles.${tipo}`)}
          </p>
          <p className="text-silver-400 text-sm">
            {estado === "rechazado" && solicitud?.motivo
              ? t("perfilesConvenios.estado.rechazadoMotivo", {
                  motivo: solicitud.motivo,
                })
              : t(`perfilesConvenios.estado.${estado}`)}
          </p>
        </div>
      </div>
      <span
        className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-bold tracking-[1px] uppercase ${
          activo
            ? "border-success/35 bg-success/10 text-success"
            : "border-warning/40 bg-warning/10 text-warning"
        }`}
      >
        {activo ? (
          <CheckIcon className="size-3.5" />
        ) : (
          <ClockIcon className="size-3.5" />
        )}
        {t(`perfilesConvenios.chip.${estado}`)}
      </span>
    </div>
  );
}

/** Tarjeta de un convenio que puedes solicitar. */
function ConvenioCard({
  tipo,
  destacado,
  onPedir,
}: {
  tipo: ConvenioTipo;
  destacado: boolean;
  onPedir: () => void;
}) {
  const t = useTranslations();
  const Icon = ARTE_ICON[tipo as Role] ?? MusicIcon;
  return (
    <div
      className={`bg-ink-panel flex flex-col gap-4 rounded-[18px] border p-6 ${
        destacado ? "border-amethyst-300/35" : "border-white/10"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="border-amethyst-300/25 bg-amethyst-500/10 text-amethyst-300 grid size-11 shrink-0 place-items-center rounded-xl border">
          <Icon className="size-5" />
        </span>
        <h3 className="font-narrow text-xl font-bold tracking-wide text-white uppercase">
          {t(`roles.${tipo}`)}
        </h3>
      </div>
      <p className="text-silver-300 flex-1 text-sm leading-relaxed">
        {t(`perfilesConvenios.convenio.${tipo}`)}
      </p>
      {/* El mockup enseña aquí un porcentaje fijo de comisión. Se deja FUERA a
          propósito: la comisión se pacta en el convenio, así que un número en
          pantalla antes de firmarlo sería una promesa que no podemos sostener.
          (Además, las comisiones reales viven en `comercialConfig/comisiones`,
          que solo el CEO puede leer.) */}
      <p className="text-silver-400 text-xs leading-relaxed">
        {t("perfilesConvenios.comisionNota")}
      </p>
      <button
        type="button"
        onClick={onPedir}
        className={`flex min-h-11 w-full items-center justify-center rounded-xl text-xs font-bold tracking-[1px] uppercase ${
          destacado
            ? "btn-amethyst"
            : "text-silver-100 border border-white/15 bg-white/[0.03] transition hover:border-white/35 hover:text-white"
        }`}
      >
        {t("perfilesConvenios.pedir")}
      </button>
    </div>
  );
}

/** Perfil libre: se enciende y se apaga aquí mismo. */
function ArteLibre({
  arte,
  activa,
  ocupada,
  onToggle,
}: {
  arte: Role;
  activa: boolean;
  ocupada: boolean;
  onToggle: (value: boolean) => void;
}) {
  const t = useTranslations();
  const Icon = ARTE_ICON[arte] ?? MusicIcon;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activa}
      disabled={ocupada}
      onClick={() => onToggle(!activa)}
      className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 text-left transition disabled:opacity-50 ${
        activa
          ? "border-amethyst-300/60 bg-amethyst-500/15"
          : "border-white/15 bg-white/[0.03] hover:border-white/35"
      }`}
    >
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-[11px] border ${
          activa
            ? "border-amethyst-300/60 bg-amethyst-500/20 text-amethyst-200"
            : "text-silver-400 border-white/15 bg-white/[0.04]"
        }`}
      >
        <Icon className="size-5" />
      </span>
      <span className="font-narrow min-w-0 flex-1 truncate text-base font-bold tracking-wide text-white">
        {t(`roles.${arte}`)}
      </span>
      {activa && (
        <CheckIcon className="text-amethyst-200 size-4 shrink-0" aria-hidden />
      )}
    </button>
  );
}

/**
 * Banda de membresía (§06): crear un perfil libre es gratis, PUBLICARLO no.
 * Es la aclaración que evita el "lo activé y no aparezco en la lista".
 */
function BandaMembresia({ profile }: { profile: ArtistProfile | null }) {
  const t = useTranslations();
  const publicado = profile
    ? perfilVisible({ premium: profile.premium, socio: profile.socio }, Date.now())
    : false;
  return (
    <div className="border-warning/35 bg-warning/5 mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5">
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="border-warning/40 bg-warning/15 text-warning grid size-11 shrink-0 place-items-center rounded-xl border">
          <CrownIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-narrow text-base font-bold tracking-wide text-white uppercase">
            {t("perfilesConvenios.membresiaTitle")}
          </p>
          <p className="text-silver-300 text-sm leading-relaxed">
            {t("perfilesConvenios.membresiaHint")}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {publicado && (
          <span className="border-success/35 bg-success/10 text-success inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-bold tracking-[1px] uppercase">
            <CheckIcon className="size-3.5" />
            {t("perfilesConvenios.membresiaActiva")}
          </span>
        )}
        <Link
          href="/suscripciones"
          className={`${glassSurfaceSoft} inline-flex min-h-11 items-center rounded-full px-5 text-xs font-bold tracking-[1px] text-white uppercase`}
        >
          <GlassSheen />
          <span className="relative">{t("perfilesConvenios.gestionar")}</span>
        </Link>
      </div>
    </div>
  );
}

/** Formulario mínimo de solicitud: solo hace falta contar quién eres. */
function PedirConvenioModal({
  tipo,
  onClose,
  onSend,
}: {
  tipo: ConvenioTipo | null;
  onClose: () => void;
  onSend: (tipo: ConvenioTipo, mensaje: string) => Promise<void>;
}) {
  const t = useTranslations();
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vacía el borrador al cambiar de tipo: si no, el texto escrito para pedir
  // "modelo" reaparecería al abrir la solicitud de "beatmaker".
  useEffect(() => {
    setMensaje("");
    setError(null);
  }, [tipo]);

  async function enviar() {
    if (!tipo) return;
    setEnviando(true);
    setError(null);
    try {
      await onSend(tipo, mensaje);
    } catch (e) {
      console.error("[perfiles] convenio:", e);
      setError(t("perfilesConvenios.errors.send"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <GlassModal
      open={tipo !== null}
      onClose={onClose}
      title={
        tipo
          ? t("perfilesConvenios.pedirTitle", { arte: t(`roles.${tipo}`) })
          : undefined
      }
    >
      <p className="text-silver-300 text-sm leading-relaxed">
        {tipo && t(`perfilesConvenios.pedirHint.${tipo}`)}
      </p>
      <textarea
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        rows={4}
        maxLength={600}
        placeholder={t("perfilesConvenios.pedirPlaceholder")}
        className="focus:border-amethyst-300/50 mt-4 w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-base text-white placeholder:text-white/30 focus:outline-none"
      />
      {error && <Alert className="mt-3">{error}</Alert>}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-silver-300 min-h-11 rounded-full px-5 text-xs font-semibold tracking-[1px] uppercase transition hover:text-white"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={enviar}
          disabled={enviando}
          className="btn-amethyst min-h-11 rounded-full px-6 text-xs font-semibold tracking-[1px] uppercase disabled:opacity-60"
        >
          {enviando
            ? t("perfilesConvenios.enviando")
            : t("perfilesConvenios.enviar")}
        </button>
      </div>
    </GlassModal>
  );
}
