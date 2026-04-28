"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Table } from "@/components/ui/Table";
import { formatCents } from "@/lib/billing/formatDuration";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Invoice, InvoiceStatus } from "@/types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

const STATUS_ACTIONS: Record<
  Exclude<InvoiceStatus, "void">,
  { label: string; path: string; nextStatus: InvoiceStatus; destructive?: boolean }[]
> = {
  unpaid: [
    { label: "Mark as paid", path: "/api/invoices/mark-paid", nextStatus: "paid" },
    { label: "Void invoice", path: "/api/invoices/void", nextStatus: "void", destructive: true }
  ],
  paid: [
    { label: "Mark as unpaid", path: "/api/invoices/mark-unpaid", nextStatus: "unpaid" },
    { label: "Void invoice", path: "/api/invoices/void", nextStatus: "void", destructive: true }
  ]
};

export function InvoiceTable({ invoices: initial }: { invoices: Invoice[] }) {
  const { getToken } = useAuth();
  const [invoices, setInvoices] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuId]);

  if (invoices.length === 0) {
    return <div className="empty-state">No invoices yet.</div>;
  }

  async function applyStatus(
    invoice: Invoice,
    path: string,
    nextStatus: InvoiceStatus,
    destructive?: boolean
  ) {
    if (busy) return;
    if (destructive && !confirm(`Void invoice ${invoice.invoiceNumber}? This cannot be undone.`)) return;
    setMenuId(null);
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
        {invoices.map((invoice) => {
          const actions = invoice.status !== "void" ? STATUS_ACTIONS[invoice.status] : null;
          return (
            <tr key={invoice.id}>
              <td>
                <Link href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link>
                <div className="fine-print">{invoice.clientName}</div>
              </td>
              <td>
                <div style={{ position: "relative", display: "inline-block" }} ref={menuId === invoice.id ? menuRef : undefined}>
                  {actions ? (
                    <button
                      type="button"
                      onClick={() => setMenuId(menuId === invoice.id ? null : invoice.id)}
                      disabled={busy === invoice.id}
                      style={{ background: "none", border: "none", padding: 0, cursor: busy === invoice.id ? "wait" : "pointer" }}
                    >
                      <InvoiceStatusBadge status={invoice.status} />
                    </button>
                  ) : (
                    <InvoiceStatusBadge status={invoice.status} />
                  )}
                  {menuId === invoice.id && actions && (
                    <div style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      zIndex: 50,
                      background: "var(--surface-2, #1a1a1a)",
                      border: "1px solid var(--border, #333)",
                      borderRadius: 6,
                      minWidth: 160,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                      overflow: "hidden"
                    }}>
                      {actions.map((action) => (
                        <button
                          key={action.path}
                          type="button"
                          onClick={() => void applyStatus(invoice, action.path, action.nextStatus, action.destructive)}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            background: "none",
                            border: "none",
                            padding: "8px 12px",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            color: action.destructive ? "var(--color-red, #f87171)" : "var(--text-1, #e5e5e5)",
                            whiteSpace: "nowrap"
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3, #222)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </td>
              <td className="mono-number">
                {invoice.dateRange.start} &rarr; {invoice.dateRange.end}
              </td>
              <td className="numeric mono-number">{formatCents(invoice.totalCents)}</td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
