"use client";

import { useState } from "react";
import { FilePlus2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import type { DateRange } from "@/components/calendar/DateRangePicker";

export function GenerateInvoiceButton({
  range,
  selectedEntryIds,
  clientName,
  dueDate,
  onGenerated
}: {
  range: DateRange;
  selectedEntryIds: string[];
  clientName: string;
  dueDate?: string;
  onGenerated: () => Promise<void> | void;
}) {
  const { getToken, profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (profile?.role !== "admin") {
    return null;
  }

  async function handleClick() {
    setBusy(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch("/api/invoices/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          clientName,
          dateRange: range,
          dueDate: dueDate || null,
          timeEntryIds: selectedEntryIds.length ? selectedEntryIds : undefined
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await onGenerated();
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Unable to generate invoice.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <Button
        variant="primary"
        icon={<FilePlus2 />}
        onClick={handleClick}
        disabled={busy || !clientName}
      >
        {busy ? "Generating..." : "Generate invoice"}
      </Button>
      {error ? <div className="error-state">{error}</div> : null}
    </div>
  );
}
