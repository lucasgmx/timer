"use client";

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Pencil, Save, X } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faListCheck, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { db } from "@/lib/firebase/client";
import { taskFromDoc } from "@/lib/firebase/clientConverters";
import type { Task } from "@/types";

export default function SettingsPage() {
  const { profile, getToken } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskRate, setTaskRate] = useState("65");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Edit state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    const snap = await getDocs(query(collection(db, "tasks"), orderBy("updatedAt", "desc")));
    setTasks(snap.docs.map(taskFromDoc));
  }, []);

  useEffect(() => {
    if (profile?.role === "admin") {
      void loadTasks();
    }
  }, [profile, loadTasks]);

  function openEdit(task: Task) {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditRate(((task.hourlyRateCentsOverride ?? 0) / 100).toFixed(2));
    setEditError(null);
  }

  async function handleEditSave() {
    if (!editingTask) return;
    setEditBusy(true);
    setEditError(null);
    try {
      const token = await getToken();
      const response = await fetch("/api/tasks/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: editingTask.id,
          title: editTitle,
          hourlyRateCentsOverride: Math.round(Number(editRate) * 100),
          status: editingTask.status
        })
      });
      if (!response.ok) throw new Error(await response.text());
      setEditingTask(null);
      await loadTasks();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Unable to save task.");
    } finally {
      setEditBusy(false);
    }
  }

  async function saveTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(false);

    try {
      const token = await getToken();
      const response = await fetch("/api/tasks/upsert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: taskTitle,
          hourlyRateCentsOverride: Math.round(Number(taskRate) * 100),
          status: "active"
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setTaskTitle("");
      setTaskRate("65");
      setSuccess(true);
      await loadTasks();
    } catch (adminError) {
      setError(adminError instanceof Error ? adminError.message : "Unable to save task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main className="page page-grid">
        <div>
          <div className="eyebrow">settings</div>
          <h1 className="page-title">Tasks</h1>
        </div>

        {profile?.role !== "admin" ? (
          <Card>
            <div className="empty-state">Only admins can manage tasks and rates.</div>
          </Card>
        ) : (
          <>
            {error ? <div className="error-state">{error}</div> : null}
            {success ? <div className="success-state">Task created.</div> : null}

            {tasks.length > 0 ? (
              <Card title="All tasks" icon={<FontAwesomeIcon icon={faListCheck} />}>
                <Table>
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th className="numeric">Rate</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id}>
                        <td>{task.title}</td>
                        <td className="numeric mono-number">${((task.hourlyRateCentsOverride ?? 0) / 100).toFixed(2)}/hr</td>
                        <td>{task.status === "archived" ? <span className="muted">archived</span> : <span>active</span>}</td>
                        <td className="numeric">
                          <button
                            type="button"
                            onClick={() => openEdit(task)}
                            aria-label={`Edit ${task.title}`}
                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--muted)", display: "inline-flex", alignItems: "center" }}
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            ) : null}

            <Card eyebrow="task" title="Create task" icon={<FontAwesomeIcon icon={faPlus} />}>
              <form className="form-grid" onSubmit={saveTask}>
                <div className="field">
                  <label htmlFor="task-title">Title</label>
                  <Input
                    id="task-title"
                    value={taskTitle}
                    onChange={(event) => setTaskTitle(event.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="task-rate">Hourly rate</label>
                  <Input
                    id="task-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={taskRate}
                    onChange={(event) => setTaskRate(event.target.value)}
                  />
                </div>
                <Button variant="primary" icon={<Save />} disabled={busy}>
                  {busy ? "Saving…" : "Save task"}
                </Button>
              </form>
            </Card>
          </>
        )}

        {editingTask ? (
          <div className="entry-detail-overlay" onClick={() => setEditingTask(null)}>
            <div className="entry-detail-popup" onClick={(e) => e.stopPropagation()}>
              <div className="field">
                <label htmlFor="edit-task-title">Task name</label>
                <Input
                  id="edit-task-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="field">
                <label htmlFor="edit-task-rate">Hourly rate</label>
                <Input
                  id="edit-task-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                />
              </div>
              {editError ? <div className="error-state">{editError}</div> : null}
              <div className="entry-detail-actions">
                <button className="entry-detail-close" onClick={() => setEditingTask(null)}>
                  <X size={14} /> Cancel
                </button>
                <button
                  className="entry-detail-save"
                  disabled={editBusy || !editTitle.trim()}
                  onClick={() => void handleEditSave()}
                >
                  {editBusy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
