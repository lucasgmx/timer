"use client";

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Archive, Pencil, Save, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { formatCents } from "@/lib/billing/formatDuration";
import { db } from "@/lib/firebase/client";
import { projectFromDoc } from "@/lib/firebase/clientConverters";
import type { Project } from "@/types";

export default function SettingsPage() {
  const { profile, getToken } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("Marques LLC");
  const [projectRate, setProjectRate] = useState("150");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const projectSnap = await getDocs(query(collection(db, "projects"), orderBy("name", "asc")));
      setProjects(projectSnap.docs.map(projectFromDoc));
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
      id: editingProjectId ?? undefined,
      name: projectName,
      clientName,
      defaultHourlyRateCents: Math.round(Number(projectRate) * 100),
      status: "active"
    });
    setProjectName("");
    setClientName("Marques LLC");
    setProjectRate("150");
    setEditingProjectId(null);
  }

  function startEditProject(project: Project) {
    setEditingProjectId(project.id);
    setProjectName(project.name);
    setClientName(project.clientName ?? "");
    setProjectRate((project.defaultHourlyRateCents / 100).toFixed(2));
  }

  function cancelEditProject() {
    setEditingProjectId(null);
    setProjectName("");
    setClientName("Marques LLC");
    setProjectRate("150");
  }

  return (
    <AppShell>
      <main className="page page-grid">
        <div>
          <div className="eyebrow">settings</div>
          <h1 className="page-title">Projects</h1>
        </div>

        {profile?.role !== "admin" ? (
          <Card>
            <div className="empty-state">Only admins can manage projects and rates.</div>
          </Card>
        ) : (
          <>
            {loading ? <div className="loading-state">Loading settings...</div> : null}
            {error ? <div className="error-state">{error}</div> : null}
            <Card
              eyebrow="project"
              title={editingProjectId ? "Edit project" : "Create project"}
              action={
                editingProjectId ? (
                  <Button type="button" variant="ghost" icon={<X />} onClick={cancelEditProject}>
                    Cancel
                  </Button>
                ) : null
              }
            >
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
                  {editingProjectId ? "Update project" : "Save project"}
                </Button>
              </form>
            </Card>

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
                          <div className="cluster">
                            <Button
                              variant="ghost"
                              icon={<Pencil />}
                              disabled={busy}
                              onClick={() => startEditProject(project)}
                            >
                              Edit
                            </Button>
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
                          </div>
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
