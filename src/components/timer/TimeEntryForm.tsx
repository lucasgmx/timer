"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, X } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { todayDateKey } from "@/lib/dates/dateKeys";
import type { Project, Task, TimeEntry } from "@/types";

type TimeEntryFormProps = {
  projects: Project[];
  tasks: Task[];
  editingEntry?: TimeEntry | null;
  onSaved: () => Promise<void> | void;
  onCancelEdit?: () => void;
};

export function TimeEntryForm({
  projects,
  tasks,
  editingEntry,
  onSaved,
  onCancelEdit
}: TimeEntryFormProps) {
  const { getToken } = useAuth();
  const activeProjects = projects.filter((project) => project.status === "active");
  const [projectId, setProjectId] = useState(activeProjects[0]?.id ?? "");
  const projectTasks = useMemo(
    () =>
      tasks.filter((task) => task.projectId === projectId && task.status === "active"),
    [projectId, tasks]
  );
  const [taskId, setTaskId] = useState(projectTasks[0]?.id ?? "");
  const [dateKey, setDateKey] = useState(todayDateKey());
  const [hours, setHours] = useState("1.00");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingEntry) {
      setProjectId(editingEntry.projectId);
      setTaskId(editingEntry.taskId);
      setDateKey(editingEntry.dateKey);
      setHours((editingEntry.durationSeconds / 3600).toFixed(2));
      setDescription(editingEntry.description ?? "");
    }
  }, [editingEntry]);

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const parsedHours = Number(hours);

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
          projectId,
          taskId,
          dateKey,
          durationSeconds: Math.round(parsedHours * 3600),
          description
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setHours("1.00");
      setDescription("");
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
          <label htmlFor="manual-project">Project</label>
          <Select
            id="manual-project"
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
          <label htmlFor="manual-task">Task</label>
          <Select
            id="manual-task"
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
              type="number"
              min="0.01"
              step="0.01"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="manual-description">Description</label>
          <Textarea
            id="manual-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        {error ? <div className="error-state">{error}</div> : null}
        <Button
          type="submit"
          variant="primary"
          icon={<Save />}
          disabled={busy || !projectId || !taskId}
        >
          {busy ? "Saving..." : editingEntry ? "Save changes" : "Add entry"}
        </Button>
      </form>
    </Card>
  );
}
