"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { todayDateKey } from "@/lib/dates/dateKeys";
import type { CalendarDaySummary } from "@/types";
import type { DateRange } from "./DateRangePicker";

const DOW_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type DashboardCalendarProps = {
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  summaries?: CalendarDaySummary[];
  onViewChange?: (year: number, month: number) => void;
};

export function DashboardCalendar({
  range,
  onRangeChange,
  summaries = [],
  onViewChange
}: DashboardCalendarProps) {
  const today = todayDateKey();
  const [viewYear, setViewYear] = useState(() => {
    const d = new Date(`${range.end}T00:00:00Z`);
    return d.getUTCFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(`${range.end}T00:00:00Z`);
    return d.getUTCMonth();
  });
  const [selecting, setSelecting] = useState(false);

  const byDate = useMemo(
    () => new Map(summaries.map((s) => [s.dateKey, s])),
    [summaries]
  );

  function goToPrevMonth() {
    let newYear = viewYear;
    let newMonth = viewMonth - 1;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    setViewYear(newYear);
    setViewMonth(newMonth);
    onViewChange?.(newYear, newMonth);
  }

  function goToNextMonth() {
    let newYear = viewYear;
    let newMonth = viewMonth + 1;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setViewYear(newYear);
    setViewMonth(newMonth);
    onViewChange?.(newYear, newMonth);
  }

  const monthLabel = new Date(Date.UTC(viewYear, viewMonth, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });

  const startOffset = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();

  const cells: (string | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const mm = String(viewMonth + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      return `${viewYear}-${mm}-${dd}`;
    })
  ];

  function handleDayClick(dateKey: string) {
    if (!selecting) {
      onRangeChange({ start: dateKey, end: dateKey });
      setSelecting(true);
    } else {
      const [start, end] =
        dateKey >= range.start ? [range.start, dateKey] : [dateKey, range.start];
      onRangeChange({ start, end });
      setSelecting(false);
    }
  }

  return (
    <div className="dash-calendar">
      <div className="dash-cal-nav">
        <button className="cal-nav-btn" onClick={goToPrevMonth} aria-label="Previous month">
          <ChevronLeft size={16} />
        </button>
        <span className="cal-month-label">{monthLabel}</span>
        <button className="cal-nav-btn" onClick={goToNextMonth} aria-label="Next month">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="dash-cal-grid">
        {DOW_LABELS.map((dow) => (
          <div key={dow} className="cal-dow-label">
            {dow}
          </div>
        ))}
        {cells.map((dateKey, idx) => {
          if (!dateKey) {
            return <div key={`pad-${idx}`} className="cal-pad" />;
          }
          const isToday = dateKey === today;
          const inRange = dateKey >= range.start && dateKey <= range.end;
          const isEndpoint = dateKey === range.start || dateKey === range.end;
          const summary = byDate.get(dateKey);
          const status = summary?.status;
          return (
            <button
              key={dateKey}
              className="cal-day-btn"
              data-today={isToday || undefined}
              data-in-range={inRange || undefined}
              data-endpoint={isEndpoint || undefined}
              data-status={status}
              onClick={() => handleDayClick(dateKey)}
              title={dateKey}
            >
              <span className="cal-day-num">{dateKey.slice(8)}</span>
            </button>
          );
        })}
      </div>
      <div className="cal-range-label">
        {selecting
          ? "Click to set end date"
          : range.start === range.end
            ? range.start
            : `${range.start} → ${range.end}`}
      </div>
    </div>
  );
}
