"use client";

import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where
} from "firebase/firestore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock, faFileInvoice, faMoneyBillWave } from "@fortawesome/free-solid-svg-icons";
import { Receipt, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange } from "@/components/calendar/DateRangePicker";
import { AppShell } from "@/components/layout/AppShell";
import MatrixRain from "@/components/MatrixRain";
import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { useAuth } from "@/components/providers/AuthProvider";
import { TimerCard } from "@/components/timer/TimerCard";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatCents, formatDuration, secondsToDecimalHours } from "@/lib/billing/formatDuration";
import { addDays, getUserTimeZone, todayDateKey } from "@/lib/dates/dateKeys";
import { db } from "@/lib/firebase/client";
import {
  invoiceFromDoc,
  taskFromDoc
} from "@/lib/firebase/clientConverters";
import type { Invoice, Task, TimeEntry } from "@/types";
import { timeEntryFromDoc } from "@/lib/firebase/clientConverters";

function formatDateRange(start: string, end: string) {
  const s = new Date(`${start}T00:00:00.000Z`);
  const e = new Date(`${end}T00:00:00.000Z`);
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  const sameMonth = sameYear && s.getUTCMonth() === e.getUTCMonth();
  const startFmt = s.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC"
  });
  const endFmt = e.toLocaleDateString("en-US", {
    ...(sameMonth ? {} : { month: "short" }),
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC"
  });
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  const dayLabel = days === 1 ? "1 day" : `${days} days`;
  return `${startFmt} → ${endFmt} (${dayLabel})`;
}

function formatShortDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function sortTasksLatestFirst(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    const updatedDelta = b.updatedAt.getTime() - a.updatedAt.getTime();
    if (updatedDelta !== 0) return updatedDelta;

    const createdDelta = b.createdAt.getTime() - a.createdAt.getTime();
    if (createdDelta !== 0) return createdDelta;

    return a.title.localeCompare(b.title);
  });
}

function sortEntriesLatestFirst(entries: TimeEntry[]) {
  return [...entries].sort((a, b) => {
    const startDelta = b.startTime.getTime() - a.startTime.getTime();
    if (startDelta !== 0) return startDelta;

    const updatedDelta = b.updatedAt.getTime() - a.updatedAt.getTime();
    if (updatedDelta !== 0) return updatedDelta;

    return b.id.localeCompare(a.id);
  });
}

export default function DashboardPage() {
  const { profile, getToken } = useAuth();
  const router = useRouter();
  const [timeZone, setTimeZone] = useState("UTC");
  const [timeZoneReady, setTimeZoneReady] = useState(false);
  const today = useMemo(() => todayDateKey(timeZone), [timeZone]);
  const [range, setRange] = useState<DateRange>({ start: today, end: today });
  const [rangeReady, setRangeReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runningEntry, setRunningEntry] = useState<TimeEntry | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoicing, setInvoicing] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<TimeEntry | null>(null);
  const [detailTaskTitle, setDetailTaskTitle] = useState("");
  const [detailStartDatetime, setDetailStartDatetime] = useState("");
  const [detailEndDatetime, setDetailEndDatetime] = useState("");
  const [detailHours, setDetailHours] = useState("");
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    setTimeZone(getUserTimeZone());
    setTimeZoneReady(true);
  }, []);

  const loadInvoices = useCallback(async () => {
    if (!profile) return;
    setInvoicesLoading(true);
    setInvoicesError(null);
    try {
      const snap = await getDocs(
        query(collection(db, "invoices"), orderBy("createdAt", "desc"), limit(100))
      );
      setInvoices(snap.docs.map(invoiceFromDoc));
    } catch (e) {
      setInvoicesError(e instanceof Error ? e.message : "Unable to load invoices.");
    } finally {
      setInvoicesLoading(false);
    }
  }, [profile]);

  const loadTasks = useCallback(async () => {
    if (!profile) return;
    try {
      const taskSnap = await getDocs(query(collection(db, "tasks"), orderBy("updatedAt", "desc")));
      setTasks(sortTasksLatestFirst(taskSnap.docs.map(taskFromDoc)));
    } catch {
      // tasks will remain stale; not critical
    }
  }, [profile]);

  // Real-time subscription to running entry
  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, "timeEntries"),
      where("userId", "==", profile.uid),
      where("status", "==", "running"),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      setRunningEntry(snap.docs[0] ? timeEntryFromDoc(snap.docs[0]) : null);
    });
    return unsub;
  }, [profile]);

  // Determine default range from last invoice on mount
  useEffect(() => {
    if (!profile || !timeZoneReady) return;
    void (async () => {
      try {
        const entriesBaseQuery =
          profile.role === "admin"
            ? query(
                collection(db, "timeEntries"),
                where("status", "==", "completed"),
                orderBy("dateKey", "asc"),
                limit(1)
              )
            : query(
                collection(db, "timeEntries"),
                where("userId", "==", profile.uid),
                where("status", "==", "completed"),
                orderBy("dateKey", "asc"),
                limit(1)
              );
        const [taskSnap, lastInvoiceSnap, oldestEntrySnap] = await Promise.all([
          getDocs(query(collection(db, "tasks"), orderBy("updatedAt", "desc"))),
          getDocs(query(collection(db, "invoices"), orderBy("createdAt", "desc"), limit(1))),
          getDocs(entriesBaseQuery)
        ]);
        setTasks(sortTasksLatestFirst(taskSnap.docs.map(taskFromDoc)));
        void loadInvoices();
        const lastInvoice = lastInvoiceSnap.docs[0]
          ? invoiceFromDoc(lastInvoiceSnap.docs[0])
          : null;
        const invoiceDerivedStart = lastInvoice
          ? addDays(lastInvoice.dateRange.end, 1)
          : addDays(today, -30);
        const oldestEntryDateKey = oldestEntrySnap.docs[0]
          ? timeEntryFromDoc(oldestEntrySnap.docs[0]).dateKey
          : null;
        const defaultStart =
          oldestEntryDateKey && oldestEntryDateKey > invoiceDerivedStart
            ? oldestEntryDateKey
            : invoiceDerivedStart;
        const start = defaultStart <= today ? defaultStart : today;
        setRange({ start, end: today });
        setRangeReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load dashboard.");
        setRangeReady(true);
      }
    })();
  }, [profile, today, timeZoneReady, loadInvoices]);

  // Load uninvoiced entries for the selected range
  const loadEntries = useCallback(async () => {
    if (!profile || !rangeReady || !timeZoneReady) return;
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
      const uninvoicedEntries = snap.docs.map(timeEntryFromDoc).filter((entry) => !entry.invoiceId);
      setEntries(sortEntriesLatestFirst(uninvoicedEntries));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load entries.");
    } finally {
      setLoading(false);
    }
  }, [profile, rangeReady, timeZoneReady, range.start, range.end]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const totals = useMemo(
    () => {
      const seconds = entries.reduce((acc, e) => acc + e.durationSeconds, 0);
      const hours = secondsToDecimalHours(seconds);
      const rate = profile?.defaultHourlyRateCents ?? 0;
      const cents = Math.round(hours * rate);
      return { seconds, cents };
    },
    [entries, profile]
  );

  function dateToDatetimeLocal(date: Date): string {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${mo}-${d}T${h}:${min}`;
  }

  function openDetail(entry: TimeEntry) {
    setDetailEntry(entry);
    const task = tasks.find((t) => t.id === entry.taskId);
    setDetailTaskTitle(task?.title ?? "");
    setDetailStartDatetime(dateToDatetimeLocal(entry.startTime));
    const entryEnd = entry.endTime ?? new Date(entry.startTime.getTime() + entry.durationSeconds * 1000);
    setDetailEndDatetime(dateToDatetimeLocal(entryEnd));
    setDetailHours(formatShortDuration(entry.durationSeconds));
    setDetailError(null);
  }

  async function handleDetailSave() {
    if (!detailEntry) return;
    const startDt = new Date(detailStartDatetime);
    const endDt = new Date(detailEndDatetime);
    const durationSeconds = Math.round((endDt.getTime() - startDt.getTime()) / 1000);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      setDetailError("End time must be after start time.");
      return;
    }
    if (durationSeconds > 60 * 60 * 24) {
      setDetailError("Duration cannot exceed 24 hours.");
      return;
    }
    const trimmedTitle = detailTaskTitle.trim();
    const matchedTask = tasks.find(
      (t) => t.title.toLowerCase() === trimmedTitle.toLowerCase()
    );
    if (!matchedTask) {
      setDetailError(`No task named "${trimmedTitle}". Create it in Settings first.`);
      return;
    }
    setDetailBusy(true);
    setDetailError(null);
    try {
      const token = await getToken();
      const response = await fetch("/api/time-entries/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: detailEntry.id,
          taskId: matchedTask.id,
          dateKey: detailStartDatetime.substring(0, 10),
          durationSeconds,
          startTime: startDt.toISOString(),
          endTime: endDt.toISOString(),
          timeZone
        })
      });
      if (!response.ok) throw new Error(await response.text());
      setDetailEntry(null);
      await loadEntries();
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Unable to save entry.");
    } finally {
      setDetailBusy(false);
    }
  }


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
      const result = (await response.json()) as { id: string };
      router.push(`/invoices/${result.id}?edit=true`);
    } catch (e) {
      setInvoiceError(e instanceof Error ? e.message : "Failed to generate invoice.");
      setInvoicing(false);
    }
  }

  return (
    <>
    <MatrixRain />
    <AppShell>
      <main className="page page-grid">
        {error ? <div className="error-state">{error}</div> : null}

        <div className="page-grid two">
          <Card title="Uninvoiced work" icon={<FontAwesomeIcon icon={faMoneyBillWave} />}>
            <div className="stack">
              <div className="range-label">
                {formatDateRange(range.start, range.end)}
              </div>
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
            </div>
          </Card>

          <TimerCard
            tasks={tasks}
            runningEntry={runningEntry}
            onChanged={async () => { await Promise.all([loadTasks(), loadEntries()]); }}
          />
        </div>

        <Card title="Time entries" icon={<FontAwesomeIcon icon={faClock} />}>
          {loading ? (
            <div className="loading-state">Loading entries…</div>
          ) : (
            <div className="entry-list">
              {entries.map((entry) => {
                const task = tasks.find((t) => t.id === entry.taskId);
                return (
                  <button key={entry.id} className="entry-row" onClick={() => openDetail(entry)}>
                    <span className="entry-task-btn">
                      {task?.title ?? "Task"}
                    </span>
                    <div className="entry-meta">
                      <strong className="entry-duration mono-number">{formatShortDuration(entry.durationSeconds)}</strong>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {detailEntry ? (() => {
          return (
            <div className="entry-detail-overlay" onClick={() => setDetailEntry(null)}>
              <div className="entry-detail-popup" onClick={(e) => e.stopPropagation()}>
                <div className="entry-detail-header">
                  <span className="entry-detail-title">Edit entry</span>
                  <button className="entry-detail-popup-close" onClick={() => setDetailEntry(null)} aria-label="Close">
                    <X size={16} />
                  </button>
                </div>
                <div className="entry-detail-fields">
                  <div className="field">
                    <label htmlFor="detail-task">Task</label>
                    <Input id="detail-task" value={detailTaskTitle} onChange={(e) => setDetailTaskTitle(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="detail-hours">Hours</label>
                    <Input
                      id="detail-hours"
                      type="text"
                      placeholder="0:00"
                      value={detailHours}
                      onChange={(e) => {
                        setDetailHours(e.target.value);
                        const parts = e.target.value.split(":");
                        let hours = NaN;
                        if (parts.length === 2) {
                          hours = parseInt(parts[0] || "0", 10) + parseInt(parts[1] || "0", 10) / 60;
                        } else {
                          hours = parseFloat(e.target.value);
                        }
                        if (Number.isFinite(hours) && hours > 0) {
                          const start = new Date(detailStartDatetime);
                          const end = new Date(start.getTime() + hours * 3600 * 1000);
                          setDetailEndDatetime(dateToDatetimeLocal(end));
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="entry-detail-divider" />
                <div className="entry-detail-cluster">
                  <div className="field">
                    <label htmlFor="detail-start">Start</label>
                    <Input id="detail-start" type="datetime-local" value={detailStartDatetime} onChange={(e) => setDetailStartDatetime(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="detail-end">End</label>
                    <Input
                      id="detail-end"
                      type="datetime-local"
                      value={detailEndDatetime}
                      onChange={(e) => {
                        setDetailEndDatetime(e.target.value);
                        const start = new Date(detailStartDatetime);
                        const end = new Date(e.target.value);
                        const secs = (end.getTime() - start.getTime()) / 1000;
                        if (secs > 0) setDetailHours(formatShortDuration(secs));
                      }}
                    />
                  </div>
                </div>
                {detailError ? <div className="error-state">{detailError}</div> : null}
                <div className="entry-detail-actions">
                  <button className="entry-detail-close" onClick={() => setDetailEntry(null)}>
                    <X size={14} /> Cancel
                  </button>
                  <button className="entry-detail-save" disabled={detailBusy} onClick={() => void handleDetailSave()}>
                    {detailBusy ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          );
        })() : null}

        {invoicesError ? <div className="error-state">{invoicesError}</div> : null}
        <Card title="Invoice history" icon={<FontAwesomeIcon icon={faFileInvoice} />}>
          {invoicesLoading ? (
            <div className="loading-state">Loading invoices…</div>
          ) : (
            <InvoiceTable invoices={invoices} />
          )}
        </Card>
      </main>
    </AppShell>
    </>
  );
}
