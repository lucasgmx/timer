"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, Square } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select, Textarea } from "@/components/ui/Input";
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
  const [projectId, setProjectId] = useState(activeProjects[0]?.id ?? "");
  const projectTasks = useMemo(
    () =>
      tasks.filter((task) => task.projectId === projectId && task.status === "active"),
    [projectId, tasks]
  );
  const [taskId, setTaskId] = useState(projectTasks[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId && activeProjects[0]) {
      setProjectId(activeProjects[0].id);
    }
  }, [activeProjects, projectId]);

  useEffect(() => {
    if (!projectTasks.some((task) => task.id === taskId)) {
      setTaskId(projectTasks[0]?.id ?? "");
    }
  }, [projectTasks, taskId]);

  async function callTimerApi(path: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setDescription("");
      await onChanged();
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Timer action failed.");
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
    <Card eyebrow="live timer" title={runningEntry ? "Timer running" : "Start tracking"}>
      <div className="stack">
        {runningEntry ? (
          <>
            <div className="cluster">
              <span className="status-dot" aria-hidden="true" />
              <span className="muted">
                {runningProject?.name ?? "Project"} / {runningTask?.title ?? "Task"}
              </span>
            </div>
            <RunningTimer startTime={runningEntry.startTime} />
            {runningEntry.description ? (
              <p className="muted">{runningEntry.description}</p>
            ) : null}
            <Button
              variant="danger"
              icon={<Square />}
              disabled={busy}
              onClick={() =>
                callTimerApi("/api/time-entries/stop", { timeEntryId: runningEntry.id })
              }
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
              <Select
                id="timer-task"
                value={taskId}
                onChange={(event) => setTaskId(event.target.value)}
              >
                {projectTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="field">
              <label htmlFor="timer-description">Description</label>
              <Textarea
                id="timer-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What are you working on?"
              />
            </div>
            <Button
              variant="primary"
              icon={<Play />}
              disabled={busy || !projectId || !taskId}
              onClick={() =>
                callTimerApi("/api/time-entries/start", {
                  projectId,
                  taskId,
                  description
                })
              }
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
