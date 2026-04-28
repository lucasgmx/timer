"use client";

import { useEffect, useState } from "react";
import { Play, Square } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { Task, TimeEntry } from "@/types";
import { RunningTimer } from "./RunningTimer";

type TimerCardProps = {
  tasks: Task[];
  runningEntry: TimeEntry | null;
  onChanged: () => Promise<void> | void;
};

export function TimerCard({ tasks, runningEntry, onChanged }: TimerCardProps) {
  const { getToken } = useAuth();
  const activeTasks = tasks.filter((task) => task.status === "active");
  const [taskInput, setTaskInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticEntry, setOptimisticEntry] = useState<TimeEntry | null>(null);
  const [optimisticTask, setOptimisticTask] = useState<Task | null>(null);
  const [optimisticStopped, setOptimisticStopped] = useState(false);

  useEffect(() => {
    setTaskInput("");
  }, []);

  async function callApi(path: string, payload: Record<string, unknown>) {
    const token = await getToken();
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<Record<string, unknown>>;
  }

  async function handleStart() {
    const trimmed = taskInput.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);

    // Find existing active task (case-insensitive)
    const existingTask = activeTasks.find(
      (t) => t.title.toLowerCase() === trimmed.toLowerCase()
    );

    // Show the running state immediately (optimistic UI)
    const optimisticStart = new Date();
    const optimisticId = `optimistic-${optimisticStart.getTime()}`;
    const taskForDisplay = existingTask ?? {
      id: optimisticId,
      title: trimmed,
      status: "active" as const,
      hourlyRateCentsOverride: null,
      createdAt: optimisticStart,
      updatedAt: optimisticStart
    };
    setOptimisticEntry({
      id: optimisticId,
      userId: "",
      taskId: taskForDisplay.id,
      description: "",
      startTime: optimisticStart,
      endTime: null,
      durationSeconds: 0,
      hourlyRateCentsSnapshot: 0,
      amountCentsSnapshot: 0,
      status: "running",
      invoiceId: null,
      invoiceStatusSnapshot: null,
      dateKey: "",
      createdAt: optimisticStart,
      updatedAt: optimisticStart
    });
    if (!existingTask) {
      setOptimisticTask(taskForDisplay as Task);
    }

    try {
      const payload = existingTask
        ? { taskId: existingTask.id }
        : { taskTitle: trimmed };

      await callApi("/api/time-entries/start", payload);
      setTaskInput("");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Timer action failed.");
    } finally {
      setOptimisticEntry(null);
      setOptimisticTask(null);
      setBusy(false);
    }
  }

  async function handleStop() {
    if (!runningEntry) return;
    setBusy(true);
    setError(null);
    setOptimisticStopped(true);
    try {
      await callApi("/api/time-entries/stop", { timeEntryId: runningEntry.id });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Timer action failed.");
    } finally {
      setBusy(false);
      setOptimisticStopped(false);
    }
  }

  const effectiveRunningEntry = optimisticStopped ? null : (optimisticEntry ?? runningEntry);
  const allTasks = optimisticTask ? [...tasks, optimisticTask] : tasks;
  const runningTask = effectiveRunningEntry
    ? allTasks.find((task) => task.id === effectiveRunningEntry.taskId)
    : null;

  return (
    <Card title={effectiveRunningEntry ? "Timer running" : "Start tracking"} className={effectiveRunningEntry ? "timer-running" : ""}>
      <div className="stack">
        {effectiveRunningEntry ? (
          <>
            <div className="running-task-block">
              <div className="running-task-name">{runningTask?.title ?? "Task"}</div>
            </div>
            <RunningTimer startTime={effectiveRunningEntry.startTime} />
            <Button
              variant="danger"
              icon={<Square />}
              disabled={busy}
              onClick={() => void handleStop()}
            >
              Stop timer
            </Button>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="timer-task">Task</label>
              <datalist id="timer-task-list">
                {activeTasks.map((task) => (
                  <option key={task.id} value={task.title} />
                ))}
              </datalist>
              <Input
                id="timer-task"
                list="timer-task-list"
                value={taskInput}
                onChange={(event) => setTaskInput(event.target.value)}
                placeholder="Type a task name…"
                autoComplete="off"
              />
            </div>
            <Button
              variant="primary"
              icon={<Play />}
              disabled={busy || !taskInput.trim()}
              onClick={() => void handleStart()}
            >
              Start timer
            </Button>
          </>
        )}
        {error ? <div className="error-state">{error}</div> : null}
      </div>
    </Card>
  );
}
