"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/components/AuthProvider";
import {
  countLikes,
  hasLiked,
  toggleLike,
} from "../../lib/artist-profile-repo";
import { HeartIcon } from "@/components/icons";

/**
 * Botón de "me gusta" estilo red social. Un like por usuario (subcolección).
 * UI optimista con reversión si falla. Requiere sesión; sin ella, deshabilitado.
 */
export function LikeButton({ slug }: { slug: string }) {
  const { user, loading: authLoading } = useAuth();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    countLikes(slug)
      .then((c) => {
        if (active) setCount(c);
      })
      .catch(() => {});
    if (user) {
      hasLiked(slug, user.uid)
        .then((h) => {
          if (active) setLiked(h);
        })
        .catch(() => {});
    } else if (active) {
      setLiked(false);
    }
    return () => {
      active = false;
    };
  }, [slug, user]);

  async function onClick() {
    if (!user || busy) return;
    setBusy(true);
    const next = !liked;
    setLiked(next);
    setCount((c) => (c ?? 0) + (next ? 1 : -1));
    try {
      const real = await toggleLike(slug, user.uid);
      setLiked(real);
    } catch {
      // Revertir el optimismo si la escritura falló.
      setLiked(!next);
      setCount((c) => (c ?? 0) + (next ? -1 : 1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!user || authLoading || busy}
      aria-pressed={liked}
      title={
        user
          ? liked
            ? "Quitar me gusta"
            : "Me gusta"
          : "Inicia sesión para reaccionar"
      }
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
        liked
          ? "border-rose-400/60 bg-rose-500/15 text-rose-200"
          : "border-white/20 text-white/80 hover:border-white/40 hover:text-white"
      }`}
    >
      <HeartIcon className="size-5" fill={liked ? "currentColor" : "none"} />
      <span className="tabular-nums">{count ?? "—"}</span>
    </button>
  );
}
