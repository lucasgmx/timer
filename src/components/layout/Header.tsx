"use client";

import { LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/components/providers/AuthProvider";
import "./layout.css";

export function Header() {
  const { profile, signOut } = useAuth();
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date());

  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">timer.marques.llc</div>
        <div className="topbar-date">{today}</div>
      </div>
      <div className="cluster">
        {profile ? (
          <>
            <Badge tone={profile.role === "admin" ? "green" : "cyan"}>
              <Shield size={12} />
              {profile.role}
            </Badge>
            <span className="topbar-username">{profile.username}</span>
          </>
        ) : null}
        <Button variant="ghost" icon={<LogOut />} onClick={signOut} title="Sign out">
          Sign out
        </Button>
      </div>
    </header>
  );
}
