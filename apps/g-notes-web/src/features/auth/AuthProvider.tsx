"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithCustomToken,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";

interface AuthState {
  user: User | null;
  /** true hasta que Firebase resuelve si hay sesión (evita parpadeo del gate). */
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true });

/**
 * Estado de sesión de G Notes. Mismo proyecto Firebase que Only G Music → mismo
 * `uid`. Aquí solo interesa la identidad; los roles/entitlements llegan en M7.
 *
 * Soporta el hand-off SSO desde Only G: la sesión llega en el fragmento de la URL
 * (#sso=<idToken>), que NO se envía a servidores ni en el Referer. Se cambia
 * server-side por una sesión propia y se limpia la URL al instante.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  const ssoInFlight = useRef(false);

  useEffect(() => {
    const match = window.location.hash.match(/[#&]sso=([^&]+)/);
    if (match) {
      ssoInFlight.current = true;
      const idToken = decodeURIComponent(match[1]);
      // Limpia el token de la URL de inmediato (que no quede en historial).
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
      void (async () => {
        try {
          const res = await fetch("/api/auth/sso", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ idToken }),
          });
          const data = res.ok
            ? ((await res.json()) as { customToken?: string })
            : null;
          if (data?.customToken) {
            await signInWithCustomToken(auth, data.customToken);
            return; // onAuthStateChanged pondrá el user y bajará loading
          }
        } catch {
          /* red o token inválido: cae al login normal */
        } finally {
          ssoInFlight.current = false;
        }
        // El hand-off no cuajó: muestra el login normal.
        setState({ user: auth.currentUser, loading: false });
      })();
    }

    return onAuthStateChanged(auth, (user) => {
      // Con el SSO en curso y sin user aún, no bajes loading (evita el flash del
      // login mientras se intercambia el token).
      if (!user && ssoInFlight.current) return;
      setState({ user, loading: false });
    });
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
