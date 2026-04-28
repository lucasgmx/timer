"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Script from "next/script";
import { LogIn } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

if (typeof window !== "undefined" && !RECAPTCHA_SITE_KEY && process.env.NODE_ENV === "development") {
  console.warn("[Timer] NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set. reCAPTCHA is disabled.");
}

export default function HomePage() {
  const router = useRouter();
  const { user, profile, loading, error, signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
        const token = await new Promise<string>((resolve, reject) => {
          window.grecaptcha.ready(() => {
            window.grecaptcha
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

  return (
    <main className="login-screen">
      {RECAPTCHA_SITE_KEY && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
          strategy="afterInteractive"
        />
      )}
      <div className="login-logo">
        <Image src="/logo_white.png" alt="Timer" width={360} height={51} priority style={{ width: "100%", height: "auto" }} />
      </div>
      <Card className="login-card">
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
          <Button type="submit" variant="primary" icon={submitting ? undefined : <LogIn />} disabled={submitting}>
            {submitting ? (
              <span className="login-spinner-row"><span className="login-spinner" aria-hidden="true" />Signing in...</span>
            ) : "Sign in"}
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
