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
import { useAuth } from "@/components/providers/AuthProvider";
import { TimerCard } from "@/components/timer/TimerCard";
import { TimeEntryForm } from "@/components/timer/TimeEntryForm";
import { RunningTimer } from "@/components/timer/RunningTimer";
import { db } from "@/lib/firebase/client";
import {
  projectFromDoc,
  taskFromDoc,
  timeEntryFromDoc
} from "@/lib/firebase/clientConverters";
import type { Project, Task, TimeEntry } from "@/types";

export default function TimePage() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runningEntry, setRunningEntry] = useState<TimeEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const runningQuery = query(
        collection(db, "timeEntries"),
        where("userId", "==", profile.uid),
        where("status", "==", "running"),
        limit(1)
      );
      const [projectSnap, taskSnap, runningSnap] = await Promise.all([
        getDocs(query(collection(db, "projects"), orderBy("name", "asc"))),
        getDocs(query(collection(db, "tasks"), orderBy("title", "asc"))),
        getDocs(runningQuery)
      ]);
      setProjects(projectSnap.docs.map(projectFromDoc));
      setTasks(taskSnap.docs.map(taskFromDoc));
      setRunningEntry(runningSnap.docs[0] ? timeEntryFromDoc(runningSnap.docs[0]) : null);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const runningTask = useMemo(
    () => (runningEntry ? tasks.find((t) => t.id === runningEntry.taskId) : null),
    [runningEntry, tasks]
  );
  const runningProject = useMemo(
    () => (runningEntry ? projects.find((p) => p.id === runningEntry.projectId) : null),
    [runningEntry, projects]
  );

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
                  <span className="fine-print">{runningProject?.name ?? "Project"}</span>
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
      </main>
    </AppShell>
  );
}


