"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { FileUpload, type UploadedFile } from "@/components/ui/FileUpload";
import { Button } from "@/components/ui/Button";
import { setArtistSlug } from "@/features/auth/lib/user-repo";
import {
  createProfile,
  uniqueSlug,
  getProfileBySlug,
} from "@/features/artists/lib/artist-profile-repo";
import { track } from "@/lib/firebase/analytics";

function FieldShell({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-silver-300 text-xs tracking-[2px] uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="text-silver-500 text-xs">{hint}</span>}
    </label>
  );
}

const INPUT =
  "rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 text-silver-50 outline-none transition focus:border-amethyst-300 focus:ring-1 focus:ring-amethyst-300/80";

/**
 * Alta self-serve del BEATMAKER: perfil público mínimo (foto, nombre, ciudad),
 * SIN cobro (a diferencia del cantante, que paga la membresía). El rol lo otorga
 * la aprobación del convenio; aquí solo se arma la página.
 *
 * ORDEN CRÍTICO en el submit (awaits secuenciales): primero se vincula el slug al
 * usuario (`setArtistSlug`) y se refresca la cuenta, y SOLO DESPUÉS se crea el
 * perfil — la regla `create` de `artistProfiles` valida que
 * `users/{uid}.artistSlug == slug`, así que el slug debe estar commiteado antes.
 * `disciplines`/`socio` NO se escriben aquí (la regla lo prohíbe): los deriva el
 * trigger `onArtistProfileCreated` a partir de los roles del dueño.
 */
export function BeatmakerOnboarding() {
  const { user, account, refreshAccount } = useAuth();
  const router = useRouter();
  const t = useTranslations("beatmakerOnboarding");

  const [artisticName, setArtisticName] = useState("");
  const [city, setCity] = useState("");
  const [photo, setPhoto] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // ¿El slug vinculado apunta a un perfil REAL del usuario? null = comprobando.
  const [ownsProfile, setOwnsProfile] = useState<boolean | null>(null);

  // Re-sincroniza la cuenta al entrar: si el alta se guardó en esta sesión, el
  // contexto pudo quedar viejo (sin artistSlug) y ocultar el guard de "ya tienes
  // perfil". Mismo patrón que el alta de cantante.
  useEffect(() => {
    refreshAccount();
  }, [refreshAccount]);

  // Verifica que el slug vinculado corresponde a un perfil EXISTENTE y propio.
  // Un `artistSlug` puede quedar HUÉRFANO (fallo parcial en un alta previa:
  // setArtistSlug OK pero createProfile falló) — en ese caso NO hay que bloquear
  // el formulario, hay que dejar reintentar. Sin esto, el usuario queda soft-
  // lockeado con un enlace a un perfil 404.
  const linkedSlug = account?.artistSlug;
  useEffect(() => {
    if (!linkedSlug || !user) {
      setOwnsProfile(false);
      return;
    }
    let active = true;
    getProfileBySlug(linkedSlug)
      .then((p) => active && setOwnsProfile(!!p && p.uid === user.uid))
      .catch(() => active && setOwnsProfile(false));
    return () => {
      active = false;
    };
  }, [linkedSlug, user]);

  // Mientras se comprueba si el slug apunta a un perfil real: lienzo oscuro (no
  // parpadear el formulario a un usuario que sí está registrado).
  if (linkedSlug && ownsProfile === null) {
    return <div className="bg-ink min-h-dvh" />;
  }

  // Guarda contra doble alta: solo si el perfil REALMENTE existe y es suyo. Si el
  // slug quedó huérfano (ownsProfile === false), cae al formulario para reintentar.
  if (linkedSlug && ownsProfile) {
    return (
      <main className="mx-auto min-h-dvh max-w-lg px-6 pt-28 pb-24 text-center">
        <h1 className="font-narrow text-4xl font-bold uppercase">
          {t("alreadyRegistered.title")}
        </h1>
        <p className="text-silver-300 mt-3">{t("alreadyRegistered.body")}</p>
        <Link
          href={`/artistas/${account.artistSlug}`}
          className="from-silver-100 to-amethyst-300 text-ink mt-8 inline-flex rounded-full bg-gradient-to-r px-7 py-3 text-sm font-semibold tracking-[2px] uppercase"
        >
          {t("alreadyRegistered.goToProfile")}
        </Link>
      </main>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);

    if (!artisticName.trim()) {
      setError(t("errors.missingName"));
      return;
    }
    if (photo.length === 0) {
      setError(t("errors.photoRequired"));
      return;
    }

    setBusy(true);
    try {
      // Slug único (añade -2, -3… si choca). El nombre debe generar URL válida.
      const slug = await uniqueSlug(artisticName);
      if (!slug || slug === "perfil") {
        setError(t("errors.invalidName"));
        setBusy(false);
        return;
      }
      // Vincula el slug al usuario (la regla `create` valida
      // get(users/{uid}).artistSlug == slug) y crea el perfil. `refreshAccount`
      // va DESPUÉS del éxito, no antes: si createProfile falla, la cuenta local
      // NO refleja el slug, así el guard no rebota a "ya tienes perfil" (el slug
      // quedaría huérfano) y el error de submit queda visible + reintentable.
      await setArtistSlug(user.uid, slug);
      await createProfile(
        user.uid,
        slug,
        {
          artisticName: artisticName.trim(),
          tagline: "",
          genre: "",
          bio: "",
          accent: "#8b5cf6",
          photoURL: photo[0].url,
          city: city.trim() || undefined,
          gallery: [],
          tracks: [],
          socials: {},
          trajectoryStartYear: new Date().getFullYear(),
        },
        null,
      );
      await refreshAccount();
      track("beatmaker_profile_created");
      router.push(`/artistas/${slug}`);
    } catch (err) {
      console.error("[beatmaker-onboarding] error:", err);
      setError(t("errors.submitFailed"));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-6 pt-28 pb-24 sm:px-8">
      <p className="text-amethyst-300 text-sm tracking-[4px] uppercase">
        {t("eyebrow")}
      </p>
      <h1 className="font-narrow mt-2 text-5xl font-bold uppercase sm:text-6xl">
        {t("heroTitle")}
      </h1>
      <p className="text-silver-300 mt-3">{t("heroParagraph")}</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
        <FieldShell
          label={t("fields.artisticName.label")}
          hint={t("fields.artisticName.hint")}
        >
          <input
            className={INPUT}
            value={artisticName}
            onChange={(e) => setArtisticName(e.target.value)}
            placeholder={t("fields.artisticName.placeholder")}
            required
          />
        </FieldShell>

        <FieldShell label={t("fields.city.label")}>
          <input
            className={INPUT}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t("fields.city.placeholder")}
            autoComplete="address-level2"
          />
        </FieldShell>

        <div className="flex flex-col gap-2">
          <span className="text-silver-300 text-xs tracking-[2px] uppercase">
            {t("fields.photo.label")}
          </span>
          <FileUpload
            value={photo}
            onChange={(files) => setPhoto(files.slice(-1))}
            accept="image/*"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
          >
            {error}
          </p>
        )}

        <Button type="submit" loading={busy} className="mt-1 w-full">
          {t("submit")}
        </Button>
      </form>
    </main>
  );
}
