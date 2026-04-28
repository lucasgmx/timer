import { Card } from "@/components/ui/Card";
import { formatCents } from "@/lib/billing/formatDuration";
import type { Invoice } from "@/types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const totalHours = invoice.lineItems.reduce((sum, item) => sum + item.hoursDecimal, 0);

  return (
    <Card eyebrow="invoice detail" title={invoice.invoiceNumber}>
      <div className="invoice-preview">
        <div className="split">
          <div>
            <div className="muted">{invoice.clientName}</div>
            <div className="fine-print mono-number">
              {invoice.dateRange.start} &rarr; {invoice.dateRange.end}
            </div>
            {invoice.dueDate ? (
              <div className="fine-print">Due {invoice.dueDate}</div>
            ) : null}
          </div>
          <div style={{ display: "grid", gap: "4px", textAlign: "right" }}>
            <InvoiceStatusBadge status={invoice.status} />
            {invoice.sentAt ? (
              <div className="fine-print">Sent {formatDate(invoice.sentAt)}</div>
            ) : null}
            {invoice.paidAt ? (
              <div className="fine-print">Paid {formatDate(invoice.paidAt)}</div>
            ) : null}
          </div>
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
