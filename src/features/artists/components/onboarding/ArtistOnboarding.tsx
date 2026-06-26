"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { FileUpload, type UploadedFile } from "@/components/ui/FileUpload";
import { Button } from "@/components/ui/Button";
import { hasAnyRole } from "@/domain/user";
import { toSlug } from "@/domain/artist-profile";
import { formatCOP } from "@/domain/service";
import { PRECIO_PERFIL, nuevoPedidoPerfil } from "@/domain/profile-order";
import { createReserva } from "@/features/booking/lib/booking-repo";
import { track } from "@/lib/firebase/analytics";
import { updateArtistPrivateData } from "@/features/auth/lib/user-repo";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

const CURRENT_YEAR = new Date().getFullYear();

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
      <span className="text-xs uppercase tracking-[2px] text-silver-300">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-silver-500">{hint}</span>}
    </label>
  );
}

const INPUT =
  "rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 text-silver-50 outline-none transition focus:border-amethyst-300 focus:ring-1 focus:ring-amethyst-300/80";

export function ArtistOnboarding() {
  const { user, account, refreshAccount } = useAuth();
  const router = useRouter();
  const t = useTranslations();

  const [artisticName, setArtisticName] = useState("");
  const [realName, setRealName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [startYear, setStartYear] = useState("");
  const [photo, setPhoto] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Re-sincroniza la cuenta al entrar: si el alta se guardo en esta sesion, el
  // contexto pudo quedar viejo (sin artistSlug) y provocar el bucle alta o perfil.
  useEffect(() => {
    refreshAccount();
  }, [refreshAccount]);

  // El alta se considera hecha cuando YA tienes `artistSlug` (datos guardados +
  // pedido de pago creado). Tener el ROL `artista` NO basta -- si miraamos el rol
  // se produce el bucle "ya eres artista" o "falta tu alta". El premium lo activa
  // el pago confirmado, no el rol.
  if (account?.artistSlug) {
    const activo = hasAnyRole(account, ["artista"]);
    return (
      <main className="mx-auto min-h-dvh max-w-lg px-6 pb-24 pt-28 text-center">
        <h1 className="font-narrow text-4xl font-bold uppercase">
          {t("artistOnboarding.alreadyRegistered.title")}
        </h1>
        <p className="mt-3 text-silver-300">
          {activo
            ? t("artistOnboarding.alreadyRegistered.activeBody")
            : t("artistOnboarding.alreadyRegistered.pendingBody")}
        </p>
        <Link
          href={activo ? "/artista/perfil" : "/solicitudes"}
          className="mt-8 inline-flex rounded-full bg-gradient-to-r from-silver-100 to-amethyst-300 px-7 py-3 text-sm font-semibold uppercase tracking-[2px] text-ink"
        >
          {activo
            ? t("artistOnboarding.alreadyRegistered.goToProfile")
            : t("artistOnboarding.alreadyRegistered.viewPayment")}
        </Link>
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
      setError(t("artistOnboarding.errors.invalidYear", { year: CURRENT_YEAR }));
      return;
    }
    if (photo.length === 0) {
      setError(t("artistOnboarding.errors.photoRequired"));
      return;
    }

    setBusy(true);
    try {
      const slug = toSlug(artisticName);
      if (!slug) {
        setError(t("artistOnboarding.errors.invalidSlug"));
        setBusy(false);
        return;
      }
      await updateArtistPrivateData(user.uid, {
        realName: realName.trim(),
        birthDate,
        artistSlug: slug,
        artistDraft: {
          artisticName: artisticName.trim(),
          trajectoryStartYear: year,
          photoURL: photo[0].url,
        },
      });
      await refreshAccount();
      const id = await createReserva(
        nuevoPedidoPerfil({
          uid: user.uid,
          now: Date.now(),
          artistSlug: slug,
          clientName: account?.displayName ?? user.displayName ?? undefined,
          clientEmail: account?.email ?? user.email ?? undefined,
        }),
      );
      track("artist_profile_submitted");
      router.push(`/solicitudes/reserva/${id}`);
    } catch (err) {
      console.error("[artist-onboarding] error:", err);
      setError(t("artistOnboarding.errors.submitFailed"));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-6 pb-24 pt-28 sm:px-8">
      <p className="text-sm uppercase tracking-[4px] text-amethyst-300">
        {t("artistOnboarding.eyebrow")}
      </p>
      <h1 className="mt-2 font-narrow text-5xl font-bold uppercase sm:text-6xl">
        {t("artistOnboarding.heroTitle")}
      </h1>
      <p className="mt-3 text-silver-300">
        {t.rich("artistOnboarding.heroParagraph", {
          strong: (c) => <strong className="text-silver-100">{c}</strong>,
        })}
      </p>

      <div className="mt-6 rounded-2xl border border-amethyst-300/30 bg-amethyst-500/10 p-5">
        <p className="text-xs uppercase tracking-[2px] text-amethyst-200">
          {t("artistOnboarding.pricingLabel")}
        </p>
        <p className="mt-1 font-narrow text-3xl font-bold text-white">
          {formatCOP(PRECIO_PERFIL)}
        </p>
        <p className="mt-1 text-sm text-silver-400">
          {t("artistOnboarding.pricingNote")}
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
            <input
              type="date"
              className={INPUT}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
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
          <span className="text-xs uppercase tracking-[2px] text-silver-300">
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
