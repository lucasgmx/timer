"use client";

import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card } from "@/components/ui/Card";
import { db } from "@/lib/firebase/client";
import { invoiceFromDoc } from "@/lib/firebase/clientConverters";
import type { Invoice } from "@/types";

export default function InvoicesPage() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(collection(db, "invoices"), orderBy("createdAt", "desc"), limit(100))
      );
      setInvoices(snap.docs.map(invoiceFromDoc));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  return (
    <AppShell>
      <main className="page page-grid">
        <div>
          <div className="eyebrow">billing</div>
          <h1 className="page-title">Invoice history</h1>
        </div>

        {error ? <div className="error-state">{error}</div> : null}

        <Card eyebrow="records" title="All invoices">
          {loading ? (
            <div className="loading-state">Loading invoices…</div>
          ) : (
            <InvoiceTable invoices={invoices} />
          )}
        </Card>
      </main>
    </AppShell>
  );
}


