"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, Square } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import type { Project, Task, TimeEntry } from "@/types";
import { RunningTimer } from "./RunningTimer";

type TimerCardProps = {
  projects: Project[];
  tasks: Task[];
  runningEntry: TimeEntry | null;
  onChanged: () => Promise<void> | void;
};

export function TimerCard({ projects, tasks, runningEntry, onChanged }: TimerCardProps) {
  const { getToken } = useAuth();
  const activeProjects = projects.filter((project) => project.status === "active");
  const flycoProject = activeProjects.find((p) => p.name === "Flyco");
  const [projectId, setProjectId] = useState(flycoProject?.id ?? activeProjects[0]?.id ?? "");
  const projectTasks = useMemo(
    () =>
      tasks.filter((task) => task.projectId === projectId && task.status === "active"),
    [projectId, tasks]
  );
  const [taskInput, setTaskInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeProjects.length === 0) return;
    const preferred = activeProjects.find((p) => p.name === "Flyco") ?? activeProjects[0];
    setProjectId((current) => {
      if (!current || !activeProjects.some((p) => p.id === current)) {
        return preferred.id;
      }
      return current;
    });
  }, [activeProjects.map((p) => p.id).join(",")]);

  useEffect(() => {
    setTaskInput("");
  }, [projectId]);

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
    if (!trimmed || !projectId) return;
    setBusy(true);
    setError(null);
    try {
      // Find existing active task (case-insensitive)
      let resolvedTaskId = projectTasks.find(
        (t) => t.title.toLowerCase() === trimmed.toLowerCase()
      )?.id;

      // Create the task if it doesn't exist yet
      if (!resolvedTaskId) {
        const created = await callApi("/api/tasks/upsert", {
          projectId,
          title: trimmed,
          status: "active"
        });
        resolvedTaskId = created.id as string;
      }

      await callApi("/api/time-entries/start", { projectId, taskId: resolvedTaskId });
      setTaskInput("");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Timer action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    if (!runningEntry) return;
    setBusy(true);
    setError(null);
    try {
      await callApi("/api/time-entries/stop", { timeEntryId: runningEntry.id });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Timer action failed.");
    } finally {
      setBusy(false);
    }
  }

  const runningTask = runningEntry
    ? tasks.find((task) => task.id === runningEntry.taskId)
    : null;
  const runningProject = runningEntry
    ? projects.find((project) => project.id === runningEntry.projectId)
    : null;

  return (
    <Card eyebrow="live timer" title={runningEntry ? "Timer running" : "Start tracking"} className={runningEntry ? "timer-running" : ""}>
      <div className="stack">
        {runningEntry ? (
          <>
            <div className="running-task-block">
              <div className="running-task-project-row">
                <span className="status-dot" aria-hidden="true" />
                <span className="running-task-project">{runningProject?.name ?? "Project"}</span>
              </div>
              <div className="running-task-name">{runningTask?.title ?? "Task"}</div>
            </div>
            <RunningTimer startTime={runningEntry.startTime} />
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
              <label htmlFor="timer-project">Project</label>
              <Select
                id="timer-project"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                {activeProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="field">
              <label htmlFor="timer-task">Task</label>
              <datalist id="timer-task-list">
                {projectTasks.map((task) => (
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
              disabled={busy || !projectId || !taskInput.trim()}
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
