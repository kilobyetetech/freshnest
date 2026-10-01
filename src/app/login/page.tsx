"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { portalPathForRole } from "@/lib/auth/portalPathForRole";
import { Brand } from "@/components/Brand";
import type { Role } from "@/types/models";

export default function LoginPage() {
  const router = useRouter();
  const { refreshClaims } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function completeSignup() {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;
    await fetch("/api/complete-signup", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
  }

  async function afterSignIn() {
    await completeSignup();
    let role: Role | null = null;
    for (let i = 0; i < 8; i++) {
      await refreshClaims();
      const token = await auth.currentUser?.getIdTokenResult();
      const claimRole = token?.claims.role as Role | undefined;
      if (claimRole) {
        role = claimRole;
        break;
      }
      await new Promise((res) => setTimeout(res, 400));
    }
    router.push(portalPathForRole(role));
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      await afterSignIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      await afterSignIn();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Google sign-in failed. If you're inside an in-app browser, open this page in Chrome instead."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-wrap">
      <Brand variant="full" />
      <h1>Welcome back</h1>
      {error && <p className="error">{error}</p>}

      <button type="button" className="button secondary" onClick={handleGoogleSignIn} disabled={busy}>
        Continue with Google
      </button>
      <div className="divider">or use email</div>

      <form onSubmit={handleEmailLogin}>
        <input
          className="field"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="field"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Log in"}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 20, textAlign: "center" }}>
        New here? <a href="/register">Create an account</a>
      </p>
    </main>
  );
}
