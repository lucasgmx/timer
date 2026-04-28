"use client";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { db } from "@/lib/firebase/client";
import {
  invoiceFromDoc,
  projectFromDoc,
  taskFromDoc,
  timeEntryFromDoc
} from "@/lib/firebase/clientConverters";
import { formatCents, formatDuration } from "@/lib/billing/formatDuration";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Invoice, Project, Task, TimeEntry } from "@/types";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";

export default function DashboardPage() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const entriesQuery =
        profile.role === "admin"
          ? query(
              collection(db, "timeEntries"),
              orderBy("dateKey", "desc"),
              limit(12)
            )
          : query(
              collection(db, "timeEntries"),
              where("userId", "==", profile.uid),
              orderBy("dateKey", "desc"),
              limit(12)
            );
      const [projectSnap, taskSnap, entrySnap, invoiceSnap] = await Promise.all([
        getDocs(query(collection(db, "projects"), orderBy("name", "asc"))),
        getDocs(query(collection(db, "tasks"), orderBy("title", "asc"))),
        getDocs(entriesQuery),
        getDocs(query(collection(db, "invoices"), orderBy("createdAt", "desc"), limit(6)))
      ]);

      setProjects(projectSnap.docs.map(projectFromDoc));
      setTasks(taskSnap.docs.map(taskFromDoc));
      setEntries(entrySnap.docs.map(timeEntryFromDoc));
      setInvoices(invoiceSnap.docs.map(invoiceFromDoc));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const metrics = useMemo(() => {
    const completedEntries = entries.filter((entry) => entry.status !== "running");
    const totalSeconds = completedEntries.reduce(
      (total, entry) => total + entry.durationSeconds,
      0
    );
    const uninvoicedCents = entries
      .filter((entry) => entry.status === "completed" && !entry.invoiceId)
      .reduce((total, entry) => total + entry.amountCentsSnapshot, 0);
    const openInvoiceCents = invoices
      .filter((invoice) => invoice.status !== "paid" && invoice.status !== "void")
      .reduce((total, invoice) => total + invoice.totalCents, 0);

    return {
      totalSeconds,
      uninvoicedCents,
      openInvoiceCents,
      invoiceCount: invoices.length
    };
  }, [entries, invoices]);

  return (
    <AppShell>
      <main className="page page-grid">
        <div className="split">
          <div>
            <div className="eyebrow">workstation</div>
            <h1 className="page-title">Time command center</h1>
          </div>
        </div>

        <section className="dashboard-metrics">
          <Card title="Tracked">
            <p className="metric-value mono-number">{formatDuration(metrics.totalSeconds)}</p>
          </Card>
          <Card title="Uninvoiced">
            <p className="metric-value mono-number">
              {formatCents(metrics.uninvoicedCents)}
            </p>
          </Card>
          <Card title="Open AR">
            <p className="metric-value mono-number">
              {formatCents(metrics.openInvoiceCents)}
            </p>
          </Card>
          <Card title="Invoices">
            <p className="metric-value mono-number">{metrics.invoiceCount}</p>
          </Card>
        </section>

        {loading ? <div className="loading-state">Loading dashboard...</div> : null}
        {error ? <div className="error-state">{error}</div> : null}

        <div className="page-grid two">
          <Card title="Recent time entries" eyebrow="activity">
            {entries.length === 0 ? (
              <div className="empty-state">No recent entries yet.</div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Work</th>
                    <th>Status</th>
                    <th className="numeric">Duration</th>
                    <th className="numeric">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const project = projects.find((item) => item.id === entry.projectId);
                    const task = tasks.find((item) => item.id === entry.taskId);
                    return (
                      <tr key={entry.id}>
                        <td className="mono-number">{entry.dateKey}</td>
                        <td>
                          {project?.name ?? "Project"}
                          <div className="fine-print">{task?.title ?? "Task"}</div>
                        </td>
                        <td>
                          <InvoiceStatusBadge
                            status={
                              entry.status === "completed"
                                ? entry.invoiceStatusSnapshot === "void"
                                  ? "void"
                                  : "uninvoiced"
                                : entry.invoiceStatusSnapshot ?? entry.status
                            }
                          />
                        </td>
                        <td className="numeric mono-number">
                          {formatDuration(entry.durationSeconds)}
                        </td>
                        <td className="numeric mono-number">
                          {formatCents(entry.amountCentsSnapshot)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
          <Card title="Recent invoices" eyebrow="billing">
            {invoices.length === 0 ? (
              <div className="empty-state">No invoices generated yet.</div>
            ) : (
              <div className="stack">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="split">
                    <div>
                      <strong>{invoice.invoiceNumber}</strong>
                      <div className="fine-print">{invoice.clientName}</div>
                    </div>
                    <div className="cluster">
                      <InvoiceStatusBadge status={invoice.status} />
                      <strong className="mono-number">{formatCents(invoice.totalCents)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>
    </AppShell>
  );
}
