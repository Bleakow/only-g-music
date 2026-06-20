"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { FileUpload, type UploadedFile } from "@/components/ui/FileUpload";
import { Button } from "@/components/ui/Button";
import { PlusIcon, CloseIcon } from "@/components/icons";
import type { SocialPlatform } from "@/domain/artist";
import {
  type EditableProfile,
  type ProfileTrack,
  premiumEstado,
} from "@/domain/artist-profile";
import {
  createProfile,
  getProfileBySlug,
  updateProfile,
} from "../../lib/artist-profile-repo";

const CURRENT_YEAR = new Date().getFullYear();
const INPUT =
  "w-full rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 text-silver-50 outline-none transition focus:border-amethyst-300 focus:ring-1 focus:ring-amethyst-300/80";
const SOCIAL_KEYS: SocialPlatform[] = ["spotify", "instagram", "youtube", "x"];
// Id local estable para las keys de React (NO se persiste). Evita el bug de
// inputs controlados con key por índice al reordenar/eliminar temas.
let trackSeq = 0;
interface EditorTrack extends ProfileTrack {
  _id: string;
}
const emptyTrack = (): EditorTrack => ({
  _id: `t${trackSeq++}`,
  title: "",
  youtubeUrl: "",
  spotifyUrl: "",
});

function urlToFile(url: string, name: string): UploadedFile {
  return { url, name };
}

export function ProfileEditor() {
  const { user, account } = useAuth();
  const slug = account?.artistSlug ?? "";

  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(false);
  const [premiumLabel, setPremiumLabel] = useState<string>("");

  const [form, setForm] = useState({
    artisticName: "",
    tagline: "",
    genre: "",
    city: "",
    bio: "",
    accent: "#8b5cf6",
    trajectoryStartYear: CURRENT_YEAR,
    entryTrackUrl: "",
  });
  const [photo, setPhoto] = useState<UploadedFile[]>([]);
  const [gallery, setGallery] = useState<UploadedFile[]>([]);
  const [tracks, setTracks] = useState<EditorTrack[]>([emptyTrack()]);
  const [socials, setSocials] = useState<Record<SocialPlatform, string>>({
    spotify: "",
    instagram: "",
    youtube: "",
    x: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  useEffect(() => {
    if (!slug) {
      setLoaded(true);
      return;
    }
    let active = true;
    getProfileBySlug(slug)
      .then((p) => {
        if (!active) return;
        if (p) {
          setExists(true);
          setForm({
            artisticName: p.artisticName,
            tagline: p.tagline,
            genre: p.genre,
            city: p.city ?? "",
            bio: p.bio,
            accent: p.accent,
            trajectoryStartYear: p.trajectoryStartYear || CURRENT_YEAR,
            entryTrackUrl: p.entryTrackUrl ?? "",
          });
          if (p.photoURL) setPhoto([urlToFile(p.photoURL, "foto-perfil")]);
          setGallery(p.gallery.map((u, i) => urlToFile(u, `foto-${i + 1}`)));
          setTracks(
            p.tracks.length
              ? p.tracks.map((t) => ({ ...t, _id: `t${trackSeq++}` }))
              : [emptyTrack()],
          );
          setSocials({
            spotify: p.socials.spotify ?? "",
            instagram: p.socials.instagram ?? "",
            youtube: p.socials.youtube ?? "",
            x: p.socials.x ?? "",
          });
          setPremiumLabel(
            premiumEstado(p.premium, Date.now()) === "activo"
              ? "Premium activo (visible en la vitrina)."
              : "Pendiente de activación por el estudio tras el pago.",
          );
        } else if (account?.artistDraft) {
          // Sin perfil aún: prellenar con lo capturado en el onboarding.
          const d = account.artistDraft;
          setForm((prev) => ({
            ...prev,
            artisticName: d.artisticName,
            trajectoryStartYear: d.trajectoryStartYear || CURRENT_YEAR,
          }));
          if (d.photoURL) setPhoto([urlToFile(d.photoURL, "foto-perfil")]);
        }
        setLoaded(true);
      })
      .catch(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [slug, account?.artistDraft]);

  function setTrack(i: number, patch: Partial<ProfileTrack>) {
    setTracks((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !slug) return;
    setError(null);
    setSaved(false);

    if (!form.artisticName.trim()) {
      setError("El nombre artístico es obligatorio.");
      return;
    }
    if (photo.length === 0) {
      setError("La foto de perfil es obligatoria.");
      return;
    }

    const cleanSocials: Partial<Record<SocialPlatform, string>> = {};
    for (const k of SOCIAL_KEYS) {
      const v = socials[k].trim();
      if (v) cleanSocials[k] = v;
    }

    const editable: EditableProfile = {
      artisticName: form.artisticName.trim(),
      tagline: form.tagline.trim(),
      genre: form.genre.trim(),
      city: form.city.trim() || undefined,
      bio: form.bio.trim(),
      accent: form.accent,
      photoURL: photo[0].url,
      gallery: gallery.map((g) => g.url),
      tracks: tracks
        .filter((t) => t.title.trim())
        .map((t) => ({
          title: t.title.trim(),
          youtubeUrl: t.youtubeUrl?.trim() || undefined,
          spotifyUrl: t.spotifyUrl?.trim() || undefined,
        })),
      entryTrackUrl: form.entryTrackUrl.trim() || undefined,
      socials: cleanSocials,
      trajectoryStartYear: Number(form.trajectoryStartYear) || CURRENT_YEAR,
    };

    setBusy(true);
    try {
      if (exists) await updateProfile(slug, editable);
      else await createProfile(user.uid, slug, editable, null);
      setExists(true);
      setSaved(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("[profile-editor] error:", err);
      setError(
        "No se pudo guardar. Verifica que el estudio ya activó tu rol de artista.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <main className="grid min-h-dvh place-items-center text-silver-300">
        Cargando…
      </main>
    );
  }

  if (!slug) {
    return (
      <main className="mx-auto min-h-dvh max-w-lg px-6 pb-24 pt-28 text-center">
        <h1 className="font-narrow text-4xl font-bold uppercase">Falta tu alta</h1>
        <p className="mt-3 text-silver-300">
          No encontramos tu perfil de artista. Crea tu alta primero.
        </p>
        <Link
          href="/artista/nuevo"
          className="mt-8 inline-flex rounded-full bg-gradient-to-r from-silver-100 to-amethyst-300 px-7 py-3 text-sm font-semibold uppercase tracking-[2px] text-ink"
        >
          Crear mi perfil
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 pb-24 pt-28 sm:px-8">
      <p className="text-sm uppercase tracking-[4px] text-amethyst-300">
        Mi perfil de artista
      </p>
      <h1 className="mt-2 font-narrow text-5xl font-bold uppercase sm:text-6xl">
        {exists ? "Editar perfil" : "Crear perfil"}
      </h1>
      <p className="mt-2 text-silver-400">
        URL pública:{" "}
        <Link
          href={`/artistas/${slug}`}
          className="text-amethyst-200 underline-offset-4 hover:underline"
        >
          /artistas/{slug}
        </Link>
      </p>
      {premiumLabel && (
        <p className="mt-2 text-sm text-silver-300">{premiumLabel}</p>
      )}

      {saved && (
        <p className="mt-6 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
          Perfil guardado.{" "}
          <Link
            href={`/artistas/${slug}`}
            className="font-semibold underline underline-offset-2"
          >
            Verlo →
          </Link>
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-6">
        <Section title="Identidad">
          <Labeled label="Nombre artístico">
            <input
              className={INPUT}
              value={form.artisticName}
              onChange={(e) => set("artisticName", e.target.value)}
              required
            />
          </Labeled>
          <Labeled label="Frase célebre">
            <input
              className={INPUT}
              value={form.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="Una frase que te defina."
            />
          </Labeled>
          <div className="grid grid-cols-2 gap-4">
            <Labeled label="Género">
              <input
                className={INPUT}
                value={form.genre}
                onChange={(e) => set("genre", e.target.value)}
                placeholder="Reggaetón, R&B…"
              />
            </Labeled>
            <Labeled label="Ciudad">
              <input
                className={INPUT}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </Labeled>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Labeled label="Inicio de trayectoria">
              <input
                type="number"
                min={1950}
                max={CURRENT_YEAR}
                className={INPUT}
                value={form.trajectoryStartYear}
                onChange={(e) =>
                  set("trajectoryStartYear", Number(e.target.value))
                }
              />
            </Labeled>
            <Labeled label="Color de acento">
              <input
                type="color"
                className="h-11 w-full cursor-pointer rounded-lg border border-white/15 bg-black/30"
                value={form.accent}
                onChange={(e) => set("accent", e.target.value)}
              />
            </Labeled>
          </div>
          <Labeled label="Bio">
            <textarea
              className={`${INPUT} min-h-28 resize-y`}
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              placeholder="Tu historia, estilo e hitos."
            />
          </Labeled>
        </Section>

        <Section title="Fotos">
          <Labeled label="Foto de perfil (obligatoria)">
            <FileUpload
              value={photo}
              onChange={(files) => setPhoto(files.slice(-1))}
              accept="image/*"
            />
          </Labeled>
          <Labeled label="Galería (varias)">
            <FileUpload value={gallery} onChange={setGallery} accept="image/*" />
          </Labeled>
        </Section>

        <Section title="Temas (YouTube / Spotify)">
          <div className="flex flex-col gap-4">
            {tracks.map((t, i) => (
              <div
                key={t._id}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    className={INPUT}
                    value={t.title}
                    onChange={(e) => setTrack(i, { title: e.target.value })}
                    placeholder={`Título del tema ${i + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setTracks((prev) =>
                        prev.length > 1
                          ? prev.filter((_, idx) => idx !== i)
                          : prev,
                      )
                    }
                    aria-label="Quitar tema"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-silver-400 transition hover:bg-white/10 hover:text-white"
                  >
                    <CloseIcon className="size-4" />
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    className={INPUT}
                    value={t.youtubeUrl ?? ""}
                    onChange={(e) => setTrack(i, { youtubeUrl: e.target.value })}
                    placeholder="Link YouTube"
                  />
                  <input
                    className={INPUT}
                    value={t.spotifyUrl ?? ""}
                    onChange={(e) => setTrack(i, { spotifyUrl: e.target.value })}
                    placeholder="Link Spotify"
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setTracks((prev) => [...prev, emptyTrack()])}
            className="inline-flex items-center gap-2 self-start text-sm font-semibold text-amethyst-200 hover:text-white"
          >
            <PlusIcon className="size-4" /> Añadir tema
          </button>
        </Section>

        <Section title="Redes">
          {SOCIAL_KEYS.map((k) => (
            <Labeled key={k} label={k}>
              <input
                className={INPUT}
                value={socials[k]}
                onChange={(e) =>
                  setSocials((prev) => ({ ...prev, [k]: e.target.value }))
                }
                placeholder={`Link de ${k}`}
              />
            </Labeled>
          ))}
        </Section>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
          >
            {error}
          </p>
        )}

        <Button type="submit" loading={busy} className="w-full">
          {exists ? "Guardar cambios" : "Crear perfil"}
        </Button>
      </form>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="font-narrow text-xl font-bold uppercase text-white">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-[2px] text-silver-300">
        {label}
      </span>
      {children}
    </label>
  );
}
