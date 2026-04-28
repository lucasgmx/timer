"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Script from "next/script";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { Fingerprint, LogIn } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import MatrixRain from "@/components/MatrixRain";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

declare global {
  interface Window {
    grecaptcha: {
      enterprise: {
        ready: (callback: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };
    };
  }
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

if (typeof window !== "undefined" && !RECAPTCHA_SITE_KEY && process.env.NODE_ENV === "development") {
  console.warn("[Timer] NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set. reCAPTCHA is disabled.");
}

export default function HomePage() {
  const router = useRouter();
  const { user, profile, loading, error, signIn, signInWithToken } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(!RECAPTCHA_SITE_KEY);

  useEffect(() => {
    if (!loading && user && profile) {
      router.replace("/dashboard");
    }
  }, [loading, profile, router, user]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      if (RECAPTCHA_SITE_KEY) {
        if (!recaptchaLoaded || !window.grecaptcha?.enterprise) {
          throw new Error("Security check is not ready. Please wait a moment and try again.");
        }
        const token = await new Promise<string>((resolve, reject) => {
          window.grecaptcha.enterprise.ready(() => {
            window.grecaptcha.enterprise
              .execute(RECAPTCHA_SITE_KEY, { action: "login" })
              .then(resolve)
              .catch(reject);
          });
        });

        const verifyRes = await fetch("/api/auth/recaptcha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!verifyRes.ok) {
          throw new Error("reCAPTCHA verification failed. Please try again.");
        }
      }

      await signIn(username, password);
    } catch (signInError) {
      setFormError(
        signInError instanceof Error ? signInError.message : "Unable to sign in."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasskeySignIn() {
    setPasskeyBusy(true);
    setFormError(null);
    try {
      // 1. Get authentication options (pass username hint if filled in)
      const optRes = await fetch("/api/passkeys/auth-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username || undefined })
      });
      if (!optRes.ok) throw new Error(await optRes.text());
      const { options, challengeId } = (await optRes.json()) as {
        options: PublicKeyCredentialRequestOptionsJSON;
        challengeId: string;
      };

      // 2. Prompt browser for passkey assertion
      const authResponse = await startAuthentication({ optionsJSON: options });

      // 3. Verify with server and get custom token
      const verRes = await fetch("/api/passkeys/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, response: authResponse })
      });
      if (!verRes.ok) throw new Error(await verRes.text());
      const { customToken } = (await verRes.json()) as { customToken: string };

      // 4. Sign in to Firebase with the custom token
      await signInWithToken(customToken);
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setFormError("Passkey sign-in was cancelled.");
      } else {
        setFormError(err instanceof Error ? err.message : "Passkey sign-in failed.");
      }
    } finally {
      setPasskeyBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <MatrixRain />
      {RECAPTCHA_SITE_KEY && (
        <Script
          src={`https://www.google.com/recaptcha/enterprise.js?render=${RECAPTCHA_SITE_KEY}`}
          strategy="afterInteractive"
          onLoad={() => setRecaptchaLoaded(true)}
        />
      )}
      <div className="login-logo" style={{ position: "relative", zIndex: 1 }}>
        <Image src="/logo_white.png" alt="Timer" width={360} height={51} priority style={{ width: "100%", height: "auto" }} />
      </div>
      <Card className="login-card" style={{ position: "relative", zIndex: 1 }}>
        <h2 className="login-title">
          <span className="login-title-accent">timer</span>
          <span className="login-title-dot">.</span>
          <span>marques</span>
          <span className="login-title-dot">.</span>
          <span>llc</span>
        </h2>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">Username</label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error || formError ? (
            <div className="error-state">{formError ?? error}</div>
          ) : null}
          <Button type="submit" variant="primary" icon={submitting ? undefined : <LogIn />} disabled={submitting || !recaptchaLoaded}>
            {submitting ? (
              <span className="login-spinner-row"><span className="login-spinner" aria-hidden="true" />Signing in...</span>
            ) : "Sign in"}
          </Button>
          <div className="login-divider"><span>or</span></div>
          <Button
            type="button"
            variant="secondary"
            icon={<Fingerprint size={16} />}
            onClick={() => void handlePasskeySignIn()}
            disabled={passkeyBusy || submitting}
          >
            {passkeyBusy ? "Waiting for passkey…" : "Sign in with passkey"}
          </Button>
          {RECAPTCHA_SITE_KEY && (
            <p className="recaptcha-notice">
              Protected by reCAPTCHA —{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Privacy</a>
              {" & "}
              <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer">Terms</a>
            </p>
          )}
        </form>
      </Card>
    </main>
  );
}
