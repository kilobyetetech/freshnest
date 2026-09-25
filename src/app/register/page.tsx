"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function RegisterPage() {
  const router = useRouter();
  const { refreshClaims } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Calls our Vercel API route (Admin SDK, server-side) to set the
  // "customer" role claim and create the profile docs -- the temporary
  // stand-in for the onCustomerSignUp Cloud Function trigger, since
  // Cloud Functions need Blaze billing, which isn't set up yet.
  async function completeSignup() {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;
    await fetch("/api/complete-signup", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
  }

  async function waitForRoleClaim(maxAttempts = 8, delayMs = 500) {
    for (let i = 0; i < maxAttempts; i++) {
      await refreshClaims();
      const token = await auth.currentUser?.getIdTokenResult();
      if (token?.claims.role) return;
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await completeSignup();
      await waitForRoleClaim();
      router.push("/customer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignUp() {
    setError(null);
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      await completeSignup();
      await waitForRoleClaim();
      router.push("/customer");
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
    <main className="page">
      <h1>Create your account</h1>
      {error && <p className="error">{error}</p>}

      <button
        type="button"
        className="button"
        style={{ background: "#fff", color: "#1a1a1a", border: "1px solid #ccc", marginBottom: 16 }}
        onClick={handleGoogleSignUp}
        disabled={busy}
      >
        Continue with Google
      </button>

      <div style={{ textAlign: "center", color: "#999", fontSize: 13, marginBottom: 16 }}>
        or use email
      </div>

      <form onSubmit={handleSubmit}>
        <input
          className="field"
          type="text"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
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
          placeholder="Password (min 8 characters)"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Creating account..." : "Register"}
        </button>
      </form>
    </main>
  );
}
