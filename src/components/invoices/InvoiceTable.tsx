"use client";

import Link from "next/link";
import { useState } from "react";
import { Table } from "@/components/ui/Table";
import { formatCents } from "@/lib/billing/formatDuration";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Invoice } from "@/types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

export function InvoiceTable({ invoices: initial }: { invoices: Invoice[] }) {
  const { getToken } = useAuth();
  const [invoices, setInvoices] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  if (invoices.length === 0) {
    return <div className="empty-state">No invoices yet.</div>;
  }

  async function toggleStatus(invoice: Invoice) {
    if (invoice.status === "void" || busy) return;
    setBusy(invoice.id);
    try {
      const token = await getToken();
      const path =
        invoice.status === "unpaid"
          ? "/api/invoices/mark-paid"
          : "/api/invoices/mark-unpaid";
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ invoiceId: invoice.id })
      });
      if (!response.ok) return;
      const { status } = (await response.json()) as { status: string };
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoice.id ? { ...inv, status: status as Invoice["status"] } : inv
        )
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Table>
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Status</th>
          <th>Range</th>
          <th className="numeric">Total</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((invoice) => (
          <tr key={invoice.id}>
            <td>
              <Link href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link>
              <div className="fine-print">{invoice.clientName}</div>
            </td>
            <td>
              {invoice.status !== "void" ? (
                <button
                  type="button"
                  onClick={() => void toggleStatus(invoice)}
                  disabled={busy === invoice.id}
                  style={{ background: "none", border: "none", padding: 0, cursor: busy === invoice.id ? "wait" : "pointer" }}
                >
                  <InvoiceStatusBadge status={invoice.status} />
                </button>
              ) : (
                <InvoiceStatusBadge status={invoice.status} />
              )}
            </td>
            <td className="mono-number">
              {invoice.dateRange.start} &rarr; {invoice.dateRange.end}
            </td>
            <td className="numeric mono-number">{formatCents(invoice.totalCents)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
