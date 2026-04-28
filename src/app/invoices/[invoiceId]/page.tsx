"use client";

import { doc, getDoc } from "firebase/firestore";
import { Send, Ban, CheckCircle2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
  const { getToken, profile } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      await loadInvoice();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to update invoice.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main className="page page-grid">
        <div className="split">
          <div>
            <div className="eyebrow">invoice</div>
            <h1 className="page-title">{invoice?.invoiceNumber ?? "Invoice"}</h1>
          </div>
          {profile?.role === "admin" && invoice ? (
            <div className="cluster">
              <Button
                icon={<Send />}
                disabled={busy || invoice.status === "paid" || invoice.status === "void"}
                onClick={() => updateStatus("/api/invoices/mark-sent")}
              >
                Mark sent
              </Button>
              <Button
                variant="primary"
                icon={<CheckCircle2 />}
                disabled={busy || invoice.status === "paid" || invoice.status === "void"}
                onClick={() => updateStatus("/api/invoices/mark-paid")}
              >
                Mark paid
              </Button>
              <Button
                variant="danger"
                icon={<Ban />}
                disabled={busy || invoice.status === "void"}
                onClick={() => updateStatus("/api/invoices/void")}
              >
                Void
              </Button>
            </div>
          ) : null}
        </div>

        {loading ? <div className="loading-state">Loading invoice...</div> : null}
        {error ? <div className="error-state">{error}</div> : null}
        {invoice ? <InvoicePreview invoice={invoice} /> : null}
        {!loading && !invoice && !error ? (
          <Card>
            <div className="empty-state">Invoice not found.</div>
          </Card>
        ) : null}
      </main>
    </AppShell>
  );
}
