"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AccountModal } from "./AccountModal";
import { useAuth } from "@/components/providers/AuthProvider";
import "./layout.css";

const CLOCKS = [
  { label: "Fayetteville, AR", tz: "America/Chicago" },
  { label: "São Paulo, BR", tz: "America/Sao_Paulo" },
] as const;

function useTick() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function Header() {
  const { profile, signOut } = useAuth();
  const now = useTick();
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-brand-block">
        <Link href="/dashboard" className="topbar-brand">
          <Image src="/logo_white.png" alt="Timer" width={200} height={29} priority />
        </Link>
        {profile ? (
          <button
            className="topbar-username"
            onClick={() => setAccountOpen(true)}
            aria-label="Open account settings"
          >
            {profile.username}
          </button>
        ) : null}
      </div>
      <div className="topbar-clocks">
        {CLOCKS.map(({ label, tz }) => (
          <div key={tz} className="topbar-clock">
            <span className="topbar-clock-label">{label}</span>
            <div className="topbar-clock-display">
              <span className="topbar-clock-ghost" aria-hidden="true">88:88</span>
              <span className="topbar-clock-time">
                {new Intl.DateTimeFormat("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                  timeZone: tz,
                }).format(now)}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="cluster">
        <Button variant="ghost" icon={<LogOut />} onClick={signOut} title="Sign out">
          Sign out
        </Button>
      </div>
      {accountOpen ? <AccountModal onClose={() => setAccountOpen(false)} /> : null}
    </header>
  );
}
