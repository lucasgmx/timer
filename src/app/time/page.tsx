"use client";

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { TimerCard } from "@/components/timer/TimerCard";
import { RunningTimer } from "@/components/timer/RunningTimer";
import { db } from "@/lib/firebase/client";
import {
  taskFromDoc,
  timeEntryFromDoc
} from "@/lib/firebase/clientConverters";
import type { Task, TimeEntry } from "@/types";

export default function TimePage() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runningEntry, setRunningEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const unsubTasks = onSnapshot(
      query(collection(db, "tasks"), orderBy("updatedAt", "desc")),
      (snap) => {
        setTasks(snap.docs.map(taskFromDoc));
      }
    );

    const unsubEntries = onSnapshot(
      query(
        collection(db, "timeEntries"),
        where("userId", "==", profile.uid),
        where("status", "==", "running"),
        limit(1)
      ),
      (snap) => {
        setRunningEntry(snap.docs[0] ? timeEntryFromDoc(snap.docs[0]) : null);
        setLoading(false);
      }
    );

    return () => {
      unsubTasks();
      unsubEntries();
    };
  }, [profile]);

  const runningTask = runningEntry ? tasks.find((t) => t.id === runningEntry.taskId) : null;

  return (
    <AppShell>
      <main className="page page-grid">
        <div>
          <div className="eyebrow">time tracking</div>
          <h1 className="page-title">Track work</h1>
        </div>

        <div className="time-hero">
          {loading ? (
            <div className="loading-state">Loading…</div>
          ) : runningEntry ? (
            <>
              <div className="time-hero-clock">
                <div className="status-pulse">
                  <span className="status-dot" aria-hidden="true" />
                  <span className="muted">Running</span>
                </div>
                <RunningTimer startTime={runningEntry.startTime} />
                <div className="time-hero-meta">
                  <span className="time-hero-task">{runningTask?.title ?? "Task"}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="time-hero-idle">
              <div className="timer-display mono-number time-hero-idle-clock">00:00:00</div>
              <span className="muted">No timer running</span>
            </div>
          )}
        </div>

        <div className="page-grid">
        <TimerCard
            tasks={tasks}
            runningEntry={runningEntry}
            onChanged={() => {}}
          />
        </div>
      </main>
    </AppShell>
  );
}

