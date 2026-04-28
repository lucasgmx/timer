"use client";

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Archive, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { formatCents } from "@/lib/billing/formatDuration";
import { db } from "@/lib/firebase/client";
import { projectFromDoc, taskFromDoc } from "@/lib/firebase/clientConverters";
import type { Project, Task } from "@/types";

export default function SettingsPage() {
  const { profile, getToken } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("Marques LLC");
  const [projectRate, setProjectRate] = useState("150");
  const [taskProjectId, setTaskProjectId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskRate, setTaskRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [projectSnap, taskSnap] = await Promise.all([
        getDocs(query(collection(db, "projects"), orderBy("name", "asc"))),
        getDocs(query(collection(db, "tasks"), orderBy("title", "asc")))
      ]);
      const nextProjects = projectSnap.docs.map(projectFromDoc);
      setProjects(nextProjects);
      setTasks(taskSnap.docs.map(taskFromDoc));
      setTaskProjectId((current) => current || nextProjects[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function postAdmin(path: string, payload: Record<string, unknown>) {
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

      await loadData();
    } catch (adminError) {
      setError(adminError instanceof Error ? adminError.message : "Unable to save settings.");
    } finally {
      setBusy(false);
    }
  }

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await postAdmin("/api/projects/upsert", {
      name: projectName,
      clientName,
      defaultHourlyRateCents: Math.round(Number(projectRate) * 100),
      status: "active"
    });
    setProjectName("");
  }

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await postAdmin("/api/tasks/upsert", {
      projectId: taskProjectId,
      title: taskTitle,
      description: taskDescription,
      hourlyRateCentsOverride: taskRate ? Math.round(Number(taskRate) * 100) : null,
      status: "active"
    });
    setTaskTitle("");
    setTaskDescription("");
    setTaskRate("");
  }

  return (
    <AppShell>
      <main className="page page-grid">
        <div>
          <div className="eyebrow">settings</div>
          <h1 className="page-title">Projects, tasks, rates</h1>
        </div>

        {profile?.role !== "admin" ? (
          <Card>
            <div className="empty-state">Only admins can manage projects and rates.</div>
          </Card>
        ) : (
          <>
            {loading ? <div className="loading-state">Loading settings...</div> : null}
            {error ? <div className="error-state">{error}</div> : null}
            <div className="page-grid two">
              <Card eyebrow="project" title="Create project">
                <form className="form-grid" onSubmit={createProject}>
                  <div className="field">
                    <label htmlFor="project-name">Name</label>
                    <Input
                      id="project-name"
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="client-name">Client</label>
                    <Input
                      id="client-name"
                      value={clientName}
                      onChange={(event) => setClientName(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="project-rate">Hourly rate</label>
                    <Input
                      id="project-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={projectRate}
                      onChange={(event) => setProjectRate(event.target.value)}
                    />
                  </div>
                  <Button variant="primary" icon={<Save />} disabled={busy}>
                    Save project
                  </Button>
                </form>
              </Card>

              <Card eyebrow="task" title="Create task">
                <form className="form-grid" onSubmit={createTask}>
                  <div className="field">
                    <label htmlFor="task-project">Project</label>
                    <Select
                      id="task-project"
                      value={taskProjectId}
                      onChange={(event) => setTaskProjectId(event.target.value)}
                      required
                    >
                      {projects
                        .filter((project) => project.status === "active")
                        .map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                    </Select>
                  </div>
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
                    <label htmlFor="task-rate">Rate override</label>
                    <Input
                      id="task-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={taskRate}
                      onChange={(event) => setTaskRate(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="task-description">Description</label>
                    <Textarea
                      id="task-description"
                      value={taskDescription}
                      onChange={(event) => setTaskDescription(event.target.value)}
                    />
                  </div>
                  <Button variant="primary" icon={<Save />} disabled={busy || !taskProjectId}>
                    Save task
                  </Button>
                </form>
              </Card>
            </div>

            <Card eyebrow="catalog" title="Projects">
              {projects.length === 0 ? (
                <div className="empty-state">No projects created.</div>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Client</th>
                      <th>Status</th>
                      <th className="numeric">Rate</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project) => (
                      <tr key={project.id}>
                        <td>{project.name}</td>
                        <td>{project.clientName}</td>
                        <td>
                          <span className="cluster">
                            {project.status === "archived" ? <Archive size={14} /> : null}
                            {project.status}
                          </span>
                        </td>
                        <td className="numeric mono-number">
                          {formatCents(project.defaultHourlyRateCents)}
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            icon={<Archive />}
                            disabled={busy}
                            onClick={() =>
                              postAdmin("/api/projects/upsert", {
                                id: project.id,
                                name: project.name,
                                clientName: project.clientName,
                                defaultHourlyRateCents: project.defaultHourlyRateCents,
                                status:
                                  project.status === "active" ? "archived" : "active"
                              })
                            }
                          >
                            {project.status === "active" ? "Archive" : "Restore"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>

            <Card eyebrow="catalog" title="Tasks">
              {tasks.length === 0 ? (
                <div className="empty-state">No tasks created.</div>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Project</th>
                      <th>Status</th>
                      <th className="numeric">Override</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id}>
                        <td>{task.title}</td>
                        <td>
                          {projects.find((project) => project.id === task.projectId)?.name ??
                            "Project"}
                        </td>
                        <td>{task.status}</td>
                        <td className="numeric mono-number">
                          {task.hourlyRateCentsOverride === null ||
                          task.hourlyRateCentsOverride === undefined
                            ? "default"
                            : formatCents(task.hourlyRateCentsOverride)}
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            icon={<Archive />}
                            disabled={busy}
                            onClick={() =>
                              postAdmin("/api/tasks/upsert", {
                                id: task.id,
                                projectId: task.projectId,
                                title: task.title,
                                description: task.description,
                                hourlyRateCentsOverride: task.hourlyRateCentsOverride,
                                status: task.status === "active" ? "archived" : "active"
                              })
                            }
                          >
                            {task.status === "active" ? "Archive" : "Restore"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </>
        )}
      </main>
    </AppShell>
  );
}
