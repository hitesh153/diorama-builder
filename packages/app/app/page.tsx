"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DioramaConfig } from "@diorama/engine";

// Dynamic import to avoid SSR issues with Three.js
const LiveView = dynamic(() => import("@/components/LiveView").then((m) => ({ default: m.LiveView })), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <p>Loading 3D scene...</p>
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
        if (data.exists) {
          setConfig(data.config);
        } else {
          router.replace("/wizard");
        }
        setLoading(false);
      })
      .catch(() => {
        router.replace("/wizard");
        setLoading(false);
      });
  }, [router]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <p>Loading Diorama...</p>
      </div>
    );
  }

  if (!config) return null;

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
    <div style={{ display: "flex", height: "100vh" }}>
      <div style={{ flex: 1, position: "relative" }}>
        {/* View switcher — segmented control (matches ProToolbar's 2D|3D) */}
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 20,
            display: "flex",
            padding: 2,
            background: "color-mix(in oklab, var(--surface) 90%, transparent)",
            backdropFilter: "blur(8px)",
            border: "1px solid var(--border)",
            borderRadius: 6,
          }}
        >
          {(["3d-office", "dashboard"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "3px 12px",
                background: view === v ? "var(--surface-3)" : "transparent",
                color: view === v ? "var(--ink)" : "var(--ink-2)",
                border: "none",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 550,
                transition: "background var(--t-fast) var(--ease), color var(--t-fast) var(--ease)",
              }}
            >
              {v === "3d-office" ? "3D" : "Dashboard"}
            </button>
          ))}
        </div>

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
  );
}
