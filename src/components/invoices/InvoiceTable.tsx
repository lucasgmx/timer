"use client";

import Link from "next/link";
import { useState } from "react";
import confetti from "canvas-confetti";
import { Table } from "@/components/ui/Table";
import { formatCents } from "@/lib/billing/formatDuration";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Invoice, InvoiceStatus } from "@/types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

function formatDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function InvoiceTable({ invoices: initial }: { invoices: Invoice[] }) {
  const { getToken } = useAuth();
  const [invoices, setInvoices] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  if (invoices.length === 0) {
    return <div className="empty-state">No invoices yet.</div>;
  }

  async function toggleStatus(invoice: Invoice, triggerEl: HTMLElement) {
    if (busy || invoice.status === "void") return;
    const nextStatus: InvoiceStatus = invoice.status === "unpaid" ? "paid" : "unpaid";
    const label = nextStatus === "paid" ? "paid" : "unpaid";
    if (!confirm(`Mark invoice ${invoice.invoiceNumber} as ${label}?`)) return;
    const path = nextStatus === "paid" ? "/api/invoices/mark-paid" : "/api/invoices/mark-unpaid";
    setBusy(invoice.id);
    try {
      const token = await getToken();
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ invoiceId: invoice.id })
      });
      if (!response.ok) return;
      if (nextStatus === "paid") {
        const rect = triggerEl.getBoundingClientRect();
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
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoice.id ? { ...inv, status: nextStatus } : inv
        )
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Table style={{ width: "auto", minWidth: 0 }}>
      <thead>
        <tr>
          <th style={{ width: "1%", whiteSpace: "nowrap" }}>Invoice</th>
          <th className="invoice-range-col" style={{ width: "1%", whiteSpace: "nowrap" }}>Range</th>
          <th className="numeric" style={{ width: "1%", whiteSpace: "nowrap" }}>Total</th>
          <th style={{ width: "1%", whiteSpace: "nowrap" }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td style={{ whiteSpace: "nowrap" }}>
                <Link href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link>
              </td>
              <td className="mono-number invoice-range-col" style={{ whiteSpace: "nowrap" }}>
                {formatDateKey(invoice.dateRange.start)} &rarr; {formatDateKey(invoice.dateRange.end)}
              </td>
              <td className="numeric mono-number">{formatCents(invoice.totalCents)}</td>
              <td>
                {invoice.status !== "void" ? (
                  <button
                    type="button"
                    onClick={(e) => void toggleStatus(invoice, e.currentTarget)}
                    disabled={busy === invoice.id}
                    style={{ background: "none", border: "none", padding: 0, cursor: busy === invoice.id ? "wait" : "pointer" }}
                  >
                    <InvoiceStatusBadge status={invoice.status} />
                  </button>
                ) : (
                  <InvoiceStatusBadge status={invoice.status} />
                )}
              </td>
            </tr>
          ))}
      </tbody>
    </Table>
  );
}
