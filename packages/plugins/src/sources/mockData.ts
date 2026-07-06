import type { SourcePlugin, DioramaEvent } from "@diorama/engine";

const PIPELINE_SEQUENCE: Array<{ type: string; room: string; agent: string; payload: Record<string, unknown> }> = [
  { type: "aegis.intake.review.started", room: "reception", agent: "aegis-prime", payload: { ticketId: "T-MOCK-1", ticketTitle: "Mock ticket" } },
  { type: "aegis.intake.ticket.approved", room: "reception", agent: "aegis-prime", payload: { ticketId: "T-MOCK-1" } },
  { type: "aegis.council.session.started", room: "council-chamber", agent: "aegis-prime", payload: { ticketId: "T-MOCK-1", sessionId: "S-MOCK-1" } },
  { type: "aegis.advisor.spawned", room: "council-chamber", agent: "contrarian", payload: { advisorId: "contrarian" } },
  { type: "aegis.advisor.spawned", room: "council-chamber", agent: "first-principles", payload: { advisorId: "first-principles" } },
  { type: "aegis.advisor.spawned", room: "council-chamber", agent: "expansionist", payload: { advisorId: "expansionist" } },
  { type: "aegis.advisor.output.ready", room: "council-chamber", agent: "contrarian", payload: { advisorId: "contrarian" } },
  { type: "aegis.advisor.output.ready", room: "council-chamber", agent: "first-principles", payload: { advisorId: "first-principles" } },
  { type: "aegis.advisor.output.ready", room: "council-chamber", agent: "expansionist", payload: { advisorId: "expansionist" } },
  { type: "aegis.executor.synthesis.started", room: "council-chamber", agent: "executor", payload: {} },
  { type: "aegis.scenario.document.generated", room: "council-chamber", agent: "executor", payload: {} },
  { type: "aegis.sentinel.execution.started", room: "test-lab", agent: "sentinel", payload: {} },
  { type: "aegis.sentinel.test.passed", room: "test-lab", agent: "sentinel", payload: { testType: "unit" } },
  { type: "aegis.sentinel.test.passed", room: "test-lab", agent: "sentinel", payload: { testType: "unit" } },
  { type: "aegis.sentinel.test.passed", room: "test-lab", agent: "sentinel", payload: { testType: "integration" } },
  { type: "aegis.sentinel.test.passed", room: "test-lab", agent: "sentinel", payload: { testType: "e2e" } },
  { type: "aegis.sentinel.execution.complete", room: "test-lab", agent: "sentinel", payload: {} },
  { type: "aegis.verdict.issued", room: "comms-hub", agent: "aegis-prime", payload: { ticketId: "T-MOCK-1", verdict: "APPROVED", scenarioCount: 3, coverageDelta: 5.2 } },
  { type: "aegis.herald.message.sent", room: "comms-hub", agent: "herald", payload: { channel: "slack" } },
  { type: "aegis.scribe.pattern.promoted", room: "archive", agent: "scribe", payload: { patternName: "retry-logic", repoId: "main-repo" } },
];

/**
 * Generate a demo event stream. When `roomLabels` is provided (the user's
 * actual built rooms), the mock pipeline's room names are remapped onto them
 * so demo events light up rooms that really exist in the world.
 */
export function createMockEventStream(count: number, roomLabels?: string[]): DioramaEvent[] {
  const events: DioramaEvent[] = [];
  let timestamp = Date.now();

  // Stable mapping: each distinct mock room → a real room, round-robin in
  // order of first appearance.
  let roomFor: (mockRoom: string) => string = (r) => r;
  if (roomLabels && roomLabels.length > 0) {
    const mapping = new Map<string, string>();
    let next = 0;
    roomFor = (mockRoom: string) => {
      if (!mapping.has(mockRoom)) {
        mapping.set(mockRoom, roomLabels[next % roomLabels.length]);
        next++;
      }
      return mapping.get(mockRoom)!;
    };
  }

  for (let i = 0; i < count && i < PIPELINE_SEQUENCE.length; i++) {
    const template = PIPELINE_SEQUENCE[i];
    events.push({
      type: template.type,
      room: roomFor(template.room),
      agent: template.agent,
      payload: template.payload,
      timestamp,
    });
    timestamp += 500 + Math.floor(Math.random() * 1000);
  }

  return events;
}

export const mockDataPlugin: SourcePlugin = {
  kind: "source",
  type: "mock-data",
  connect: async () => {},
  disconnect: async () => {},
};
