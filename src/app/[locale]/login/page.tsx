"use client";

import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import Image from "next/image";
import {
  loginWithEmail,
  registerWithEmail,
  loginWithGoogle,
  loginWithFacebook,
  sendPasswordReset,
  authErrorCode,
} from "@/features/auth/lib/auth-actions";
import { FacebookIcon } from "@/components/icons";

type Mode = "login" | "register" | "reset";

function GoogleMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.6 34.6 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.5 5.5C40.9 36.5 44 30.8 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

function LoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(
    params.get("mode") === "register" ? "register" : "login",
  );

  // Destino tras autenticar (vuelve a donde el usuario iba). Solo rutas
  // internas para evitar redirecciones abiertas.
  const nextParam = params.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [intent, setIntent] = useState<"explorar" | "artista">("explorar");

  const isRegister = mode === "register";
  const isReset = mode === "reset";

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setResetSent(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isReset) {
        await sendPasswordReset(email);
        setResetSent(true);
      } else if (isRegister) {
        await registerWithEmail(email, password, name);
        router.push(intent === "artista" ? "/artista/nuevo" : next);
      } else {
        await loginWithEmail(email, password);
        router.push(next);
      }
    } catch (err) {
      setError(t(`authErrors.${authErrorCode(err)}`));
    } finally {
      setBusy(false);
    }
  }

  async function social(action: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await action();
      router.push(isRegister && intent === "artista" ? "/artista/nuevo" : next);
    } catch (err) {
      setError(t(`authErrors.${authErrorCode(err)}`));
    } finally {
      setBusy(false);
    }
  }

  const title = isReset
    ? t("login.resetTitle")
    : isRegister
      ? t("auth.createAccount")
      : t("auth.login");
  const subtitle = isReset
    ? t("login.subtitleReset")
    : isRegister
      ? t("login.subtitleRegister")
      : t("login.subtitleLogin");

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-ink px-6 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(130% 120% at 30% 20%, rgba(124,58,237,0.18), transparent 60%), radial-gradient(120% 100% at 80% 90%, rgba(196,165,255,0.08), transparent 55%)",
        }}
      />

      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center">
          <Image
            src="/logo/logo-white.png"
            alt="Only G"
            width={360}
            height={240}
            className="h-16 w-auto"
            priority
          />
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-sm sm:p-8">
          <h1 className="font-narrow text-3xl font-bold uppercase tracking-wide text-white">
            {title}
          </h1>
          <p className="mt-1 text-sm text-silver-300">{subtitle}</p>

          {isReset && resetSent ? (
            <div className="mt-6 flex flex-col gap-4">
              <p className="rounded-lg border border-amethyst-300/30 bg-amethyst-500/10 px-3 py-3 text-sm text-amethyst-100">
                {t.rich("login.resetSent", {
                  email,
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="rounded-full border border-silver-300/40 px-6 py-3 text-sm uppercase tracking-[2px] text-silver-100 transition hover:border-silver-100 hover:bg-white/5"
              >
                {t("login.backToLogin")}
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
                {isRegister && (
                  <Field
                    label={t("login.name")}
                    type="text"
                    value={name}
                    onChange={setName}
                    autoComplete="name"
                    required
                  />
                )}
                {isRegister && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs uppercase tracking-[2px] text-silver-300">
                      {t("login.howJoin")}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIntent("explorar")}
                        className={`rounded-lg border px-3 py-2.5 text-sm transition ${
                          intent === "explorar"
                            ? "border-amethyst-300 bg-amethyst-500/15 text-white"
                            : "border-white/15 text-silver-300 hover:border-white/40"
                        }`}
                      >
                        {t("login.justExplore")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIntent("artista")}
                        className={`rounded-lg border px-3 py-2.5 text-sm transition ${
                          intent === "artista"
                            ? "border-amethyst-300 bg-amethyst-500/15 text-white"
                            : "border-white/15 text-silver-300 hover:border-white/40"
                        }`}
                      >
                        {t("login.iAmArtist")}
                      </button>
                    </div>
                    {intent === "artista" && (
                      <span className="text-xs text-silver-500">
                        {t("login.artistHint")}
                      </span>
                    )}
                  </div>
                )}
                <Field
                  label={t("login.email")}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  required
                />
                {!isReset && (
                  <div className="flex flex-col gap-1.5">
                    <Field
                      label={t("login.password")}
                      type="password"
                      value={password}
                      onChange={setPassword}
                      autoComplete={
                        isRegister ? "new-password" : "current-password"
                      }
                      required
                    />
                    {!isRegister && (
                      <button
                        type="button"
                        onClick={() => switchMode("reset")}
                        className="self-end text-xs text-silver-300 underline-offset-4 hover:text-amethyst-200 hover:underline"
                      >
                        {t("login.forgot")}
                      </button>
                    )}
                  </div>
                )}

                {error && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-1 rounded-full bg-gradient-to-r from-silver-100 to-amethyst-300 px-6 py-3 text-sm font-semibold uppercase tracking-[2px] text-ink transition hover:shadow-[0_0_22px_rgba(139,92,246,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy
                    ? t("login.submitting")
                    : isReset
                      ? t("login.sendLink")
                      : isRegister
                        ? t("auth.createAccount")
                        : t("login.enter")}
                </button>
              </form>

              {isReset ? (
                <p className="mt-6 text-center text-sm text-silver-300">
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="font-semibold text-amethyst-300 underline-offset-4 hover:text-amethyst-200 hover:underline"
                  >
                    {t("login.backToLogin")}
                  </button>
                </p>
              ) : (
                <>
                  <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[2px] text-silver-400">
                    <span className="h-px flex-1 bg-white/10" />
                    {t("login.or")}
                    <span className="h-px flex-1 bg-white/10" />
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => social(loginWithGoogle)}
                      disabled={busy}
                      className="flex w-full items-center justify-center gap-3 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-silver-100 transition hover:border-white/50 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <GoogleMark className="size-5" />
                      {t("login.google")}
                    </button>
                    <button
                      type="button"
                      onClick={() => social(loginWithFacebook)}
                      disabled={busy}
                      className="flex w-full items-center justify-center gap-3 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-silver-100 transition hover:border-white/50 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FacebookIcon className="size-5 text-[#1877F2]" />
                      {t("login.facebook")}
                    </button>
                  </div>

                  <p className="mt-6 text-center text-sm text-silver-300">
                    {isRegister ? t("login.haveAccount") : t("auth.noAccount")}{" "}
                    <button
                      type="button"
                      onClick={() => switchMode(isRegister ? "login" : "register")}
                      className="font-semibold text-amethyst-300 underline-offset-4 hover:text-amethyst-200 hover:underline"
                    >
                      {isRegister ? t("login.signinShort") : t("login.register")}
                    </button>
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-ink" />}>
      <LoginForm />
    </Suspense>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-[2px] text-silver-300">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 text-silver-50 outline-none transition focus:border-amethyst-300 focus:ring-1 focus:ring-amethyst-300/80"
      />
    </label>
  );
}
