"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "./AuthProvider";
import { hasAnyRole, hasRole } from "@only-g/shared-types/user";
import { glassSurfaceMenu, GlassSheen } from "@/components/ui/glass";
import { Avatar } from "@/components/ui/Avatar";
import {
  ShieldCheckIcon,
  UserRoundIcon,
  AudioLinesIcon,
  CalendarIcon,
  WalletIcon,
  FileCheckIcon,
  CrownIcon,
  LogOutIcon,
  InboxIcon,
  MusicIcon,
  UserPlusIcon,
  SettingsIcon,
} from "@/components/icons";

/** Posición fija en el extremo IZQUIERDO, a la derecha de la campanita. El menú
 *  hamburguesa vive en el lado opuesto (derecha). El panel abre hacia adentro
 *  (derecha); por eso su anclaje y el origen del reveal van a la izquierda. */
const WRAP_LEFT = "fixed top-4 left-[5.5rem] z-[105] sm:top-5 sm:left-28";
const WRAP_RIGHT = "fixed top-4 right-[5.5rem] z-[105] sm:top-5 sm:right-28";
// Sin sesión NO hay campanita → el avatar ocupa el sitio de la campanita (el
// borde), no el desplazado. Debe coincidir con los WRAP_* de NotificationBell.
const EDGE_LEFT = "fixed top-4 left-6 z-[105] sm:top-5 sm:left-12";
const EDGE_RIGHT = "fixed top-4 right-6 z-[105] sm:top-5 sm:right-12";

/** Envuelve el panel en un portal a <body> cuando `portal` es true (dock), para
 *  sacarlo del `backdrop-filter` de la cápsula (un backdrop-filter anidado dentro
 *  de otro queda anulado); si no, lo deja en su sitio. */
function maybePortal(node: ReactNode, portal: boolean) {
  if (!portal) return node;
  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}

/** Cabecera de sección del menú (GESTIÓN / CUENTA). Estructura tomada del diseño. */
function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-silver-500 px-3 pt-3 pb-1 text-[0.6rem] font-semibold tracking-[0.18em] uppercase">
      {children}
    </p>
  );
}

/** Ítem del menú: icono + etiqueta. `highlight` = ítem destacado (amatista);
 *  el resto usa borde sutil + barrido amatista en hover (legible sobre foto). */
function MenuLink({
  href,
  icon: Icon,
  label,
  onClose,
  highlight = false,
}: {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  onClose: () => void;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className={`group flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-[0.84rem] transition-all duration-200 ${
        highlight
          ? "border-amethyst-300/40 bg-amethyst-500/10 hover:border-amethyst-300/70 hover:bg-amethyst-500/15 text-white"
          : "hover:border-amethyst-300/60 hover:from-amethyst-500/25 text-silver-100 border-white/15 hover:bg-gradient-to-r hover:to-transparent hover:pl-4 hover:text-white"
      }`}
    >
      <Icon
        className={`size-[17px] shrink-0 ${
          highlight
            ? "text-amethyst-300"
            : "text-silver-300 group-hover:text-silver-100"
        }`}
      />
      <span className="flex-1 truncate">{label}</span>
    </Link>
  );
}

export function UserMenu({
  align = "left",
  docked = false,
  avatarSize,
}: {
  align?: "left" | "right";
  /** En un dock: sin wrapper `fixed` ni trigger absoluto; el avatar vive en el
   *  flujo del contenedor y el panel cae DEBAJO (alineado según `align`). */
  docked?: boolean;
  /** Tamaño del avatar (dock desktop 34, dock móvil 44). Default: 34 en dock. */
  avatarSize?: number;
}) {
  const { user, account, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  // `render` mantiene el panel montado durante la animación de CIERRE (se
  // desmonta en onAnimationEnd). Cerrado ⇒ desmontado ⇒ no tapa la campanita.
  const [render, setRender] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // En el dock el panel se porta a <body>: guardamos su posición fija (desde el
  // trigger) para poder colocarlo fuera de la cápsula.
  const [coords, setCoords] = useState<{
    top: number;
    left?: number;
    right?: number;
  } | null>(null);
  const router = useRouter();
  const t = useTranslations();
  const close = () => setOpen(false);

  // Cerrar el dropdown al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // El panel puede vivir en un portal (fuera de `ref`): hay que ignorarlo
      // también, o cualquier clic dentro del menú lo cerraría.
      if (ref.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Al abrir, monta el panel de inmediato; el desmontaje lo hace onAnimationEnd
  // cuando la animación de cierre termina.
  useEffect(() => {
    if (open) setRender(true);
  }, [open]);

  // DOCK: el panel va por portal a <body>; su posición fija se calcula desde el
  // trigger (avatar). Se recalcula al abrir y ante resize/scroll.
  useEffect(() => {
    if (!docked || !open) return;
    const measure = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setCoords(
        align === "right"
          ? {
              top: r.bottom + 8,
              right: Math.max(8, window.innerWidth - r.right),
            }
          : { top: r.bottom + 8, left: r.left },
      );
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [docked, open, align]);

  if (loading) return null;

  const name = account?.displayName ?? user?.displayName ?? null;
  const email = account?.email ?? user?.email ?? null;
  const photo = account?.photoURL ?? user?.photoURL ?? null;
  const roles = account?.roles ?? [];

  async function onLogout() {
    await logout();
    setOpen(false);
    router.push("/");
  }

  // Con sesión: desplazado (deja sitio a la campanita). Sin sesión: en el borde.
  // En dock: sin `fixed`, vive en el flujo del contenedor.
  const wrap = docked
    ? "relative"
    : user
      ? align === "right"
        ? WRAP_RIGHT
        : WRAP_LEFT
      : align === "right"
        ? EDGE_RIGHT
        : EDGE_LEFT;

  // Padding de la cabecera: fuera del dock, el avatar del trigger FLOTA sobre el
  // panel (pl-16/pr-16 le reserva sitio). En dock, el avatar está en la cápsula,
  // así que el panel no necesita ese hueco.
  const headerPad = docked
    ? "text-left"
    : align === "right"
      ? "pr-16 text-right"
      : "pl-16 text-left";

  return (
    <div ref={ref} className={wrap}>
      {/* Trigger = el Avatar. Fuera del dock abre con un reveal circular desde su
          posición fija; en el dock queda en el flujo y el panel cae debajo. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={user ? t("userMenu.account") : t("userMenu.access")}
        aria-expanded={open}
        className={`focus-visible:ring-amethyst-300 z-20 rounded-full transition hover:scale-105 focus-visible:ring-2 focus-visible:outline-none ${
          docked
            ? "relative flex size-11 items-center justify-center"
            : `absolute top-0 ${align === "right" ? "right-0" : "left-0"}`
        }`}
      >
        <Avatar
          src={user ? photo : null}
          name={user ? name : null}
          email={user ? email : null}
          size={avatarSize ?? (docked ? 34 : 44)}
        />
      </button>

      {/* Panel del menú. Se monta con `render` (sigue true durante el cierre) y se
          DESMONTA en onAnimationEnd. En el DOCK se RENDERIZA POR PORTAL a <body>:
          dentro de la cápsula (que tiene `backdrop-blur`) su propio
          `backdrop-filter` quedaría ANULADO (backdrop-filter anidado no difumina)
          y el texto no se leería. Fuera, el frost del dropdown funciona. En dock
          espera a tener `coords` (posición fija medida desde el trigger). */}
      {render &&
        (!docked || !!coords) &&
        maybePortal(
          <div
            ref={panelRef}
            inert={!open}
            onAnimationEnd={(e) => {
              if (e.target === e.currentTarget && !open) setRender(false);
            }}
            // Posición forzada por estilo inline (glassSurfaceMenu trae `relative`):
            // dock → `fixed` en las coords del trigger (portal); si no → `absolute`.
            // El `backdropFilter` inline SUBE el frost (gana a `backdrop-blur-md`
            // del token, sin conflicto de clases) para que las letras se lean.
            style={
              docked
                ? {
                    position: "fixed",
                    top: coords?.top,
                    left: coords?.left,
                    right: coords?.right,
                    backdropFilter: "blur(22px) saturate(140%)",
                    WebkitBackdropFilter: "blur(22px) saturate(140%)",
                  }
                : {
                    position: "absolute",
                    backdropFilter: "blur(22px) saturate(140%)",
                    WebkitBackdropFilter: "blur(22px) saturate(140%)",
                  }
            }
            className={`${glassSurfaceMenu} ${
              open
                ? docked
                  ? "animate-dock-reveal"
                  : align === "right"
                    ? "animate-menu-reveal-right"
                    : "animate-menu-reveal"
                : docked
                  ? "animate-dock-conceal pointer-events-none"
                  : align === "right"
                    ? "animate-menu-conceal-right pointer-events-none"
                    : "animate-menu-conceal pointer-events-none"
            } w-64 overflow-hidden rounded-2xl ${
              docked
                ? `z-[120] ${align === "right" ? "origin-top-right" : "origin-top-left"}`
                : `absolute top-[-1rem] ${align === "right" ? "right-[-1rem]" : "left-[-1rem]"}`
            }`}
          >
            {/* Velo oscuro sutil: baja la luminancia del fondo para que el texto
              blanco contraste (el blur difumina, pero no oscurece). Va DEBAJO del
              sheen/gloss y del contenido. */}
            <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black/20" />
            <GlassSheen />
            {/* Gloss superior extra (más brillo de cristal). */}
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/15 to-transparent" />
            {/* Sombra de texto heredada: las letras despegan del fondo. */}
            <div className="relative [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
              {user ? (
                <>
                  <div className={`border-b border-white/10 p-4 ${headerPad}`}>
                    <p className="truncate text-sm font-semibold text-white">
                      {name ?? t("userMenu.user")}
                    </p>
                    <p className="text-silver-300 truncate text-xs">{email}</p>
                  </div>

                  {roles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-4 pt-3">
                      {roles.map((r) => (
                        <span
                          key={r}
                          className="border-amethyst-300/40 bg-amethyst-500/10 text-amethyst-200 rounded-full border px-2 py-0.5 text-[0.65rem] tracking-wide uppercase"
                        >
                          {t(`roles.${r}`)}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col p-2.5">
                    {/* ── GESTIÓN (management, por rol) ── */}
                    <SectionLabel>{t("userMenu.sectionManage")}</SectionLabel>
                    <div className="flex flex-col gap-1.5">
                      {hasAnyRole(account, ["admin"]) && (
                        <MenuLink
                          href="/admin/convenios"
                          icon={FileCheckIcon}
                          label={t("userMenu.convenios")}
                          onClose={close}
                          highlight
                        />
                      )}
                      {hasAnyRole(account, ["admin"]) && (
                        <MenuLink
                          href="/admin"
                          icon={ShieldCheckIcon}
                          label={t("userMenu.adminPanel")}
                          onClose={close}
                        />
                      )}
                      {!hasAnyRole(account, ["admin"]) && (
                        <MenuLink
                          href="/solicitudes"
                          icon={InboxIcon}
                          label={t("userMenu.myRequests")}
                          onClose={close}
                        />
                      )}
                      {hasAnyRole(account, ["productor"]) && (
                        <MenuLink
                          href="/consola"
                          icon={AudioLinesIcon}
                          label={t("userMenu.console")}
                          onClose={close}
                        />
                      )}
                      {hasRole(account, "beatmaker") && (
                        <MenuLink
                          href="/beats/publicar"
                          icon={MusicIcon}
                          label={t("userMenu.myBeats")}
                          onClose={close}
                        />
                      )}
                      {hasAnyRole(account, ["productor", "admin"]) && (
                        <MenuLink
                          href="/disponibilidad"
                          icon={CalendarIcon}
                          label={t("userMenu.availability")}
                          onClose={close}
                        />
                      )}
                      {hasAnyRole(account, ["beatmaker", "productor"]) && (
                        <MenuLink
                          href="/mis-pagos"
                          icon={WalletIcon}
                          label={t("userMenu.myPayouts")}
                          onClose={close}
                        />
                      )}
                    </div>

                    {/* ── CUENTA (personal) ── */}
                    <SectionLabel>{t("userMenu.sectionAccount")}</SectionLabel>
                    <div className="flex flex-col gap-1.5">
                      {hasAnyRole(account, ["artista"]) ? (
                        <MenuLink
                          href={
                            account?.artistSlug
                              ? `/artistas/${account.artistSlug}`
                              : "/artista/perfil"
                          }
                          icon={UserRoundIcon}
                          label={t("userMenu.myArtistProfile")}
                          onClose={close}
                        />
                      ) : (
                        !hasAnyRole(account, ["admin"]) && (
                          <MenuLink
                            href="/artista/nuevo"
                            icon={UserPlusIcon}
                            label={t("userMenu.becomeArtist")}
                            onClose={close}
                          />
                        )
                      )}
                      <MenuLink
                        href="/suscripciones"
                        icon={CrownIcon}
                        label={t("userMenu.subscriptions")}
                        onClose={close}
                      />
                      <MenuLink
                        href="/cuenta"
                        icon={SettingsIcon}
                        label={t("userMenu.settings")}
                        onClose={close}
                      />
                    </div>

                    {/* Cerrar sesión — ítem propio al final (rojo). */}
                    <button
                      type="button"
                      onClick={onLogout}
                      className="group mt-2 flex items-center gap-2.5 rounded-[10px] border border-red-500/25 px-3 py-2.5 text-left text-[0.84rem] text-red-300 transition-all duration-200 hover:border-red-400/60 hover:bg-gradient-to-r hover:from-red-500/25 hover:to-transparent hover:text-red-200"
                    >
                      <LogOutIcon className="size-[17px] shrink-0" />
                      <span className="flex-1">{t("userMenu.logout")}</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={`border-b border-white/10 p-4 ${headerPad}`}>
                    <p className="text-sm font-semibold text-white">
                      {t("userMenu.guestTitle")}
                    </p>
                    <p className="text-silver-300 text-xs">
                      {t("userMenu.guestSubtitle")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 p-2.5">
                    <Link
                      href="/login?mode=register"
                      onClick={close}
                      className="from-silver-100 to-amethyst-300 text-ink block rounded-xl bg-gradient-to-r px-3 py-2.5 text-center text-sm font-semibold transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(139,92,246,0.6)]"
                    >
                      {t("auth.createAccount")}
                    </Link>
                    <Link
                      href="/login"
                      onClick={close}
                      className="text-silver-100 hover:border-amethyst-300/60 block rounded-xl border border-white/20 px-3 py-2.5 text-center text-sm font-semibold transition-all duration-200 hover:bg-white/5 hover:text-white"
                    >
                      {t("auth.login")}
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>,
          docked,
        )}
    </div>
  );
}
