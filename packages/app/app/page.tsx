"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DioramaConfig } from "@diorama/engine";
import { TopBar } from "@/components/TopBar";
import { Welcome } from "@/components/Welcome";

// Dynamic import to avoid SSR issues with Three.js
const LiveView = dynamic(() => import("@/components/LiveView").then((m) => ({ default: m.LiveView })), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <p style={{ color: "var(--ink-2)" }}>Loading 3D scene…</p>
    </div>
  ),
});

const DashboardView = dynamic(
  () => import("@/components/DashboardView").then((m) => ({ default: m.DashboardView })),
  { ssr: false }
);

const BuilderSidebar = dynamic(
  () => import("@/components/builder/BuilderSidebar").then((m) => ({ default: m.BuilderSidebar })),
  { ssr: false }
);

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<DioramaConfig | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.exists) setConfig(data.config);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <TopBar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "var(--ink-2)" }} className="dio-pulse">Loading…</p>
        </div>
      </div>
    );
  }

  // First run — no office yet: explain the product, route into the wizard.
  if (!config) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <TopBar
          actions={
            <button onClick={() => router.push("/wizard")} className="dio-btn dio-btn-sm">
              Open the wizard
            </button>
          }
        />
        <Welcome />
      </div>
    );
  }

  const view = config.view === "dashboard" ? "dashboard" : "3d-office";

  const setView = (nextView: string) => {
    const nextConfig = { ...config, view: nextView };
    setConfig(nextConfig);
    fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextConfig),
    }).catch(() => {});
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopBar
        center={
          <div
            style={{
              display: "flex",
              padding: 2,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 6,
            }}
          >
            {(["3d-office", "dashboard"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: "3px 14px",
                  background: view === v ? "var(--surface-3)" : "transparent",
                  color: view === v ? "var(--ink)" : "var(--ink-2)",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 550,
                  transition: "background var(--t-fast) var(--ease), color var(--t-fast) var(--ease)",
                }}
              >
                {v === "3d-office" ? "Office" : "Dashboard"}
              </button>
            ))}
          </div>
        }
        actions={
          <button onClick={() => router.push("/wizard")} className="dio-btn dio-btn-ghost dio-btn-sm">
            Redesign office
          </button>
        }
      />

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          {view === "dashboard" ? (
            <DashboardView config={config} />
          ) : (
            <LiveView
              config={config}
              selectedRoom={selectedRoom}
              onSelectRoom={setSelectedRoom}
            />
          )}
        </div>
        {view === "3d-office" && (
          <BuilderSidebar
            config={config}
            selectedRoom={selectedRoom}
            onConfigChange={setConfig}
            onSelectRoom={setSelectedRoom}
          />
        )}
      </div>
    </div>
  );
}
