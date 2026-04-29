"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare } from "@fortawesome/free-solid-svg-icons";
import { Save, X } from "lucide-react";
import { distributeInvoiceTotalCents } from "@/lib/billing/calculateInvoice";
import {
  calculateAmountCents,
  calculateTotalAmountCents,
  formatCents,
  formatDollarsInput,
  parseDollarsToCents,
  secondsToDecimalHours
} from "@/lib/billing/formatDuration";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type { Invoice, InvoiceLineItem } from "@/types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

type EditableLineItem = {
  timeEntryId: string;
  taskId: string;
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
    taskId: item.taskId,
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
  onSave: (
    lineItems: { timeEntryId: string; taskTitle: string; durationSeconds: number }[],
    totalCents: number
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [items, setItems] = useState<EditableLineItem[]>(() =>
    invoice.lineItems.map(toEditable)
  );
  const [totalInput, setTotalInput] = useState(() => formatDollarsInput(invoice.totalCents));
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

  const previewLineItems = items.map((item) => {
    const hours = parseFloat(item.hoursInput);
    if (!Number.isFinite(hours) || hours <= 0) return null;

    const durationSeconds = Math.round(hours * 3600);
    return {
      timeEntryId: item.timeEntryId,
      taskId: item.taskId,
      taskTitle: item.taskTitle,
      userId: item.userId,
      dateKey: item.dateKey,
      durationSeconds,
      hoursDecimal: secondsToDecimalHours(durationSeconds),
      hourlyRateCents: item.hourlyRateCents,
      amountCents: calculateAmountCents(durationSeconds, item.hourlyRateCents)
    };
  });
  const validPreviewLineItems = previewLineItems.filter(
    (item): item is InvoiceLineItem => item !== null
  );
  const calculatedTotal = calculateTotalAmountCents(validPreviewLineItems);
  const parsedTotalCents = parseDollarsToCents(totalInput);
  const previewTotal = parsedTotalCents ?? calculatedTotal;
  const distributedPreviewLineItems =
    parsedTotalCents === null
      ? validPreviewLineItems
      : distributeInvoiceTotalCents(validPreviewLineItems, parsedTotalCents);
  const previewAmountByEntryId = new Map(
    distributedPreviewLineItems.map((item) => [item.timeEntryId, item.amountCents])
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

    const totalCents = parseDollarsToCents(totalInput);
    if (totalCents === null) {
      setError("Enter a valid invoice total.");
      return;
    }

    setBusy(true);
    try {
      await onSave(
        items.map((item) => ({
          timeEntryId: item.timeEntryId,
          taskTitle: item.taskTitle.trim(),
          durationSeconds: Math.round(parseFloat(item.hoursInput) * 3600)
        })),
        totalCents
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
            const previewAmount = previewAmountByEntryId.get(item.timeEntryId) ?? amt;
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
                  {previewAmount !== null ? formatCents(previewAmount) : <span className="error-state">—</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="invoice-review-total-edit">
          <label className="fine-print" htmlFor="invoice-edit-total">
            Invoice total
          </label>
          <div className="invoice-dollar-field">
            <span className="invoice-dollar-prefix">$</span>
            <Input
              id="invoice-edit-total"
              inputMode="decimal"
              value={totalInput}
              onChange={(e) => setTotalInput(e.target.value)}
              disabled={busy}
              placeholder="0.00"
            />
          </div>
          <div className="split">
            <span className="muted">Total</span>
            <strong className="mono-number">{formatCents(previewTotal)}</strong>
          </div>
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
