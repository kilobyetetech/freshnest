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

export default function LoginPage() {
  const router = useRouter();
  const { refreshClaims } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function afterSignIn() {
    // A fresh sign-in produces a token containing current claims, but we
    // still force a refresh as defense-in-depth. For a brand-new Google
    // account, the onCustomerSignUp trigger runs asynchronously after
    // this resolves -- poll briefly rather than assuming it's instant.
    for (let i = 0; i < 8; i++) {
      await refreshClaims();
      const token = await auth.currentUser?.getIdTokenResult();
      if (token?.claims.role) break;
      await new Promise((res) => setTimeout(res, 400));
    }
    router.push("/");
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
          : "Google sign-in failed. If you're inside an in-app browser (e.g. from Snapchat/TikTok/Telegram), open this page in Chrome instead -- Google blocks sign-in inside most embedded browsers."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <h1>Log in</h1>
      {error && <p className="error">{error}</p>}

      <button
        type="button"
        className="button"
        style={{ background: "#fff", color: "#1a1a1a", border: "1px solid #ccc", marginBottom: 16 }}
        onClick={handleGoogleSignIn}
        disabled={busy}
      >
        Continue with Google
      </button>

      <div style={{ textAlign: "center", color: "#999", fontSize: 13, marginBottom: 16 }}>
        or use email
      </div>

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
          {busy ? "Signing in..." : "Log in"}
        </button>
      </form>

      <p style={{ fontSize: 14, marginTop: 16 }}>
        New here? <a href="/register">Create an account</a>
      </p>
    </main>
  );
}
