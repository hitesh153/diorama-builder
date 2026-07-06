"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ConnectStep } from "@/components/wizard/ConnectStep";
import { AgentBehaviorStep, type AgentBehavior } from "@/components/wizard/AgentBehaviorStep";
import { LaunchStep } from "@/components/wizard/LaunchStep";
import type { RoomConfig } from "@diorama/engine";

const BuildStep = dynamic(
  () => import("@/components/wizard/BuildStep").then((m) => ({ default: m.BuildStep })),
  { ssr: false, loading: () => <p style={{ color: "#888" }}>Loading builder...</p> },
);

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ["Connect", "Build Your Office", "Configure Agents", "Launch"];

interface WizardState {
  gatewayUrl: string;
  gatewayToken: string;
  useDemoData: boolean;
  agents: string[];
  theme: string;
  rooms: RoomConfig[];
  agentAssignments: Record<string, string>;
  agentBehaviors: Record<string, AgentBehavior>;
}

export default function WizardPage() {
  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<WizardState>({
    gatewayUrl: "",
    gatewayToken: "",
    useDemoData: false,
    agents: [],
    theme: "neon-dark",
    rooms: [],
    agentAssignments: {},
    agentBehaviors: {},
  });

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Step indicator */}
      <div style={{ display: "flex", gap: 8, padding: "24px 32px", justifyContent: "center" }}>
        {STEP_LABELS.map((label, i) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 600,
                background: i + 1 <= step ? "#8090c0" : "#1a2030",
                color: i + 1 <= step ? "#fff" : "#666",
                border: i + 1 === step ? "2px solid #8090c0" : "2px solid transparent",
              }}
            >
              {i + 1}
            </div>
            <span style={{ fontSize: 13, color: i + 1 <= step ? "#e0e0e0" : "#666" }}>
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <div style={{ width: 32, height: 1, background: "#333" }} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
        {step === 1 && (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 24px" }}>
            <ConnectStep
              onNext={({ url, token, useDemoData: demo }) => {
                setState((s) => ({ ...s, gatewayUrl: url, gatewayToken: token, useDemoData: demo }));
                // Discover agents
                fetch("/api/gateway/discover", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ url, token, useDemoData: demo }),
                })
                  .then((res) => res.json())
                  .then((data) => {
                    const agentNames = (data.agents ?? []).map((a: { id: string }) => a.id);
                    setState((s) => ({ ...s, agents: agentNames }));
                  })
                  .catch(() => {});
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
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 24px" }}>
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
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 24px" }}>
            <LaunchStep
              gatewayUrl={state.gatewayUrl}
              gatewayToken={state.gatewayToken}
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
