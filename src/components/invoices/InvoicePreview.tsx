import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileInvoice } from "@fortawesome/free-solid-svg-icons";
import { Card } from "@/components/ui/Card";
import { formatCents } from "@/lib/billing/formatDuration";
import type { Invoice } from "@/types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateRange(start: string, end: string) {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  const days = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
  const startLabel = s.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = sm === em && sy === ey ? String(ed) : e.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${startLabel} → ${endLabel} (${days} ${days === 1 ? "day" : "days"})`;
}

export function InvoicePreview({
  invoice,
  onStatusClick,
  statusBusy,
  statusBadgeRef,
}: {
  invoice: Invoice;
  onStatusClick?: () => void;
  statusBusy?: boolean;
  statusBadgeRef?: React.Ref<HTMLElement>;
}) {
  const totalHours = invoice.lineItems.reduce((sum, item) => sum + item.hoursDecimal, 0);

  const badgeNode = onStatusClick ? (
    <button
      ref={statusBadgeRef as React.Ref<HTMLButtonElement>}
      onClick={onStatusClick}
      disabled={statusBusy}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: statusBusy ? "not-allowed" : "pointer",
        opacity: statusBusy ? 0.6 : 1,
        display: "inline-flex",
        alignItems: "center",
      }}
      title={invoice.status === "unpaid" ? "Mark as paid" : "Mark as unpaid"}
    >
      <InvoiceStatusBadge status={invoice.status} />
    </button>
  ) : (
    <span ref={statusBadgeRef as React.Ref<HTMLSpanElement>}>
      <InvoiceStatusBadge status={invoice.status} />
    </span>
  );

  const statusBadge = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
      {badgeNode}
      {invoice.paidAt ? (
        <div className="fine-print">Paid {formatDate(invoice.paidAt)}</div>
      ) : null}
    </div>
  );

  return (
    <Card subtitle={formatDateRange(invoice.dateRange.start, invoice.dateRange.end)} icon={<FontAwesomeIcon icon={faFileInvoice} />} action={statusBadge}>
      <div className="invoice-preview">
        <div>
          {invoice.dueDate ? (
            <div className="fine-print">Due {invoice.dueDate}</div>
          ) : null}
          {invoice.sentAt ? (
            <div className="fine-print">Sent {formatDate(invoice.sentAt)}</div>
          ) : null}
        </div>

        <div className="invoice-lines">
          {invoice.lineItems.map((lineItem) => (
            <div key={lineItem.timeEntryId} className="invoice-line">
              <span>{lineItem.taskTitle}</span>
              <span className="mono-number">{lineItem.hoursDecimal.toFixed(2)} hrs</span>
            </div>
          ))}
          <div className="invoice-line invoice-line-total">
            <span>{totalHours.toFixed(2)} hrs total</span>
            <strong className="mono-number">{formatCents(invoice.totalCents)}</strong>
          </div>
        </div>
      </div>
    </Card>
  );
}
