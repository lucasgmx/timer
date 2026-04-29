"use client";

import confetti from "canvas-confetti";
import { doc, getDoc } from "firebase/firestore";
import { CheckCircle2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { InvoiceEditForm } from "@/components/invoices/InvoiceEditForm";
import { InvoicePreview } from "@/components/invoices/InvoicePreview";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { db } from "@/lib/firebase/client";
import { invoiceFromDoc } from "@/lib/firebase/clientConverters";
import type { Invoice } from "@/types";

export default function InvoiceDetailPage() {
  const params = useParams<{ invoiceId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken, profile } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(() => searchParams.get("edit") === "true");
  const statusBadgeRef = useRef<HTMLHeadingElement>(null);

  const loadInvoice = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const snap = await getDoc(doc(db, "invoices", params.invoiceId));

      if (!snap.exists()) {
        throw new Error("Invoice was not found.");
      }

      setInvoice(invoiceFromDoc(snap));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load invoice.");
    } finally {
      setLoading(false);
    }
  }, [params.invoiceId]);

  useEffect(() => {
    void loadInvoice();
  }, [loadInvoice]);

  async function updateStatus(path: string) {
    setBusy(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ invoiceId: params.invoiceId })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      if (path === "/api/invoices/mark-paid" && statusBadgeRef.current) {
        const rect = statusBadgeRef.current.getBoundingClientRect();
        void confetti({
          particleCount: 120,
          spread: 80,
          origin: {
            x: (rect.left + rect.width / 2) / window.innerWidth,
            y: (rect.top + rect.height / 2) / window.innerHeight,
          },
          colors: ["#52ff8a", "#fffb6e", "#6ec7ff", "#ff6ec7", "#ffb347"],
        });
      }

      await loadInvoice();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to update invoice.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteInvoice() {
    if (!invoice) return;
    if (!confirm(`Delete invoice ${invoice.invoiceNumber}? This will return its time entries to uninvoiced work.`)) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch("/api/invoices/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ invoiceId: params.invoiceId })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      router.push("/dashboard");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete invoice.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveLineItems(
    lineItems: { timeEntryId: string; taskTitle: string; durationSeconds: number }[]
  ) {
    const token = await getToken();
    const response = await fetch("/api/invoices/update-line-items", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ invoiceId: params.invoiceId, lineItems })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    await loadInvoice();
    setEditMode(false);
    router.replace(`/invoices/${params.invoiceId}`);
  }

  return (
    <AppShell>
      <main className="page page-grid">
        <div className="split">
          <div>
            <div className="eyebrow">invoice</div>
            <h1 className="page-title" ref={statusBadgeRef}>{invoice?.invoiceNumber ?? "Invoice"}</h1>
          </div>
          {profile?.role === "admin" && invoice && !editMode ? (
            <div className="cluster">
              {invoice.status === "unpaid" ? (
                <Button
                  icon={<Pencil />}
                  onClick={() => setEditMode(true)}
                  disabled={busy}
                >
                  Edit
                </Button>
              ) : null}
              {invoice.status === "unpaid" ? (
                <Button
                  variant="primary"
                  icon={<CheckCircle2 />}
                  disabled={busy}
                  onClick={() => updateStatus("/api/invoices/mark-paid")}
                >
                  Mark paid
                </Button>
              ) : null}
              {invoice.status === "paid" ? (
                <Button
                  icon={<RotateCcw />}
                  disabled={busy}
                  onClick={() => updateStatus("/api/invoices/mark-unpaid")}
                >
                  Mark unpaid
                </Button>
              ) : null}
              {invoice.status !== "paid" ? (
                <div style={{ display: "flex", borderLeft: "1px solid var(--border)", paddingLeft: "8px" }}>
                  <Button
                    variant="danger"
                    icon={<Trash2 />}
                    disabled={busy}
                    onClick={() => void deleteInvoice()}
                  >
                    Delete
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {loading ? <div className="loading-state">Loading invoice...</div> : null}
        {error ? <div className="error-state">{error}</div> : null}
        {invoice && editMode ? (
          <InvoiceEditForm
            invoice={invoice}
            onSave={handleSaveLineItems}
            onCancel={() => {
              setEditMode(false);
              router.replace(`/invoices/${params.invoiceId}`);
            }}
          />
        ) : invoice ? (
          <InvoicePreview invoice={invoice} />
        ) : null}
        {!loading && !invoice && !error ? (
          <Card>
            <div className="empty-state">Invoice not found.</div>
          </Card>
        ) : null}
      </main>
    </AppShell>
  );
}
