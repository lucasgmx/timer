"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarPlus, faPenToSquare } from "@fortawesome/free-solid-svg-icons";
import { Save, X } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { getUserTimeZone, todayDateKey } from "@/lib/dates/dateKeys";
import type { Task, TimeEntry } from "@/types";

type TimeEntryFormProps = {
  tasks: Task[];
  editingEntry?: TimeEntry | null;
  onSaved: () => Promise<void> | void;
  onCancelEdit?: () => void;
};

export function TimeEntryForm({
  tasks,
  editingEntry,
  onSaved,
  onCancelEdit
}: TimeEntryFormProps) {
  const { getToken } = useAuth();
  const activeTasks = tasks.filter((task) => task.status === "active");
  const [taskId, setTaskId] = useState(activeTasks[0]?.id ?? "");
  const [timeZone, setTimeZone] = useState("UTC");
  const [dateKey, setDateKey] = useState(() => todayDateKey("UTC"));
  const [hours, setHours] = useState("1:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const localTimeZone = getUserTimeZone();
    setTimeZone(localTimeZone);

    if (!editingEntry) {
      setDateKey(todayDateKey(localTimeZone));
    }
  }, [editingEntry]);

  useEffect(() => {
    if (editingEntry) {
      setTaskId(editingEntry.taskId);
      setDateKey(editingEntry.dateKey);
      
      const totalSeconds = editingEntry.durationSeconds;
      const safe = Math.max(0, Math.floor(totalSeconds));
      const h = Math.floor(safe / 3600);
      const m = Math.floor((safe % 3600) / 60);
      setHours(`${h}:${String(m).padStart(2, "0")}`);
    }
  }, [editingEntry]);

  useEffect(() => {
    if (!taskId && activeTasks[0]) {
      setTaskId(activeTasks[0].id);
    }
  }, [activeTasks, taskId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      let parsedHours = NaN;
      const parts = hours.split(":");
      if (parts.length === 2) {
        parsedHours = parseInt(parts[0] || "0", 10) + parseInt(parts[1] || "0", 10) / 60;
      } else {
        parsedHours = Number(hours);
      }

      if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
        throw new Error("Enter a positive duration.");
      }

      const token = await getToken();
      const response = await fetch("/api/time-entries/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: editingEntry?.id,
          taskId,
          dateKey,
          durationSeconds: Math.round(parsedHours * 3600),
          timeZone
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setHours("1:00");
      await onSaved();
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Unable to save entry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      eyebrow="manual entry"
      title={editingEntry ? "Edit time entry" : "Add completed time"}
      icon={<FontAwesomeIcon icon={editingEntry ? faPenToSquare : faCalendarPlus} />}
      action={
        editingEntry && onCancelEdit ? (
          <Button type="button" variant="ghost" icon={<X />} onClick={onCancelEdit}>
            Cancel
          </Button>
        ) : null
      }
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="manual-task">Task</label>
          <Select
            id="manual-task"
            value={taskId}
            onChange={(event) => setTaskId(event.target.value)}
          >
            {activeTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="cluster">
          <div className="field" style={{ flex: "1 1 180px" }}>
            <label htmlFor="manual-date">Date</label>
            <Input
              id="manual-date"
              type="date"
              value={dateKey}
              onChange={(event) => setDateKey(event.target.value)}
            />
          </div>
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label htmlFor="manual-hours">Hours</label>
            <Input
              id="manual-hours"
              type="text"
              placeholder="0:00"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
            />
          </div>
        </div>
        {error ? <div className="error-state">{error}</div> : null}
        <Button
          type="submit"
          variant="primary"
          icon={<Save />}
          disabled={busy || !taskId}
        >
          {busy ? "Saving..." : editingEntry ? "Save changes" : "Add entry"}
        </Button>
      </form>
    </Card>
  );
}
