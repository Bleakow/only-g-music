"use client";

import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import Image from "next/image";
import type { User } from "firebase/auth";
import {
  loginWithEmail,
  registerWithEmail,
  loginWithGoogle,
  loginWithFacebook,
  sendPasswordReset,
  authErrorCode,
  type SocialResult,
} from "@/features/auth/lib/auth-actions";
import { GlassModal } from "@/components/ui/GlassModal";
import {
  createConvenioRequest,
  getMyPendingConvenio,
} from "@/features/convenios/lib/convenio-repo";
import { FacebookIcon, EyeIcon, EyeOffIcon, ArrowLeftIcon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";

type Mode = "login" | "register" | "reset";

/** Función con la que se une un usuario nuevo. `cantante` es self-serve
 * (formulario propio); `productor`/`beatmaker` mandan una SOLICITUD DE
 * CONVENIO que un admin debe aprobar antes de otorgar el rol. */
type JoinFn = "visitante" | "cantante" | "productor" | "beatmaker";

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
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [intent, setIntent] = useState<JoinFn>("visitante");
  // Nuevo usuario social pendiente de elegir su tipo (dispara el modal).
  const [pendingSocialUser, setPendingSocialUser] = useState<User | null>(null);

  const isRegister = mode === "register";
  const isReset = mode === "reset";

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setResetSent(false);
    setPasswordConfirm("");
  }

  // Enruta tras un ALTA (email o cuenta social nueva) según el `tipo` elegido:
  // productor/beatmaker → solicitud de convenio (queda `pendiente` hasta que un
  // admin la apruebe) → pantalla de confirmación; cantante → su alta self-serve;
  // visitante → `next`.
  async function routeAfterJoin(authUser: User, tipo: JoinFn) {
    if (tipo === "productor" || tipo === "beatmaker") {
      try {
        // Dedup: no crees otra solicitud si ya hay una pendiente (p. ej. un login
        // social de alguien que ya la mandó — signInWithPopup no distingue cuenta
        // nueva de existente).
        const pendiente = await getMyPendingConvenio(authUser.uid);
        if (!pendiente) {
          await createConvenioRequest({
            uid: authUser.uid,
            displayName: authUser.displayName ?? name ?? null,
            email: authUser.email ?? email ?? null,
            tipo,
          });
        }
        router.push("/convenio/enviado");
      } catch (convErr) {
        // El auth YA tuvo éxito; un fallo al guardar la solicitud NO es un error
        // de autenticación. Mensaje dedicado (el usuario ya quedó dentro).
        console.error("[login] convenio:", convErr);
        setError(t("login.convenioSaveFailed"));
      }
      return;
    }
    router.push(tipo === "cantante" ? "/artista/nuevo" : next);
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
        if (password !== passwordConfirm) {
          setError(t("login.passwordMismatch"));
          return;
        }
        const authUser = await registerWithEmail(email, password, name);
        await routeAfterJoin(authUser, intent);
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

  async function social(action: () => Promise<SocialResult>) {
    setError(null);
    setBusy(true);
    try {
      const { user: authUser, isNewUser } = await action();
      if (isNewUser) {
        // Cuenta NUEVA por social: pide el tipo de usuario, igual que el registro
        // manual (el login social no muestra ese selector). Si ya lo eligió en el
        // formulario de registro, respétalo sin volver a preguntar.
        if (isRegister && intent !== "visitante") {
          await routeAfterJoin(authUser, intent);
        } else {
          setPendingSocialUser(authUser);
        }
      } else {
        // Usuario existente que inicia sesión: no se le pide tipo.
        router.push(next);
      }
    } catch (err) {
      setError(t(`authErrors.${authErrorCode(err)}`));
    } finally {
      setBusy(false);
    }
  }

  // Nuevo usuario social que aún debe elegir su tipo (abre el modal de abajo).
  async function pickSocialType(tipo: JoinFn) {
    const authUser = pendingSocialUser;
    if (!authUser) return;
    setPendingSocialUser(null);
    setBusy(true);
    try {
      await routeAfterJoin(authUser, tipo);
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
    <main className="bg-ink relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-16">
      {/* Atrás: la ventana de login está fuera del layout `(site)` (no trae el
          header). Este botón devuelve a DONDE se venía (fallback: `next` o inicio). */}
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1)
            router.back();
          else router.push(next);
        }}
        aria-label={t("nav.back")}
        className="text-silver-100 fixed top-4 left-4 z-20 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-sm backdrop-blur-sm transition hover:border-white hover:text-white sm:top-5 sm:left-6"
      >
        <ArrowLeftIcon className="size-4" />
        {t("nav.back")}
      </button>

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
          <h1 className="font-narrow text-3xl font-bold tracking-wide text-white uppercase">
            {title}
          </h1>
          <p className="text-silver-300 mt-1 text-sm">{subtitle}</p>

          {isReset && resetSent ? (
            <div className="mt-6 flex flex-col gap-4">
              <Alert tone="success">
                {t.rich("login.resetSent", {
                  email,
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </Alert>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="btn-outline rounded-full px-6 py-3 text-sm tracking-[2px] uppercase transition"
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
                    <span className="text-silver-300 text-xs tracking-[2px] uppercase">
                      {t("login.howJoin")}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <JoinFnButton
                        active={intent === "visitante"}
                        onClick={() => setIntent("visitante")}
                      >
                        {t("login.fnVisitante")}
                      </JoinFnButton>
                      <JoinFnButton
                        active={intent === "cantante"}
                        onClick={() => setIntent("cantante")}
                      >
                        {t("login.fnCantante")}
                      </JoinFnButton>
                      <JoinFnButton
                        active={intent === "productor"}
                        onClick={() => setIntent("productor")}
                      >
                        {t("login.fnProductor")}
                      </JoinFnButton>
                      <JoinFnButton
                        active={intent === "beatmaker"}
                        onClick={() => setIntent("beatmaker")}
                      >
                        {t("login.fnBeatmaker")}
                      </JoinFnButton>
                    </div>
                    {intent !== "visitante" && (
                      <span className="text-silver-500 text-xs">
                        {t(
                          intent === "cantante"
                            ? "login.artistHint"
                            : intent === "productor"
                              ? "login.fnProductorHint"
                              : "login.fnBeatmakerHint",
                        )}
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
                  <>
                    <div className="flex flex-col gap-1.5">
                      <PasswordField
                        label={t("login.password")}
                        value={password}
                        onChange={setPassword}
                        autoComplete={
                          isRegister ? "new-password" : "current-password"
                        }
                        showLabel={t("login.showPassword")}
                        hideLabel={t("login.hidePassword")}
                      />
                      {!isRegister && (
                        <button
                          type="button"
                          onClick={() => switchMode("reset")}
                          className="text-silver-300 hover:text-amethyst-200 self-end text-xs underline-offset-4 hover:underline"
                        >
                          {t("login.forgot")}
                        </button>
                      )}
                    </div>
                    {isRegister && password.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <PasswordField
                          label={t("login.passwordConfirm")}
                          value={passwordConfirm}
                          onChange={setPasswordConfirm}
                          autoComplete="new-password"
                          showLabel={t("login.showPassword")}
                          hideLabel={t("login.hidePassword")}
                        />
                        {passwordConfirm.length > 0 &&
                          password !== passwordConfirm && (
                            <span className="text-xs text-rose-300">
                              {t("login.passwordMismatch")}
                            </span>
                          )}
                      </div>
                    )}
                  </>
                )}

                {error && <Alert tone="error">{error}</Alert>}

                <button
                  type="submit"
                  disabled={busy}
                  className="btn-amethyst mt-1 rounded-full px-6 py-3 text-sm font-semibold tracking-[2px] uppercase transition disabled:cursor-not-allowed disabled:opacity-60"
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
                <p className="text-silver-300 mt-6 text-center text-sm">
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="text-amethyst-300 hover:text-amethyst-200 font-semibold underline-offset-4 hover:underline"
                  >
                    {t("login.backToLogin")}
                  </button>
                </p>
              ) : (
                <>
                  <div className="text-silver-400 my-5 flex items-center gap-3 text-xs tracking-[2px] uppercase">
                    <span className="h-px flex-1 bg-white/10" />
                    {t("login.or")}
                    <span className="h-px flex-1 bg-white/10" />
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => social(loginWithGoogle)}
                      disabled={busy}
                      className="text-silver-100 flex w-full items-center justify-center gap-3 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium transition hover:border-white/50 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <GoogleMark className="size-5" />
                      {t("login.google")}
                    </button>
                    <button
                      type="button"
                      onClick={() => social(loginWithFacebook)}
                      disabled={busy}
                      className="text-silver-100 flex w-full items-center justify-center gap-3 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium transition hover:border-white/50 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FacebookIcon className="size-5 text-[#1877F2]" />
                      {t("login.facebook")}
                    </button>
                  </div>

                  <p className="text-silver-300 mt-6 text-center text-sm">
                    {isRegister ? t("login.haveAccount") : t("auth.noAccount")}{" "}
                    <button
                      type="button"
                      onClick={() =>
                        switchMode(isRegister ? "login" : "register")
                      }
                      className="text-amethyst-300 hover:text-amethyst-200 font-semibold underline-offset-4 hover:underline"
                    >
                      {isRegister
                        ? t("login.signinShort")
                        : t("login.register")}
                    </button>
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Nuevo usuario social: elige tu tipo (el login social no muestra el
          selector «¿Cómo te unes?» del registro manual). */}
      <GlassModal
        open={!!pendingSocialUser}
        onClose={() => setPendingSocialUser(null)}
        title={t("login.howJoin")}
      >
        <p className="text-silver-300 text-sm">
          {t("login.socialTypeSubtitle")}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <JoinFnButton active={false} onClick={() => pickSocialType("visitante")}>
            {t("login.fnVisitante")}
          </JoinFnButton>
          <JoinFnButton active={false} onClick={() => pickSocialType("cantante")}>
            {t("login.fnCantante")}
          </JoinFnButton>
          <JoinFnButton active={false} onClick={() => pickSocialType("productor")}>
            {t("login.fnProductor")}
          </JoinFnButton>
          <JoinFnButton active={false} onClick={() => pickSocialType("beatmaker")}>
            {t("login.fnBeatmaker")}
          </JoinFnButton>
        </div>
      </GlassModal>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="bg-ink min-h-dvh" />}>
      <LoginForm />
    </Suspense>
  );
}

/** Botón de opción del selector "¿Cómo te unes?" (grid de 4). */
function JoinFnButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 items-center justify-center rounded-lg border px-3 py-2.5 text-sm transition ${
        active
          ? "border-amethyst-300 bg-amethyst-500/15 text-white"
          : "text-silver-300 border-white/15 hover:border-white/40"
      }`}
    >
      {children}
    </button>
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
      <span className="text-silver-300 text-xs tracking-[2px] uppercase">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="text-silver-50 focus:border-amethyst-300 focus:ring-amethyst-300/80 rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 transition outline-none focus:ring-1"
      />
    </label>
  );
}

/** Campo de contraseña con botón para mostrar/ocultar el texto. Cada instancia
 * gestiona su propia visibilidad, así el toggle de la contraseña y el de su
 * confirmación son independientes. */
function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  showLabel,
  hideLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  showLabel: string;
  hideLabel: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-silver-300 text-xs tracking-[2px] uppercase">
        {label}
      </span>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className="text-silver-50 focus:border-amethyst-300 focus:ring-amethyst-300/80 w-full rounded-lg border border-white/15 bg-black/30 py-2.5 pr-11 pl-4 transition outline-none focus:ring-1"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? hideLabel : showLabel}
          aria-pressed={show}
          className="text-silver-400 hover:text-silver-100 absolute inset-y-0 right-0 flex items-center px-3 transition"
        >
          {show ? (
            <EyeOffIcon className="size-5" />
          ) : (
            <EyeIcon className="size-5" />
          )}
        </button>
      </div>
    </label>
  );
}
