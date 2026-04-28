"use client";

import { Input } from "@/components/ui/Input";

export type DateRange = {
  start: string;
  end: string;
};

export function DateRangePicker({
  value,
  onChange
}: {
  value: DateRange;
  onChange: (value: DateRange) => void;
}) {
  return (
    <div className="cluster">
      <div className="field">
        <label htmlFor="range-start">Start</label>
        <Input
          id="range-start"
          type="date"
          value={value.start}
          onChange={(event) => onChange({ ...value, start: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="range-end">End</label>
        <Input
          id="range-end"
          type="date"
          value={value.end}
          onChange={(event) => onChange({ ...value, end: event.target.value })}
        />
      </div>
    </div>
  );
}
