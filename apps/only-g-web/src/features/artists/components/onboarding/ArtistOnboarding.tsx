"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { FileUpload, type UploadedFile } from "@/components/ui/FileUpload";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { hasAnyRole } from "@only-g/shared-types/user";
import { formatCOP } from "@only-g/shared-types/service";
import { paseEstado } from "@only-g/shared-types/pase";
import { usePrecios } from "@/features/pricing/components/PreciosProvider";
import { track } from "@/lib/firebase/analytics";
import { crearPerfilInicial } from "@/features/artists/lib/onboarding-repo";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

const CURRENT_YEAR = new Date().getFullYear();
const TODAY = new Date().toISOString().slice(0, 10);

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

export function ArtistOnboarding() {
  const { user, account, refreshAccount } = useAuth();
  const { precioPerfil } = usePrecios();
  // Con pase activo el perfil nace PUBLICADO; si no, nace BORRADOR y paga al
  // publicar. En ambos casos, crearlo al registrarse es GRATIS.
  const paseActivo = paseEstado(account?.pase, Date.now()) === "activo";
  const router = useRouter();
  const t = useTranslations();

  const [artisticName, setArtisticName] = useState("");
  const [realName, setRealName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [startYear, setStartYear] = useState("");
  const [photo, setPhoto] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Re-sincroniza la cuenta al entrar: si el alta se guardó en esta sesión, el
  // contexto pudo quedar viejo (sin artistSlug) y provocar el bucle alta↔perfil.
  useEffect(() => {
    refreshAccount();
  }, [refreshAccount]);

  // Crea el perfil (borrador, o publicado si hay pase) SIN cobro y va al editor.
  // El pago se pide al PUBLICAR desde el editor. Lo comparten el alta y la
  // pantalla de "alta a medias".
  async function crearPerfil(data: {
    artisticName: string;
    realName: string;
    birthDate: string;
    startYear: number;
    photoURL: string;
  }) {
    setBusy(true);
    setError(null);
    try {
      await crearPerfilInicial(data);
      await refreshAccount();
      track(
        paseActivo
          ? "artist_profile_created_with_pass"
          : "artist_profile_submitted",
      );
      router.push("/artista/perfil");
    } catch (err) {
      console.error("[artist-onboarding] error:", err);
      setError(t("artistOnboarding.errors.submitFailed"));
      setBusy(false);
    }
  }

  // Ya tiene alta: si es artista, al editor; si quedó a medias (slug sin perfil,
  // del flujo viejo con cobro), termina de crearlo GRATIS ahora.
  if (account?.artistSlug) {
    const activo = hasAnyRole(account, ["artista"]);
    const draft = account.artistDraft;
    return (
      <main className="mx-auto min-h-dvh max-w-lg px-6 pt-28 pb-24 text-center">
        <h1 className="font-narrow text-4xl font-bold uppercase">
          {t("artistOnboarding.alreadyRegistered.title")}
        </h1>
        <p className="text-silver-300 mt-3">
          {activo
            ? t("artistOnboarding.alreadyRegistered.activeBody")
            : t("artistOnboarding.alreadyRegistered.pendingBody")}
        </p>
        {error && (
          <p
            role="alert"
            className="mx-auto mt-4 max-w-sm rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
          >
            {error}
          </p>
        )}
        {activo || !draft ? (
          <Link
            href={activo ? "/artista/perfil" : "/solicitudes"}
            className="from-silver-100 to-amethyst-300 text-ink mt-8 inline-flex rounded-full bg-gradient-to-r px-7 py-3 text-sm font-semibold tracking-[2px] uppercase"
          >
            {activo
              ? t("artistOnboarding.alreadyRegistered.goToProfile")
              : t("artistOnboarding.alreadyRegistered.viewPayment")}
          </Link>
        ) : (
          <Button
            onClick={() =>
              crearPerfil({
                artisticName: draft.artisticName,
                realName: account.realName ?? "",
                birthDate: account.birthDate ?? "",
                startYear: draft.trajectoryStartYear,
                photoURL: draft.photoURL,
              })
            }
            loading={busy}
            className="mt-8"
          >
            {t("artistOnboarding.submit")}
          </Button>
        )}
      </main>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);

    const year = Number(startYear);
    if (!artisticName.trim() || !realName.trim() || !birthDate) {
      setError(t("artistOnboarding.errors.missingRequired"));
      return;
    }
    if (!year || year < 1950 || year > CURRENT_YEAR) {
      setError(
        t("artistOnboarding.errors.invalidYear", { year: CURRENT_YEAR }),
      );
      return;
    }
    if (photo.length === 0) {
      setError(t("artistOnboarding.errors.photoRequired"));
      return;
    }

    await crearPerfil({
      artisticName: artisticName.trim(),
      realName: realName.trim(),
      birthDate,
      startYear: year,
      photoURL: photo[0].url,
    });
  }

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-6 pt-28 pb-24 sm:px-8">
      <p className="text-amethyst-300 text-sm tracking-[4px] uppercase">
        {t("artistOnboarding.eyebrow")}
      </p>
      <h1 className="font-narrow mt-2 text-5xl font-bold uppercase sm:text-6xl">
        {t("artistOnboarding.heroTitle")}
      </h1>
      <p className="text-silver-300 mt-3">
        {t.rich("artistOnboarding.heroParagraph", {
          strong: (c) => <strong className="text-silver-100">{c}</strong>,
        })}
      </p>

      <div className="border-amethyst-300/30 bg-amethyst-500/10 mt-6 rounded-2xl border p-5">
        <p className="text-amethyst-200 text-xs tracking-[2px] uppercase">
          {paseActivo
            ? t("artistOnboarding.paseLabel")
            : t("artistOnboarding.pricingLabel")}
        </p>
        <p className="font-narrow mt-1 text-3xl font-bold text-white">
          {paseActivo
            ? t("artistOnboarding.paseGratis")
            : formatCOP(precioPerfil)}
        </p>
        <p className="text-silver-400 mt-1 text-sm">
          {paseActivo
            ? t("artistOnboarding.paseNota")
            : t("artistOnboarding.pricingNote")}
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
        <FieldShell
          label={t("artistOnboarding.fields.artisticName.label")}
          hint={t("artistOnboarding.fields.artisticName.hint")}
        >
          <input
            className={INPUT}
            value={artisticName}
            onChange={(e) => setArtisticName(e.target.value)}
            placeholder={t("artistOnboarding.fields.artisticName.placeholder")}
            required
          />
        </FieldShell>

        <FieldShell label={t("artistOnboarding.fields.realName.label")}>
          <input
            className={INPUT}
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            autoComplete="name"
            required
          />
        </FieldShell>

        <div className="grid grid-cols-2 gap-4">
          <FieldShell label={t("artistOnboarding.fields.birthDate.label")}>
            <DatePicker
              value={birthDate}
              onChange={setBirthDate}
              max={TODAY}
              className={INPUT}
            />
          </FieldShell>
          <FieldShell
            label={t("artistOnboarding.fields.startYear.label")}
            hint={t("artistOnboarding.fields.startYear.hint")}
          >
            <input
              type="number"
              inputMode="numeric"
              min={1950}
              max={CURRENT_YEAR}
              className={INPUT}
              value={startYear}
              onChange={(e) => setStartYear(e.target.value)}
              placeholder={`${CURRENT_YEAR - 3}`}
              required
            />
          </FieldShell>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-silver-300 text-xs tracking-[2px] uppercase">
            {t("artistOnboarding.fields.photo.label")}
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
          {t("artistOnboarding.submit")}
        </Button>
      </form>
    </main>
  );
}
