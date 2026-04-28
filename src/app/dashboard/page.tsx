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
import { Receipt, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange } from "@/components/calendar/DateRangePicker";
import { AppShell } from "@/components/layout/AppShell";
import MatrixRain from "@/components/MatrixRain";
import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { useAuth } from "@/components/providers/AuthProvider";
import { TimerCard } from "@/components/timer/TimerCard";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatCents, formatDuration } from "@/lib/billing/formatDuration";
import { addDays, todayDateKey } from "@/lib/dates/dateKeys";
import { db } from "@/lib/firebase/client";
import {
  invoiceFromDoc,
  taskFromDoc
} from "@/lib/firebase/clientConverters";
import type { Invoice, Task, TimeEntry } from "@/types";
import { timeEntryFromDoc } from "@/lib/firebase/clientConverters";

function formatDateKey(key: string) {
  return new Date(`${key}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function formatDateRange(start: string, end: string) {
  if (start === end) return formatDateKey(start);
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
    year: "numeric",
    timeZone: "UTC"
  });
  return `${startFmt} – ${endFmt}`;
}

function formatTime(date: Date | null | undefined) {
  if (!date) return "—";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).toLowerCase();
}

function formatShortDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const { profile, getToken } = useAuth();
  const router = useRouter();
  const today = todayDateKey();
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
  const [detailTaskId, setDetailTaskId] = useState("");
  const [detailDateKey, setDetailDateKey] = useState("");
  const [detailHours, setDetailHours] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

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
    if (!profile) return;
    void (async () => {
      try {
        const [taskSnap, lastInvoiceSnap] = await Promise.all([
          getDocs(query(collection(db, "tasks"), orderBy("title", "asc"))),
          getDocs(query(collection(db, "invoices"), orderBy("createdAt", "desc"), limit(1)))
        ]);
        setTasks(taskSnap.docs.map(taskFromDoc));
        void loadInvoices();
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
  }, [profile, today, loadInvoices]);

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

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const totals = useMemo(
    () =>
      entries.reduce(
        (acc, e) => ({ seconds: acc.seconds + e.durationSeconds, cents: acc.cents + e.amountCentsSnapshot }),
        { seconds: 0, cents: 0 }
      ),
    [entries]
  );

  function openDetail(entry: TimeEntry) {
    setDetailEntry(entry);
    setDetailTaskId(entry.taskId);
    setDetailDateKey(entry.dateKey);
    setDetailHours((entry.durationSeconds / 3600).toFixed(2));
    setDetailDescription(entry.description ?? "");
    setDetailError(null);
  }

  async function handleDetailSave() {
    if (!detailEntry) return;
    const parsedHours = Number(detailHours);
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      setDetailError("Enter a positive duration.");
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
          taskId: detailTaskId,
          dateKey: detailDateKey,
          durationSeconds: Math.round(parsedHours * 3600),
          description: detailDescription
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
          <Card title="Uninvoiced work">
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
              {!loading && entries.length === 0 ? (
                <div className="empty-state">No uninvoiced entries in this range.</div>
              ) : null}
            </div>
          </Card>

          <TimerCard
            tasks={tasks}
            runningEntry={runningEntry}
            onChanged={loadEntries}
          />
        </div>

        <Card title="Time entries">
          {loading ? (
            <div className="loading-state">Loading entries…</div>
          ) : entries.length === 0 ? (
            <div className="empty-state">No uninvoiced entries in this range.</div>
          ) : (
            <div className="entry-list">
              {entries.map((entry) => {
                const task = tasks.find((t) => t.id === entry.taskId);
                return (
                  <div key={entry.id} className="entry-row">
                    <button
                      className="entry-task-btn"
                      onClick={() => openDetail(entry)}
                    >
                      {task?.title ?? "Task"}
                    </button>
                    <div className="entry-meta">
                      <strong className="entry-duration mono-number">{formatShortDuration(entry.durationSeconds)}</strong>
                    </div>
                    <div className="entry-actions">
                      <button
                        className="entry-edit-btn"
                        title="Edit entry"
                        onClick={() => openDetail(entry)}
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {detailEntry ? (() => {
          const activeTasks = tasks.filter((t) => t.status === "active");
          return (
            <div className="entry-detail-overlay" onClick={() => setDetailEntry(null)}>
              <div className="entry-detail-popup" onClick={(e) => e.stopPropagation()}>
                <div className="entry-detail-times">
                  <div className="entry-detail-time-block">
                    <span className="fine-print">Started</span>
                    <span className="mono-number">{formatTime(detailEntry.startTime)}</span>
                    <span className="entry-detail-date">{detailEntry.startTime ? detailEntry.startTime.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</span>
                  </div>
                  <div className="entry-detail-time-block">
                    <span className="fine-print">Ended</span>
                    <span className="mono-number">{formatTime(detailEntry.endTime)}</span>
                    <span className="entry-detail-date">{detailEntry.endTime ? detailEntry.endTime.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</span>
                  </div>
                </div>
                <div className="entry-detail-divider" />
                <div className="field">
                  <label htmlFor="detail-task">Task</label>
                  <Select id="detail-task" value={detailTaskId} onChange={(e) => setDetailTaskId(e.target.value)}>
                    {activeTasks.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </Select>
                </div>
                <div className="entry-detail-cluster">
                  <div className="field">
                    <label htmlFor="detail-date">Date</label>
                    <Input id="detail-date" type="date" value={detailDateKey} onChange={(e) => setDetailDateKey(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="detail-hours">Hours</label>
                    <Input id="detail-hours" type="number" min="0.01" step="0.01" value={detailHours} onChange={(e) => setDetailHours(e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="detail-desc">Description</label>
                  <Textarea id="detail-desc" value={detailDescription} onChange={(e) => setDetailDescription(e.target.value)} />
                </div>
                {detailError ? <div className="error-state">{detailError}</div> : null}
                <div className="entry-detail-actions">
                  <button className="entry-detail-close" onClick={() => setDetailEntry(null)}>Cancel</button>
                  <button className="entry-detail-save" disabled={detailBusy} onClick={() => void handleDetailSave()}>
                    {detailBusy ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          );
        })() : null}

        {invoicesError ? <div className="error-state">{invoicesError}</div> : null}
        <Card title="Invoice history">
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
