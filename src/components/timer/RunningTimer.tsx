"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/billing/formatDuration";

export function RunningTimer({ startTime }: { startTime?: Date | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startTime) {
      return;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startTime]);

  const elapsedSeconds = startTime
    ? Math.max(0, Math.floor((now - startTime.getTime()) / 1000))
    : 0;

  return <div className="timer-display mono-number">{formatDuration(elapsedSeconds)}</div>;
}
