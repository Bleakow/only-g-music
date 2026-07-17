"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
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
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(
    () => onAuthStateChanged(auth, (user) => setState({ user, loading: false })),
    [],
  );

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
