"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { artists } from "@/features/artists/data/artists";
import type { Artist } from "@/domain/artist";
import { UserMenu } from "@/features/auth/components/UserMenu";
import styles from "./SiteMenu.module.css";

const featured = artists.filter((a) => a.featured);

const NAV = [
  { href: "/artistas", label: "Artistas" },
  { href: "/servicios", label: "Servicios" },
  { href: "/producciones", label: "Producciones" },
  { href: "/eventos", label: "Eventos" },
];

export function SiteMenu() {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<Artist | null>(null);
  const pathname = usePathname();

  const close = () => setOpen(false);

  // Tab activo según la ruta actual → persiste mientras el usuario está en ella.
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const featuredActive = pathname === "/";

  // Vuelve al logo al cerrar.
  useEffect(() => {
    if (!open) setHovered(null);
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

  // Escape para cerrar.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Botón único: muta hamburguesa <-> X. Vive por encima del overlay. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        className={`${styles.toggle} ${open ? styles.toggleOpen : ""}`}
      >
        <span />
        <span />
        <span />
      </button>

      {/* Menú de cuenta (avatar/login). Oculto cuando el menú grande está abierto. */}
      {!open && <UserMenu />}

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
          aria-label="Menú principal"
          aria-hidden={!open}
        >
          <div className={styles.panelTop}>
            <nav className={styles.tabs}>
              <Link
                href="/"
                onClick={close}
                className={featuredActive ? styles.tabActive : styles.tab}
                aria-current={featuredActive ? "page" : undefined}
              >
                Destacados
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
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className={styles.panelBody}>
            <ul className={styles.list}>
              {featured.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/artistas/${a.slug}`}
                    onClick={close}
                    onMouseEnter={() => setHovered(a)}
                    onMouseLeave={() => setHovered(null)}
                    className={styles.item}
                  >
                    {a.name}
                  </Link>
                </li>
              ))}
              {featured.length === 0 && (
                <li className={styles.empty}>Aún no hay destacados.</li>
              )}
            </ul>
          </div>

          <div className={styles.panelFoot}>
            <Link href="/" onClick={close} className={styles.homeLink}>
              Inicio
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
