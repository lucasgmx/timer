"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || !profile) && pathname !== "/") {
      router.replace("/");
    }
  }, [loading, pathname, profile, router, user]);

  if (loading) {
    return (
      <main className="login-screen">
        <div className="loading-state">Opening secure workspace...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="login-screen">
        <div className="error-state">{error}</div>
      </main>
    );
  }

  if (!user || !profile) {
    return null;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-panel">
        <Header />
        {children}
      </div>
    </div>
  );
}
