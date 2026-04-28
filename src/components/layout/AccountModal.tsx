"use client";

import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { Fingerprint, KeyRound, Loader2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/components/providers/AuthProvider";

type PasskeyRow = {
  credentialID: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string | null;
};

type Props = {
  onClose: () => void;
};

export function AccountModal({ onClose }: Props) {
  const { getToken } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(true);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [addingPasskey, setAddingPasskey] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const loadPasskeys = useCallback(async () => {
    setLoadingPasskeys(true);
    setPasskeyError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/passkeys/list", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { passkeys: PasskeyRow[] };
      setPasskeys(data.passkeys);
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : "Could not load passkeys.");
    } finally {
      setLoadingPasskeys(false);
    }
  }, [getToken]);

  useEffect(() => {
    void loadPasskeys();
  }, [loadPasskeys]);

  // Trap focus and open the native dialog
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    el.showModal();
    return () => {
      if (el.open) el.close();
    };
  }, []);

  // Close on backdrop click
  function handleDialogClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) onClose();
  }

  async function addPasskey() {
    setAddingPasskey(true);
    setPasskeyError(null);
    try {
      const token = await getToken();

      // 1. Get registration options
      const optRes = await fetch("/api/passkeys/register-options", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: "{}"
      });
      if (!optRes.ok) throw new Error(await optRes.text());
      const { options, challengeId } = (await optRes.json()) as {
        options: PublicKeyCredentialCreationOptionsJSON;
        challengeId: string;
      };

      // 2. Prompt user to register with their authenticator
      const regResponse = await startRegistration({ optionsJSON: options });

      // 3. Verify with server
      const verRes = await fetch("/api/passkeys/register-verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ challengeId, response: regResponse })
      });
      if (!verRes.ok) throw new Error(await verRes.text());

      await loadPasskeys();
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setPasskeyError("Passkey registration was cancelled.");
      } else {
        setPasskeyError(err instanceof Error ? err.message : "Failed to add passkey.");
      }
    } finally {
      setAddingPasskey(false);
    }
  }

  async function removePasskey(credentialID: string) {
    setPasskeyError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/passkeys/remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ credentialID })
      });
      if (!res.ok) throw new Error(await res.text());
      await loadPasskeys();
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : "Failed to remove passkey.");
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }

    setPwBusy(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      });
      if (!res.ok) throw new Error(await res.text());
      setNewPassword("");
      setConfirmPassword("");
      setPwSuccess(true);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setPwBusy(false);
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return "Unknown";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  return (
    <dialog ref={dialogRef} className="account-modal" onClick={handleDialogClick}>
      <div className="account-modal-inner">
        <div className="account-modal-header">
          <span className="account-modal-title">Account</span>
          <button className="account-modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Passkeys section */}
        <section className="account-section">
          <div className="account-section-heading">
            <Fingerprint size={15} />
            Passkeys
          </div>
          {loadingPasskeys ? (
            <div className="account-loading">
              <Loader2 size={14} className="spin" /> Loading…
            </div>
          ) : (
            <>
              {passkeys.length === 0 ? (
                <p className="account-empty">No passkeys registered.</p>
              ) : (
                <ul className="passkey-list">
                  {passkeys.map((pk) => (
                    <li key={pk.credentialID} className="passkey-row">
                      <div className="passkey-info">
                        <span className="passkey-type">
                          {pk.deviceType === "multiDevice" ? "Synced passkey" : "Device-bound passkey"}
                        </span>
                        <span className="passkey-date">Added {formatDate(pk.createdAt)}</span>
                      </div>
                      <button
                        className="passkey-remove"
                        onClick={() => void removePasskey(pk.credentialID)}
                        aria-label="Remove passkey"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {passkeyError ? <div className="account-error">{passkeyError}</div> : null}
              <Button
                variant="secondary"
                icon={addingPasskey ? <Loader2 size={14} className="spin" /> : <KeyRound size={14} />}
                onClick={() => void addPasskey()}
                disabled={addingPasskey}
              >
                {addingPasskey ? "Registering…" : "Add passkey"}
              </Button>
            </>
          )}
        </section>

        {/* Change password section */}
        <section className="account-section">
          <div className="account-section-heading">
            <KeyRound size={15} />
            Change password
          </div>
          <form className="account-pw-form" onSubmit={(e) => void changePassword(e)}>
            <div className="field">
              <label htmlFor="acc-new-pw">New password</label>
              <Input
                id="acc-new-pw"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="field">
              <label htmlFor="acc-confirm-pw">Confirm password</label>
              <Input
                id="acc-confirm-pw"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {pwError ? <div className="account-error">{pwError}</div> : null}
            {pwSuccess ? <div className="account-success">Password updated.</div> : null}
            <Button type="submit" variant="primary" disabled={pwBusy}>
              {pwBusy ? "Saving…" : "Save password"}
            </Button>
          </form>
        </section>
      </div>
    </dialog>
  );
}
