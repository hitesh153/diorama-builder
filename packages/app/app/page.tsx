"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DioramaConfig } from "@diorama/engine";
import { TopBar } from "@/components/TopBar";
import { Welcome } from "@/components/Welcome";
import { useAttentionNotifications, type AttentionEntry } from "@/hooks/useAttentionNotifications";

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

  // Agents currently blocked waiting for the user (reported by the views)
  const [attention, setAttention] = useState<AttentionEntry[]>([]);
  const { promptVisible, enableNotifications, dismissPrompt } = useAttentionNotifications(attention);

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
          <>
            {attention.length > 0 && (
              <span
                title={attention.map((a) => `${a.agent} — ${a.label}`).join("\n")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "color-mix(in oklab, var(--warn) 14%, transparent)",
                  border: "1px solid color-mix(in oklab, var(--warn) 45%, transparent)",
                  color: "var(--warn)",
                  fontSize: 12,
                  fontWeight: 550,
                  cursor: "default",
                }}
              >
                <span aria-hidden>✋</span>
                {attention.length} need{attention.length === 1 ? "s" : ""} you
              </span>
            )}
            <button onClick={() => router.push("/wizard")} className="dio-btn dio-btn-ghost dio-btn-sm">
              Redesign office
            </button>
          </>
        }
      />

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          {view === "dashboard" ? (
            <DashboardView config={config} onAttentionChange={setAttention} />
          ) : (
            <LiveView
              config={config}
              selectedRoom={selectedRoom}
              onSelectRoom={setSelectedRoom}
              onAttentionChange={setAttention}
            />
          )}

          {/* One-time inline offer to enable browser notifications — never
              auto-prompts; appears only while an agent is waiting. */}
          {promptVisible && (
            <div
              className="dio-card dio-fade-in"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 8px 8px 12px",
              }}
            >
              <span style={{ fontSize: 12, color: "var(--ink-2)" }}>
                Get notified when an agent needs you
              </span>
              <button className="dio-btn dio-btn-primary dio-btn-sm" onClick={enableNotifications}>
                Enable
              </button>
              <button className="dio-btn dio-btn-ghost dio-btn-sm" onClick={dismissPrompt} aria-label="Dismiss notifications offer">
                ✕
              </button>
            </div>
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
