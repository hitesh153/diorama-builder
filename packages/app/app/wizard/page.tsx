"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ConnectStep } from "@/components/wizard/ConnectStep";
import { AgentBehaviorStep, type AgentBehavior } from "@/components/wizard/AgentBehaviorStep";
import { LaunchStep } from "@/components/wizard/LaunchStep";
import type { RoomConfig, SourceConfig } from "@diorama/engine";
import { TopBar } from "@/components/TopBar";

const BuildStep = dynamic(
  () => import("@/components/wizard/BuildStep").then((m) => ({ default: m.BuildStep })),
  {
    ssr: false,
    loading: () => (
      <p style={{ color: "var(--ink-2)", textAlign: "center", paddingTop: 80 }}>Loading builder…</p>
    ),
  },
);

type Step = 1 | 2 | 3 | 4;

const STEPS: Array<{ n: Step; label: string }> = [
  { n: 1, label: "Connect" },
  { n: 2, label: "Build" },
  { n: 3, label: "Agents" },
  { n: 4, label: "Launch" },
];

interface WizardState {
  gatewayUrl: string;
  gatewayToken: string;
  useDemoData: boolean;
  sources: SourceConfig[];
  agents: string[];
  theme: string;
  rooms: RoomConfig[];
  agentAssignments: Record<string, string>;
  agentBehaviors: Record<string, AgentBehavior>;
}

function Stepper({ current }: { current: Step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {STEPS.map((step, i) => {
        const state = step.n < current ? "done" : step.n === current ? "current" : "todo";
        return (
          <div key={step.n} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 6px" }}>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 650,
                  fontVariantNumeric: "tabular-nums",
                  background:
                    state === "current"
                      ? "var(--accent)"
                      : state === "done"
                        ? "var(--accent-soft)"
                        : "transparent",
                  border: state === "todo" ? "1px solid var(--border)" : "1px solid transparent",
                  color:
                    state === "current"
                      ? "var(--accent-ink)"
                      : state === "done"
                        ? "var(--accent)"
                        : "var(--ink-3)",
                  transition: "background var(--t-med) var(--ease), color var(--t-med) var(--ease)",
                }}
              >
                {state === "done" ? "✓" : step.n}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 550,
                  color: state === "current" ? "var(--ink)" : state === "done" ? "var(--ink-2)" : "var(--ink-3)",
                }}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                style={{
                  width: 20,
                  height: 1,
                  background: step.n < current ? "var(--accent)" : "var(--border)",
                  transition: "background var(--t-med) var(--ease)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function WizardPage() {
  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<WizardState>({
    gatewayUrl: "",
    gatewayToken: "",
    useDemoData: false,
    sources: [],
    agents: [],
    theme: "neon-dark",
    rooms: [],
    agentAssignments: {},
    agentBehaviors: {},
  });

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <TopBar
        center={<Stepper current={step} />}
        actions={
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
            {step === 2 ? "Saved to your config on launch" : ""}
          </span>
        }
      />

      {/* Step content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
        {step === 1 && (
          <div className="dio-fade-in" style={{ overflowY: "auto", padding: "56px 24px" }}>
            <ConnectStep
              onNext={({ url, token, useDemoData: demo, sources }) => {
                setState((s) => ({ ...s, gatewayUrl: url, gatewayToken: token, useDemoData: demo, sources }));
                const localTypes = sources
                  .filter((s) => s.type === "codex" || s.type === "claude-code")
                  .map((s) => s.type);
                const rosterCalls: Promise<string[]>[] = [];
                if (localTypes.length > 0) {
                  rosterCalls.push(
                    fetch(`/api/sources/roster?types=${localTypes.join(",")}`)
                      .then((r) => r.json())
                      .then((d: { agents?: string[] }) => d.agents ?? [])
                      .catch(() => []),
                  );
                }
                if (demo || url) {
                  rosterCalls.push(
                    fetch("/api/gateway/discover", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ url, token, useDemoData: demo }),
                    })
                      .then((res) => res.json())
                      .then((data) => (data.agents ?? []).map((a: { id: string }) => a.id))
                      .catch(() => []),
                  );
                }
                Promise.all(rosterCalls).then((lists) => {
                  const merged = [...new Set(lists.flat())];
                  setState((s) => ({ ...s, agents: merged }));
                });
                setStep(2);
              }}
            />
          </div>
        )}

        {step === 2 && (
          <BuildStep
            agents={state.agents}
            theme={state.theme}
            onThemeChange={(t) => setState((s) => ({ ...s, theme: t }))}
            onComplete={(rooms, agentAssignments) => {
              setState((s) => ({ ...s, rooms, agentAssignments }));
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <div className="dio-fade-in" style={{ overflowY: "auto", padding: "56px 24px" }}>
            <AgentBehaviorStep
              agents={state.agents}
              rooms={state.rooms}
              theme={state.theme}
              initialBehaviors={state.agentBehaviors}
              onComplete={(agentBehaviors) => {
                setState((s) => ({ ...s, agentBehaviors }));
                setStep(4);
              }}
              onBack={() => setStep(2)}
            />
          </div>
        )}

        {step === 4 && (
          <div className="dio-fade-in" style={{ overflowY: "auto", padding: "56px 24px" }}>
            <LaunchStep
              gatewayUrl={state.gatewayUrl}
              gatewayToken={state.gatewayToken}
              sources={state.sources}
              theme={state.theme}
              rooms={state.rooms}
              agentAssignments={state.agentAssignments}
              agentBehaviors={state.agentBehaviors}
              onBack={() => setStep(3)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
