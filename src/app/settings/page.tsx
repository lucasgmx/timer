"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export default function SettingsPage() {
  const { profile, getToken } = useAuth();
  const [taskTitle, setTaskTitle] = useState("");
  const [taskRate, setTaskRate] = useState("65");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
            <Card eyebrow="task" title="Create task">
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
      </main>
    </AppShell>
  );
}
