"use client";

import Link from "next/link";
import { Table } from "@/components/ui/Table";
import { formatCents } from "@/lib/billing/formatDuration";
import type { Invoice } from "@/types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

export function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return <div className="empty-state">No invoices yet.</div>;
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
              <InvoiceStatusBadge status={invoice.status} />
            </td>
            <td className="mono-number">
              {invoice.dateRange.start} {"->"} {invoice.dateRange.end}
            </td>
            <td className="numeric mono-number">{formatCents(invoice.totalCents)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
