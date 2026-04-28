"use client";

import { addDays } from "@/lib/dates/dateKeys";
import type { CalendarDaySummary } from "@/types";
import type { DateRange } from "./DateRangePicker";

export function InvoiceCalendar({
  range,
  summaries
}: {
  range: DateRange;
  summaries: CalendarDaySummary[];
}) {
  const byDate = new Map(summaries.map((summary) => [summary.dateKey, summary]));
  const days: string[] = [];
  let cursor = range.start;

  while (cursor <= range.end && days.length < 62) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return (
    <div className="calendar-grid">
      {days.map((dateKey) => {
        const summary = byDate.get(dateKey);
        return (
          <div
            key={dateKey}
            className="calendar-day"
            data-status={summary?.status ?? "empty"}
            title={summary?.status ?? "empty"}
          >
            <strong>{dateKey.slice(8)}</strong>
            {summary && summary.totalDurationSeconds > 0 ? (
              <div className="fine-print mono-number">
                {(summary.totalDurationSeconds / 3600).toFixed(1)}h
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
