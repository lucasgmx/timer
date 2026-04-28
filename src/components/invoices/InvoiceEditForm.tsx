"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare } from "@fortawesome/free-solid-svg-icons";
import { Save, X } from "lucide-react";
import { calculateAmountCents, calculateTotalAmountCents, formatCents, secondsToDecimalHours } from "@/lib/billing/formatDuration";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type { Invoice, InvoiceLineItem } from "@/types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

type EditableLineItem = {
  timeEntryId: string;
  taskTitle: string;
  hoursInput: string;
  // read-only snapshot fields
  hourlyRateCents: number;
  dateKey: string;
  userId: string;
};

function toEditable(item: InvoiceLineItem): EditableLineItem {
  return {
    timeEntryId: item.timeEntryId,
    taskTitle: item.taskTitle,
    hoursInput: secondsToDecimalHours(item.durationSeconds).toFixed(2),
    hourlyRateCents: item.hourlyRateCents,
    dateKey: item.dateKey,
    userId: item.userId
  };
}

export function InvoiceEditForm({
  invoice,
  onSave,
  onCancel
}: {
  invoice: Invoice;
  onSave: (lineItems: { timeEntryId: string; taskTitle: string; durationSeconds: number }[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [items, setItems] = useState<EditableLineItem[]>(() =>
    invoice.lineItems.map(toEditable)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(index: number, patch: Partial<EditableLineItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function computedAmount(item: EditableLineItem) {
    const hours = parseFloat(item.hoursInput);
    if (!Number.isFinite(hours) || hours <= 0) return null;
    return calculateAmountCents(Math.round(hours * 3600), item.hourlyRateCents);
  }

  const previewTotal = calculateTotalAmountCents(
    items
      .map((item) => {
        const hours = parseFloat(item.hoursInput);
        if (!Number.isFinite(hours) || hours <= 0) return null;
        return { durationSeconds: Math.round(hours * 3600), hourlyRateCents: item.hourlyRateCents };
      })
      .filter((item): item is { durationSeconds: number; hourlyRateCents: number } => item !== null)
  );

  async function handleSave() {
    setError(null);

    for (const item of items) {
      const hours = parseFloat(item.hoursInput);
      if (!Number.isFinite(hours) || hours <= 0) {
        setError(`"${item.taskTitle}" has an invalid duration.`);
        return;
      }
      if (!item.taskTitle.trim()) {
        setError("All line items must have a task name.");
        return;
      }
    }

    setBusy(true);
    try {
      await onSave(
        items.map((item) => ({
          timeEntryId: item.timeEntryId,
          taskTitle: item.taskTitle.trim(),
          durationSeconds: Math.round(parseFloat(item.hoursInput) * 3600)
        }))
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save changes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card eyebrow="editing" title={invoice.invoiceNumber} icon={<FontAwesomeIcon icon={faPenToSquare} />}>
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

        <div className="invoice-lines invoice-edit-lines">
          {items.map((item, index) => {
            const amt = computedAmount(item);
            return (
              <div key={item.timeEntryId} className="invoice-edit-row">
                <div className="invoice-edit-fields">
                  <div className="field">
                    <label className="fine-print" htmlFor={`task-title-${index}`}>
                      Task name
                    </label>
                    <Input
                      id={`task-title-${index}`}
                      value={item.taskTitle}
                      onChange={(e) => updateItem(index, { taskTitle: e.target.value })}
                      placeholder="Task name"
                      disabled={busy}
                    />
                  </div>
                  <div className="field invoice-edit-hours-field">
                    <label className="fine-print" htmlFor={`hours-${index}`}>
                      Hours
                    </label>
                    <Input
                      id={`hours-${index}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.hoursInput}
                      onChange={(e) => updateItem(index, { hoursInput: e.target.value })}
                      disabled={busy}
                    />
                  </div>
                </div>
                <div className="invoice-edit-amount numeric mono-number">
                  {amt !== null ? formatCents(amt) : <span className="error-state">—</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="split">
          <span className="muted">Total</span>
          <strong className="mono-number">{formatCents(previewTotal)}</strong>
        </div>

        {error ? <div className="error-state">{error}</div> : null}

        <div className="cluster">
          <Button icon={<X />} onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Save />} onClick={() => void handleSave()} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
