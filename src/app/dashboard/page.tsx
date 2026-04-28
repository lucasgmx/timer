"use client";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where
} from "firebase/firestore";
import { Receipt } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardCalendar } from "@/components/calendar/DashboardCalendar";
import type { DateRange } from "@/components/calendar/DateRangePicker";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card } from "@/components/ui/Card";
import { formatCents, formatDuration } from "@/lib/billing/formatDuration";
import { addDays, todayDateKey } from "@/lib/dates/dateKeys";
import { db } from "@/lib/firebase/client";
import {
  invoiceFromDoc,
  projectFromDoc,
  summaryFromDoc,
  taskFromDoc,
  timeEntryFromDoc
} from "@/lib/firebase/clientConverters";
import type { CalendarDaySummary, Project, Task, TimeEntry } from "@/types";

function formatTime(date: Date | null | undefined) {
  if (!date) return "—";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

export default function DashboardPage() {
  const { profile, getToken } = useAuth();
  const today = todayDateKey();
  const [range, setRange] = useState<DateRange>({ start: today, end: today });
  const [rangeReady, setRangeReady] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summaries, setSummaries] = useState<CalendarDaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoicing, setInvoicing] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  // Determine default range from last invoice on mount
  useEffect(() => {
    if (!profile) return;
    void (async () => {
      try {
        const [projectSnap, taskSnap, lastInvoiceSnap] = await Promise.all([
          getDocs(query(collection(db, "projects"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "tasks"), orderBy("title", "asc"))),
          getDocs(query(collection(db, "invoices"), orderBy("createdAt", "desc"), limit(1)))
        ]);
        setProjects(projectSnap.docs.map(projectFromDoc));
        setTasks(taskSnap.docs.map(taskFromDoc));
        const lastInvoice = lastInvoiceSnap.docs[0]
          ? invoiceFromDoc(lastInvoiceSnap.docs[0])
          : null;
        const defaultStart = lastInvoice
          ? addDays(lastInvoice.dateRange.end, 1)
          : addDays(today, -30);
        const start = defaultStart <= today ? defaultStart : today;
        setRange({ start, end: today });
        setRangeReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load dashboard.");
        setRangeReady(true);
      }
    })();
  }, [profile, today]);

  // Load uninvoiced entries for the selected range
  const loadEntries = useCallback(async () => {
    if (!profile || !rangeReady) return;
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
      const snap = await getDocs(entriesQuery);
      setEntries(snap.docs.map(timeEntryFromDoc).filter((e) => !e.invoiceId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load entries.");
    } finally {
      setLoading(false);
    }
  }, [profile, rangeReady, range.start, range.end]);

  // Load calendar summaries for the viewed month
  const loadSummaries = useCallback(async () => {
    if (!profile) return;
    const monthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const monthEnd = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    try {
      const summariesQuery =
        profile.role === "admin"
          ? query(
              collection(db, "calendarDaySummaries"),
              where("scope", "==", "all"),
              where("dateKey", ">=", monthStart),
              where("dateKey", "<=", monthEnd)
            )
          : query(
              collection(db, "calendarDaySummaries"),
              where("scope", "==", "user"),
              where("userId", "==", profile.uid),
              where("dateKey", ">=", monthStart),
              where("dateKey", "<=", monthEnd)
            );
      const snap = await getDocs(summariesQuery);
      setSummaries(snap.docs.map(summaryFromDoc));
    } catch {
      // Summaries are non-critical; silently ignore
    }
  }, [profile, viewYear, viewMonth]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  const totals = useMemo(
    () =>
      entries.reduce(
        (acc, e) => ({ seconds: acc.seconds + e.durationSeconds, cents: acc.cents + e.amountCentsSnapshot }),
        { seconds: 0, cents: 0 }
      ),
    [entries]
  );

  async function handleInvoiceNow() {
    if (!profile || entries.length === 0) return;
    setInvoicing(true);
    setInvoiceError(null);
    try {
      const token = await getToken();
      const response = await fetch("/api/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          clientName: "Marques LLC",
          dateRange: range,
          dueDate: null,
          timeEntryIds: entries.map((e) => e.id)
        })
      });
      if (!response.ok) throw new Error(await response.text());
      await loadEntries();
    } catch (e) {
      setInvoiceError(e instanceof Error ? e.message : "Failed to generate invoice.");
    } finally {
      setInvoicing(false);
    }
  }

  return (
    <AppShell>
      <main className="page page-grid">
        <div>
          <div className="eyebrow">dashboard</div>
          <h1 className="page-title">Time &amp; billing</h1>
        </div>

        {error ? <div className="error-state">{error}</div> : null}

        <div className="page-grid two">
          <Card eyebrow="calendar" title="Select billing range">
            <DashboardCalendar
              range={range}
              onRangeChange={setRange}
              summaries={summaries}
              onViewChange={(y, m) => {
                setViewYear(y);
                setViewMonth(m);
              }}
            />
          </Card>

          <Card eyebrow="billing" title="Uninvoiced work">
            <div className="stack">
              <div className="billing-summary">
                <div className="billing-summary-item">
                  <span className="fine-print">Total time</span>
                  <strong className="mono-number billing-summary-value">
                    {formatDuration(totals.seconds)}
                  </strong>
                </div>
                <div className="billing-summary-item">
                  <span className="fine-print">Total amount</span>
                  <strong className="mono-number billing-summary-value billing-summary-amount">
                    {formatCents(totals.cents)}
                  </strong>
                </div>
              </div>
              {profile?.role === "admin" ? (
                <button
                  className="invoice-now-btn"
                  disabled={invoicing || entries.length === 0}
                  onClick={() => void handleInvoiceNow()}
                >
                  <Receipt size={20} />
                  {invoicing ? "Generating…" : "Invoice Now"}
                </button>
              ) : null}
              {invoiceError ? <div className="error-state">{invoiceError}</div> : null}
              {!loading && entries.length === 0 ? (
                <div className="empty-state">No uninvoiced entries in this range.</div>
              ) : null}
            </div>
          </Card>
        </div>

        <Card eyebrow="entries" title="Time entries">
          {loading ? (
            <div className="loading-state">Loading entries…</div>
          ) : entries.length === 0 ? (
            <div className="empty-state">No uninvoiced entries in this range.</div>
          ) : (
            <div className="entry-list">
              {entries.map((entry) => {
                const project = projects.find((p) => p.id === entry.projectId);
                const task = tasks.find((t) => t.id === entry.taskId);
                return (
                  <div key={entry.id} className="entry-row">
                    <div className="entry-main">
                      <strong className="entry-task">{task?.title ?? "Task"}</strong>
                      <span className="fine-print entry-project">{project?.name ?? "Project"}</span>
                    </div>
                    <div className="entry-times">
                      <span className="mono-number">
                        {formatTime(entry.startTime)}
                        {entry.endTime ? ` – ${formatTime(entry.endTime)}` : ""}
                      </span>
                      <span className="fine-print">{entry.dateKey}</span>
                    </div>
                    <div className="entry-amount">
                      <strong className="mono-number">{formatDuration(entry.durationSeconds)}</strong>
                      <span className="fine-print mono-number">{formatCents(entry.amountCentsSnapshot)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </main>
    </AppShell>
  );
}
