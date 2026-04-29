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
import { Check, Receipt, X } from "lucide-react";
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
import { getUserTimeZone, todayDateKey } from "@/lib/dates/dateKeys";
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

function formatDollarsInput(cents: number) {
  return (Math.max(0, cents) / 100).toFixed(2);
}

function parseDollarsToCents(value: string) {
  const normalized = value.replace(/[$,\s]/g, "");
  const match = normalized.match(/^(?:(\d+)(?:\.(\d{0,2}))?|\.(\d{1,2}))$/);

  if (!match) return null;

  const dollars = match[1] ?? "0";
  const cents = match[2] ?? match[3] ?? "";
  return Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
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
  const [invoiceReviewOpen, setInvoiceReviewOpen] = useState(false);
  const [invoiceTotalInput, setInvoiceTotalInput] = useState("");

  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

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

  // Determine default range from uninvoiced work on mount
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
        const [taskSnap, oldestEntrySnap] = await Promise.all([
          getDocs(query(collection(db, "tasks"), orderBy("updatedAt", "desc"))),
          getDocs(entriesBaseQuery)
        ]);
        setTasks(sortTasksLatestFirst(taskSnap.docs.map(taskFromDoc)));
        void loadInvoices();
        const oldestEntryDateKey = oldestEntrySnap.docs[0]
          ? timeEntryFromDoc(oldestEntrySnap.docs[0]).dateKey
          : null;
        const start =
          oldestEntryDateKey && oldestEntryDateKey <= today ? oldestEntryDateKey : today;
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
      const cents = entries.reduce(
        (acc, entry) => acc + Math.max(0, entry.amountCentsSnapshot),
        0
      );
      return { seconds, cents };
    },
    [entries]
  );

  const uninvoicedWorkRange = useMemo<DateRange>(() => {
    if (entries.length === 0) {
      return { start: today, end: today };
    }

    const start = entries.reduce(
      (oldest, entry) => (entry.dateKey < oldest ? entry.dateKey : oldest),
      entries[0].dateKey
    );

    return { start, end: today };
  }, [entries, today]);

  const invoiceTaskRows = useMemo(() => {
    const rows = new Map<
      string,
      {
        key: string;
        taskTitle: string;
        durationSeconds: number;
      }
    >();

    for (const entry of entries) {
      const task = tasksById.get(entry.taskId);
      const key = entry.taskId || entry.id;
      const existing = rows.get(key);

      if (existing) {
        existing.durationSeconds += entry.durationSeconds;
      } else {
        rows.set(key, {
          key,
          taskTitle: task?.title ?? "Task",
          durationSeconds: entry.durationSeconds
        });
      }
    }

    return Array.from(rows.values()).sort((a, b) => a.taskTitle.localeCompare(b.taskTitle));
  }, [entries, tasksById]);

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


  function openInvoiceReview() {
    if (!profile || entries.length === 0) return;
    setInvoiceError(null);
    setInvoiceTotalInput(formatDollarsInput(totals.cents));
    setInvoiceReviewOpen(true);
  }

  function closeInvoiceReview() {
    if (invoicing) return;
    setInvoiceReviewOpen(false);
  }

  async function handleCreateInvoice() {
    if (!profile || entries.length === 0) return;
    const totalCents = parseDollarsToCents(invoiceTotalInput);

    if (totalCents === null) {
      setInvoiceError("Enter a valid invoice total.");
      return;
    }

    setInvoicing(true);
    setInvoiceError(null);
    try {
      const token = await getToken();
      const response = await fetch("/api/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          clientName: "Marques LLC",
          dateRange: uninvoicedWorkRange,
          dueDate: null,
          totalCents,
          timeEntryIds: entries.map((e) => e.id)
        })
      });
      if (!response.ok) throw new Error(await response.text());
      const result = (await response.json()) as { id: string };
      router.push(`/invoices/${result.id}`);
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
                {formatDateRange(uninvoicedWorkRange.start, uninvoicedWorkRange.end)}
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
                  onClick={openInvoiceReview}
                >
                  <Receipt size={20} />
                  {invoicing ? "Generating…" : "Invoice Now"}
                </button>
              ) : null}
              {!invoiceReviewOpen && invoiceError ? (
                <div className="error-state">{invoiceError}</div>
              ) : null}
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
                    <select
                      id="detail-task"
                      className="ui-input"
                      value={detailTaskTitle}
                      onChange={(e) => setDetailTaskTitle(e.target.value)}
                    >
                      {tasks
                        .slice()
                        .sort((a, b) => {
                          if (a.status === b.status) return a.title.localeCompare(b.title);
                          return a.status === "active" ? -1 : 1;
                        })
                        .map((t) => (
                          <option key={t.id} value={t.title}>
                            {t.title}{t.status === "archived" ? " (archived)" : ""}
                          </option>
                        ))}
                    </select>
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

        {invoiceReviewOpen ? (
          <div className="entry-detail-overlay" onClick={closeInvoiceReview}>
            <div
              className="entry-detail-popup invoice-review-popup"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="entry-detail-header">
                <span className="entry-detail-title">Review invoice</span>
                <button
                  className="entry-detail-popup-close"
                  onClick={closeInvoiceReview}
                  aria-label="Close"
                  disabled={invoicing}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="invoice-review-lines">
                {invoiceTaskRows.map((row) => (
                  <div key={row.key} className="invoice-review-row">
                    <span className="invoice-review-task">{row.taskTitle}</span>
                    <strong className="mono-number">
                      {secondsToDecimalHours(row.durationSeconds).toFixed(2)} hrs
                    </strong>
                  </div>
                ))}
                <div className="invoice-review-row invoice-review-total-hours">
                  <span>Total time</span>
                  <strong className="mono-number">
                    {secondsToDecimalHours(totals.seconds).toFixed(2)} hrs
                  </strong>
                </div>
              </div>

              <div className="invoice-review-total-edit">
                <label className="fine-print" htmlFor="invoice-total">
                  Invoice total
                </label>
                <div className="invoice-dollar-field">
                  <span className="invoice-dollar-prefix">$</span>
                  <Input
                    id="invoice-total"
                    inputMode="decimal"
                    value={invoiceTotalInput}
                    onChange={(e) => setInvoiceTotalInput(e.target.value)}
                    disabled={invoicing}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {invoiceError ? <div className="error-state">{invoiceError}</div> : null}

              <div className="entry-detail-actions">
                <button
                  className="entry-detail-close"
                  onClick={closeInvoiceReview}
                  disabled={invoicing}
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  className="entry-detail-save"
                  disabled={invoicing}
                  onClick={() => void handleCreateInvoice()}
                >
                  <Check size={14} /> {invoicing ? "Creating…" : "Create invoice"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

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
