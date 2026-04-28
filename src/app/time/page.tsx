"use client";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where
} from "firebase/firestore";
import { Edit3 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DateRangePicker, type DateRange } from "@/components/calendar/DateRangePicker";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { TimerCard } from "@/components/timer/TimerCard";
import { TimeEntryForm } from "@/components/timer/TimeEntryForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { formatCents, formatDuration } from "@/lib/billing/formatDuration";
import { todayDateKey } from "@/lib/dates/dateKeys";
import { db } from "@/lib/firebase/client";
import {
  projectFromDoc,
  taskFromDoc,
  timeEntryFromDoc
} from "@/lib/firebase/clientConverters";
import type { Project, Task, TimeEntry } from "@/types";

export default function TimePage() {
  const { profile } = useAuth();
  const [range, setRange] = useState<DateRange>(() => {
    const today = todayDateKey();
    return { start: today, end: today };
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [runningEntry, setRunningEntry] = useState<TimeEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
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
              where("dateKey", ">=", range.start),
              where("dateKey", "<=", range.end),
              orderBy("dateKey", "desc"),
              limit(200)
            )
          : query(
              collection(db, "timeEntries"),
              where("userId", "==", profile.uid),
              where("dateKey", ">=", range.start),
              where("dateKey", "<=", range.end),
              orderBy("dateKey", "desc"),
              limit(200)
            );
      const runningQuery = query(
        collection(db, "timeEntries"),
        where("userId", "==", profile.uid),
        where("status", "==", "running"),
        limit(1)
      );

      const [projectSnap, taskSnap, entrySnap, runningSnap] = await Promise.all([
        getDocs(query(collection(db, "projects"), orderBy("name", "asc"))),
        getDocs(query(collection(db, "tasks"), orderBy("title", "asc"))),
        getDocs(entriesQuery),
        getDocs(runningQuery)
      ]);

      setProjects(projectSnap.docs.map(projectFromDoc));
      setTasks(taskSnap.docs.map(taskFromDoc));
      setEntries(entrySnap.docs.map(timeEntryFromDoc));
      setRunningEntry(runningSnap.docs[0] ? timeEntryFromDoc(runningSnap.docs[0]) : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load time.");
    } finally {
      setLoading(false);
    }
  }, [profile, range.end, range.start]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totals = useMemo(() => {
    return entries.reduce(
      (summary, entry) => ({
        seconds: summary.seconds + entry.durationSeconds,
        cents: summary.cents + entry.amountCentsSnapshot
      }),
      { seconds: 0, cents: 0 }
    );
  }, [entries]);

  return (
    <AppShell>
      <main className="page page-grid">
        <div className="split">
          <div>
            <div className="eyebrow">time tracking</div>
            <h1 className="page-title">Track and review work</h1>
          </div>
          <DateRangePicker value={range} onChange={setRange} />
        </div>
        <div className="page-grid two">
          <TimerCard
            projects={projects}
            tasks={tasks}
            runningEntry={runningEntry}
            onChanged={loadData}
          />
          <TimeEntryForm
            projects={projects}
            tasks={tasks}
            editingEntry={editingEntry}
            onSaved={async () => {
              setEditingEntry(null);
              await loadData();
            }}
            onCancelEdit={() => setEditingEntry(null)}
          />
        </div>

        <Card
          eyebrow="report"
          title="Date range entries"
          action={
            <div className="cluster">
              <strong className="mono-number">{formatDuration(totals.seconds)}</strong>
              <strong className="mono-number">{formatCents(totals.cents)}</strong>
            </div>
          }
        >
          {loading ? <div className="loading-state">Loading entries...</div> : null}
          {error ? <div className="error-state">{error}</div> : null}
          {!loading && entries.length === 0 ? (
            <div className="empty-state">No time entries in this range.</div>
          ) : null}
          {entries.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Task</th>
                  <th>User</th>
                  <th>Status</th>
                  <th className="numeric">Rate</th>
                  <th className="numeric">Duration</th>
                  <th className="numeric">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const project = projects.find((item) => item.id === entry.projectId);
                  const task = tasks.find((item) => item.id === entry.taskId);
                  const canEdit =
                    entry.status === "completed" &&
                    !entry.invoiceId &&
                    (entry.userId === profile?.uid || profile?.role === "admin");
                  return (
                    <tr key={entry.id}>
                      <td className="mono-number">{entry.dateKey}</td>
                      <td>
                        <strong>{task?.title ?? "Task"}</strong>
                        <div className="fine-print">{project?.name ?? "Project"}</div>
                        {entry.description ? (
                          <div className="fine-print">{entry.description}</div>
                        ) : null}
                      </td>
                      <td className="fine-print">{entry.userId.slice(0, 8)}</td>
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
                        {formatCents(entry.hourlyRateCentsSnapshot)}
                      </td>
                      <td className="numeric mono-number">
                        {formatDuration(entry.durationSeconds)}
                      </td>
                      <td className="numeric mono-number">
                        {formatCents(entry.amountCentsSnapshot)}
                      </td>
                      <td>
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            icon={<Edit3 />}
                            onClick={() => setEditingEntry(entry)}
                          >
                            Edit
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : null}
        </Card>
      </main>
    </AppShell>
  );
}
