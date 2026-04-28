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
import { DateRangePicker, type DateRange } from "@/components/calendar/DateRangePicker";
import { InvoiceCalendar } from "@/components/calendar/InvoiceCalendar";
import { GenerateInvoiceButton } from "@/components/invoices/GenerateInvoiceButton";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { formatCents, formatDuration } from "@/lib/billing/formatDuration";
import { todayDateKey } from "@/lib/dates/dateKeys";
import { db } from "@/lib/firebase/client";
import {
  invoiceFromDoc,
  projectFromDoc,
  summaryFromDoc,
  taskFromDoc,
  timeEntryFromDoc
} from "@/lib/firebase/clientConverters";
import type { CalendarDaySummary, Invoice, Project, Task, TimeEntry } from "@/types";

export default function InvoicesPage() {
  const { profile } = useAuth();
  const [range, setRange] = useState<DateRange>(() => {
    const today = todayDateKey();
    return { start: today.slice(0, 8) + "01", end: today };
  });
  const [clientName, setClientName] = useState("Marques LLC");
  const [dueDate, setDueDate] = useState("");
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summaries, setSummaries] = useState<CalendarDaySummary[]>([]);
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
              where("status", "==", "completed"),
              where("dateKey", ">=", range.start),
              where("dateKey", "<=", range.end),
              orderBy("dateKey", "desc"),
              limit(200)
            )
          : query(
              collection(db, "timeEntries"),
              where("userId", "==", profile.uid),
              where("status", "==", "completed"),
              where("dateKey", ">=", range.start),
              where("dateKey", "<=", range.end),
              orderBy("dateKey", "desc"),
              limit(200)
            );
      const summariesQuery =
        profile.role === "admin"
          ? query(
              collection(db, "calendarDaySummaries"),
              where("scope", "==", "all"),
              where("dateKey", ">=", range.start),
              where("dateKey", "<=", range.end)
            )
          : query(
              collection(db, "calendarDaySummaries"),
              where("scope", "==", "user"),
              where("userId", "==", profile.uid),
              where("dateKey", ">=", range.start),
              where("dateKey", "<=", range.end)
            );

      const [projectSnap, taskSnap, entrySnap, invoiceSnap, summarySnap] =
        await Promise.all([
          getDocs(query(collection(db, "projects"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "tasks"), orderBy("title", "asc"))),
          getDocs(entriesQuery),
          getDocs(query(collection(db, "invoices"), orderBy("createdAt", "desc"), limit(50))),
          getDocs(summariesQuery)
        ]);

      setProjects(projectSnap.docs.map(projectFromDoc));
      setTasks(taskSnap.docs.map(taskFromDoc));
      const nextEntries = entrySnap.docs
        .map(timeEntryFromDoc)
        .filter((entry) => !entry.invoiceId);
      setEntries(nextEntries);
      setSelectedEntryIds(nextEntries.map((entry) => entry.id));
      setInvoices(invoiceSnap.docs.map(invoiceFromDoc));
      setSummaries(summarySnap.docs.map(summaryFromDoc));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [profile, range.end, range.start]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedTotal = useMemo(
    () =>
      entries
        .filter((entry) => selectedEntryIds.includes(entry.id))
        .reduce(
          (total, entry) => ({
            seconds: total.seconds + entry.durationSeconds,
            cents: total.cents + entry.amountCentsSnapshot
          }),
          { seconds: 0, cents: 0 }
        ),
    [entries, selectedEntryIds]
  );

  function toggleEntry(id: string) {
    setSelectedEntryIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  return (
    <AppShell>
      <main className="page page-grid">
        <div className="split">
          <div>
            <div className="eyebrow">billing</div>
            <h1 className="page-title">Invoices and calendar</h1>
          </div>
          <DateRangePicker value={range} onChange={setRange} />
        </div>

        {loading ? <div className="loading-state">Loading billing workspace...</div> : null}
        {error ? <div className="error-state">{error}</div> : null}

        <div className="page-grid two">
          <Card eyebrow="calendar" title="Range health">
            <InvoiceCalendar range={range} summaries={summaries} />
          </Card>
          <Card
            eyebrow="invoice generator"
            title="Selected billables"
            action={
              <div className="cluster">
                <strong className="mono-number">
                  {formatDuration(selectedTotal.seconds)}
                </strong>
                <strong className="mono-number">{formatCents(selectedTotal.cents)}</strong>
              </div>
            }
          >
            <div className="form-grid">
              <div className="field">
                <label htmlFor="client-name">Client</label>
                <Input
                  id="client-name"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="due-date">Due date</label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
              <GenerateInvoiceButton
                range={range}
                selectedEntryIds={selectedEntryIds}
                clientName={clientName}
                dueDate={dueDate}
                onGenerated={loadData}
              />
            </div>
          </Card>
        </div>

        <Card eyebrow="billable entries" title="Completed uninvoiced time">
          {entries.length === 0 ? (
            <div className="empty-state">No uninvoiced completed entries in this range.</div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th></th>
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
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedEntryIds.includes(entry.id)}
                          onChange={() => toggleEntry(entry.id)}
                          aria-label={`Select ${entry.id}`}
                        />
                      </td>
                      <td className="mono-number">{entry.dateKey}</td>
                      <td>
                        <strong>{project?.name ?? "Project"}</strong>
                        <div className="fine-print">{task?.title ?? "Task"}</div>
                      </td>
                      <td>
                        <InvoiceStatusBadge status="uninvoiced" />
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

        <Card eyebrow="records" title="Invoices">
          <InvoiceTable invoices={invoices} />
        </Card>
      </main>
    </AppShell>
  );
}
