"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { onIdTokenChanged, User, getIdTokenResult } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import type { Role } from "@/types/models";

interface AuthState {
  user: User | null;
  role: Role | null;
  loading: boolean;
  /**
   * Forces a fresh ID token fetch, picking up any custom claim changes
   * that happened server-side after the current session began (e.g. a
   * role change). The current token is NOT automatically updated when a
   * claim changes server-side — this must be called explicitly. Route
   * guards should never assume a stale token reflects a new role.
   */
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  role: null,
  loading: true,
  refreshClaims: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  const loadClaims = useCallback(async (firebaseUser: User | null, forceRefresh: boolean) => {
    if (!firebaseUser) {
      setUser(null);
      setRole(null);
      setLoading(false);
      return;
    }
    const tokenResult = await getIdTokenResult(firebaseUser, forceRefresh);
    const claimRole = tokenResult.claims.role as Role | undefined;
    setUser(firebaseUser);
    // Treat "claim missing from current token" as unauthorized rather
    // than silently retrying or assuming a default — the sign-up trigger
    // and provisionStaffUser are the only paths that set this claim, and
    // if it's absent this token predates that write completing.
    setRole(claimRole ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // onIdTokenChanged (not onAuthStateChanged) so we also react whenever
    // the SDK internally refreshes the token, in addition to sign-in/out.
    const unsubscribe = onIdTokenChanged(auth, (firebaseUser) => {
      void loadClaims(firebaseUser, false);
    });
    return unsubscribe;
  }, [loadClaims]);

  const refreshClaims = useCallback(async () => {
    if (auth.currentUser) {
      await loadClaims(auth.currentUser, true);
    }
  }, [loadClaims]);

  return (
    <AuthContext.Provider value={{ user, role, loading, refreshClaims }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
