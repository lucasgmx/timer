import { Card } from "@/components/ui/Card";
import { formatCents, formatDuration } from "@/lib/billing/formatDuration";
import type { Invoice } from "@/types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

export function InvoicePreview({ invoice }: { invoice: Invoice }) {
  return (
    <Card eyebrow="invoice detail" title={invoice.invoiceNumber}>
      <div className="invoice-preview">
        <div className="split">
          <div>
            <div className="muted">{invoice.clientName}</div>
            <div className="fine-print mono-number">
              {invoice.dateRange.start} {"->"} {invoice.dateRange.end}
            </div>
          </div>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <div className="invoice-lines">
          {invoice.lineItems.map((lineItem) => (
            <div key={lineItem.timeEntryId} className="invoice-line">
              <div>
                <strong>{lineItem.taskTitle}</strong>
                {lineItem.description ? (
                  <div className="fine-print">{lineItem.description}</div>
                ) : null}
              </div>
              <div className="numeric mono-number">
                <div>{formatDuration(lineItem.durationSeconds)}</div>
                <div>{formatCents(lineItem.amountCents)}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="split">
          <span className="muted">Total</span>
          <strong className="mono-number">{formatCents(invoice.totalCents)}</strong>
        </div>
      </div>
    </Card>
  );
}
