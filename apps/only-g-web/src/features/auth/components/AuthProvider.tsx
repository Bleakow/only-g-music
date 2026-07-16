"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ensureUserAccount, getUserAccount } from "../lib/user-repo";
import { logout as doLogout } from "../lib/auth-actions";
import type { UserAccount } from "@/domain/user";

interface AuthState {
  /** Usuario de Firebase Auth (sesión) o null. */
  user: User | null;
  /** Cuenta de dominio (incluye roles) o null. */
  account: UserAccount | null;
  /** true mientras se resuelve el estado inicial de sesión. */
  loading: boolean;
  logout: () => Promise<void>;
  /** Re-lee la cuenta desde Firestore (p. ej. tras el alta de artista o un
   * cambio de rol), para que el contexto no quede desactualizado. */
  refreshAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // `active`: evita aplicar el resultado de un ensureUserAccount obsoleto si
    // el estado de sesión cambió de nuevo (logout→login rápido) o al desmontar.
    let active = true;
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        try {
          const acc = await ensureUserAccount(fbUser);
          if (active) setAccount(acc);
        } catch {
          // Si falla la lectura (p. ej. reglas/offline), no rompemos la app.
          if (active) setAccount(null);
        }
      } else {
        setAccount(null);
      }
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const refreshAccount = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    try {
      const acc = await getUserAccount(u.uid);
      if (acc) setAccount(acc);
    } catch {
      /* sin red / reglas: conservamos la cuenta actual */
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, account, loading, logout: doLogout, refreshAccount }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  return ctx;
}
