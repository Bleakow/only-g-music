"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import Image from "next/image";
import type { Artist } from "@/domain/artist";
import { getFeaturedProfiles } from "@/features/artists/lib/artist-profile-repo";
import { profileToArtist } from "@/features/artists/lib/profile-display";
import { UserMenu } from "@/features/auth/components/UserMenu";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { LanguageSwitcher } from "./LanguageSwitcher";
import styles from "./SiteMenu.module.css";

// `key` = clave del catálogo i18n (nav.*); el texto se resuelve con t().
const NAV = [
  { href: "/artistas", key: "artists" },
  { href: "/servicios", key: "services" },
  { href: "/producciones", key: "productions" },
  { href: "/eventos", key: "events" },
] as const;

export function SiteMenu() {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<Artist | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [featured, setFeatured] = useState<Artist[]>([]);
  const featuredLoaded = useRef(false);
  // Ruleta de destacados en móvil: índice del activo (cuya foto se ve abajo) +
  // dirección del último swipe (para animar la entrada de la foto).
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const touchY = useRef<number | null>(null);
  const wheelLock = useRef(false);
  const pathname = usePathname();
  const t = useTranslations("nav");

  const close = () => setOpen(false);

  // Tab activo según la ruta actual → persiste mientras el usuario está en ella.
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const featuredActive = pathname === "/";

  // Vuelve al logo al cerrar; al abrir, la ruleta arranca en el primero.
  useEffect(() => {
    if (!open) setHovered(null);
    else setActiveIndex(0);
  }, [open]);

  // Si cambian los destacados (semilla → reales), la ruleta vuelve al primero.
  useEffect(() => setActiveIndex(0), [featured]);

  // Carga los destacados REALES (curados por el admin) la primera vez que se
  // abre el menú — lazy, para no leer Firestore en cada página. Fallback: semilla.
  useEffect(() => {
    if (!open || featuredLoaded.current) return;
    featuredLoaded.current = true;
    getFeaturedProfiles()
      .then((p) => {
        if (p.length) setFeatured(p.map(profileToArtist));
      })
      .catch(() => {
        /* sin destacados reales o sin red: se queda la semilla */
      });
  }, [open]);

  // Red de seguridad: al cambiar de ruta, desbloquea el scroll del fondo.
  useEffect(() => {
    document.body.style.overflow = "";
  }, [pathname]);

  // Bloquea el scroll del fondo solo mientras está abierto.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // El visor de fotos (lightbox) pide ocultar el menú y el perfil mientras está
  // abierto, para no estorbar sobre la foto a pantalla completa.
  useEffect(() => {
    const onViewer = (e: Event) =>
      setViewerOpen((e as CustomEvent<boolean>).detail);
    window.addEventListener("ogm:viewer", onViewer as EventListener);
    return () =>
      window.removeEventListener("ogm:viewer", onViewer as EventListener);
  }, []);

  // Escape para cerrar.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Ruleta de destacados (móvil): avanza/retrocede un destacado, con loop. Sin
  // efecto si hay menos de 2 (no hay entre qué alternar).
  const cycle = (dir: 1 | -1) => {
    if (featured.length < 2) return;
    setSlideDir(dir);
    setActiveIndex((i) => (i + dir + featured.length) % featured.length);
  };

  return (
    <>
      {/* Botón único: muta hamburguesa <-> X. Vive por encima del overlay.
          Se oculta mientras el visor de fotos está abierto. */}
      {!viewerOpen && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? t("closeMenu") : t("openMenu")}
          aria-expanded={open}
          className={`${styles.toggle} ${open ? styles.toggleOpen : ""}`}
        >
          <span />
          <span />
          <span />
        </button>
      )}

      {/* Campanita + menú de cuenta (avatar/login). Ocultos cuando el menú grande
          o el visor de fotos están abiertos. */}
      {!open && !viewerOpen && (
        <>
          <NotificationBell />
          <UserMenu />
        </>
      )}

      <div className={`${styles.overlay} ${open ? styles.open : ""}`}>
        {/* Izquierda: preview — imagen del menú por defecto, foto del destacado al hover */}
        <div className={styles.preview} aria-hidden="true">
          <Image
            src="/logo/logo-white.png"
            alt=""
            width={540}
            height={360}
            className={`${styles.logo} ${hovered ? styles.logoHidden : ""}`}
          />
          {hovered && (
            <img
              key={hovered.slug}
              src={hovered.image}
              alt=""
              className={styles.previewImg}
            />
          )}
        </div>

        {/* Derecha: panel desplegable */}
        <aside
          className={styles.panel}
          role="dialog"
          aria-modal="true"
          aria-label={t("menuLabel")}
          aria-hidden={!open}
          /* Ruleta de destacados (móvil): el gesto vale en TODO el panel (no solo
             sobre la foto) — deslizá arriba/abajo. Un swipe = un paso, con umbral
             (no muy sensible). La rueda/trackpad también cicla (throttle). */
          onTouchStart={(e) => (touchY.current = e.touches[0].clientY)}
          onTouchEnd={(e) => {
            if (touchY.current === null) return;
            const dy = e.changedTouches[0].clientY - touchY.current;
            touchY.current = null;
            if (Math.abs(dy) < 45) return; // umbral
            cycle(dy < 0 ? 1 : -1); // arriba = siguiente
          }}
          onWheel={(e) => {
            if (Math.abs(e.deltaY) < 8 || wheelLock.current) return;
            wheelLock.current = true;
            window.setTimeout(() => (wheelLock.current = false), 450);
            cycle(e.deltaY > 0 ? 1 : -1);
          }}
        >
          {/* Foto del destacado ACTIVO (60% inferior) — SOLO móvil. El nombre va
              en la lista de arriba; aquí solo la imagen (cambia con el gesto). */}
          <div className={styles.mobilePhoto} aria-hidden="true">
            {featured[activeIndex] && (
              <div
                key={`${featured[activeIndex].slug}-${slideDir}`}
                className={`${styles.mPhotoSlide} ${
                  slideDir === 1 ? styles.slideUp : styles.slideDown
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featured[activeIndex].image}
                  alt=""
                  className={styles.mobilePhotoImg}
                />
              </div>
            )}
          </div>

          <div className={styles.panelTop}>
            <nav className={styles.tabs}>
              <Link
                href="/"
                onClick={close}
                className={featuredActive ? styles.tabActive : styles.tab}
                aria-current={featuredActive ? "page" : undefined}
              >
                {t("featured")}
              </Link>
              {NAV.map((n) => {
                const active = isActive(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={close}
                    className={active ? styles.tabActive : styles.tab}
                    aria-current={active ? "page" : undefined}
                  >
                    {t(n.key)}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className={styles.panelBody}>
            <ul className={styles.list}>
              {featured.slice(0, 4).map((a, i) => (
                <li key={a.slug}>
                  <Link
                    href={`/artistas/${a.slug}`}
                    onClick={close}
                    onMouseEnter={() => setHovered(a)}
                    onMouseLeave={() => setHovered(null)}
                    className={`${styles.item} ${
                      i === activeIndex ? styles.itemActive : ""
                    }`}
                  >
                    {a.name}
                  </Link>
                </li>
              ))}
              {featured.length === 0 && (
                <li className={styles.empty}>{t("empty")}</li>
              )}
            </ul>
          </div>

          <div className={styles.panelFoot}>
            <Link href="/" onClick={close} className={styles.homeLink}>
              {t("home")}
            </Link>
            <LanguageSwitcher />
          </div>
        </aside>
      </div>
    </>
  );
}
