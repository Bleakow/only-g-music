"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getAllProfiles,
  setPremium,
} from "@/features/artists/lib/artist-profile-repo";
import {
  type ArtistProfile,
  activarPremium,
  insigniaDePuntos,
  INSIGNIA_META,
  premiumEstado,
} from "@/domain/artist-profile";
import { fechaCorta } from "@/features/solicitudes/lib/estados";
import { Button } from "@/components/ui/Button";

const ESTADO_LABEL = {
  activo: "Premium activo",
  expirado: "Expirado",
  ninguno: "Sin activar",
} as const;

export function AdminPerfiles() {
  const [perfiles, setPerfiles] = useState<ArtistProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAllProfiles()
      .then((p) => {
        if (!active) return;
        setPerfiles(p);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[admin-perfiles] error:", e);
        setError("No se pudieron cargar los perfiles (¿rol admin y reglas?).");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function activar(slug: string) {
    setSavingSlug(slug);
    setError(null);
    try {
      const premium = activarPremium(Date.now());
      await setPremium(slug, premium);
      setPerfiles((prev) =>
        prev.map((p) => (p.slug === slug ? { ...p, premium } : p)),
      );
    } catch (e) {
      console.error("[admin-perfiles] setPremium error:", e);
      setError("No se pudo activar el premium.");
    } finally {
      setSavingSlug(null);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-6 pb-24 pt-28 sm:px-12">
      <Link
        href="/admin"
        className="text-sm text-silver-300 underline-offset-4 hover:text-white hover:underline"
      >
        ← Panel admin
      </Link>
      <h1 className="mt-4 font-narrow text-5xl font-bold uppercase sm:text-6xl">
        Perfiles
      </h1>
      <p className="mt-2 text-silver-300">
        Activa o renueva el premium (2 meses) tras confirmar el pago. El rol{" "}
        <code className="text-amethyst-200">artista</code> se asigna en la consola
        de Firebase.
      </p>

      {error && (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-silver-300">Cargando…</p>
      ) : perfiles.length === 0 ? (
        <p className="mt-10 text-silver-400">Aún no hay perfiles creados.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {perfiles.map((p) => {
            const estado = premiumEstado(p.premium, Date.now());
            const insignia = INSIGNIA_META[insigniaDePuntos(p.puntos)];
            return (
              <li
                key={p.slug}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    {p.artisticName}{" "}
                    <span
                      className="ml-1 text-xs uppercase tracking-wide"
                      style={{ color: insignia.color }}
                    >
                      {insignia.label}
                    </span>
                  </p>
                  <p className="text-sm text-silver-400">
                    <Link
                      href={`/artistas/${p.slug}`}
                      className="underline-offset-2 hover:text-white hover:underline"
                    >
                      /artistas/{p.slug}
                    </Link>{" "}
                    · {ESTADO_LABEL[estado]}
                    {p.premium && estado !== "ninguno"
                      ? ` (vence ${fechaCorta(p.premium.expiresAt)})`
                      : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={estado === "activo" ? "secondary" : "primary"}
                  loading={savingSlug === p.slug}
                  onClick={() => activar(p.slug)}
                >
                  {estado === "activo" ? "Renovar" : "Activar"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
