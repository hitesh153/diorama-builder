/**
 * Attention detection — "the agent needs you".
 *
 * Session-file connectors can tell when an agent is blocked waiting for the
 * user: the transcript shows a *blocking* record (a tool call awaiting a
 * permission prompt / user answer) and then nothing else is appended. The
 * tool result only lands after the user acts, so "blocking record + no
 * subsequent record for a while" is the signature of a session waiting on
 * a human. Verified against real transcripts: normal tool latency is
 * seconds; permission prompts and AskUserQuestion sit for minutes.
 *
 * Pure state machine, driven by the connectors:
 *  - `noteRecord(state, blocking, now)` on every parsed record — any new
 *    record resolves a previously-announced block, and the record itself
 *    may open a new (candidate) block.
 *  - `detectAttention(state, now)` on every scan tick — announces the
 *    block once it has aged past the threshold.
 */

/**
 * How long a blocking record must sit with no follow-up before we call it
 * "waiting for you". Real transcripts show normal tool latency ≤ ~10s;
 * permission prompts sit for minutes.
 */
export const ATTENTION_THRESHOLD_MS = 20_000;

/** What a blocked session is waiting for (drives the label in the world). */
export interface AttentionCause {
  /** Human label, e.g. "waiting for your approval". */
  label: string;
  /** Machine-ish detail, e.g. "Bash tool call pending". */
  reason: string;
}

export interface AttentionState {
  /** Wall-clock arrival time of the last record seen for this file. */
  lastRecordAt: number;
  /** The candidate blocking cause, or null when the tail is not blocking. */
  pending: AttentionCause | null;
  /** True once attention.requested has been emitted for the current block. */
  announced: boolean;
}

export function createAttentionState(now: number): AttentionState {
  return { lastRecordAt: now, pending: null, announced: false };
}

/**
 * Feed one record arrival into the state. `blocking` is the connector's
 * verdict on THIS record (null = not a blocking signature). Returns
 * "resolved" when this arrival ends a previously-announced block.
 */
export function noteRecord(
  state: AttentionState,
  blocking: AttentionCause | null,
  now: number,
): "resolved" | null {
  const resolved = state.announced ? ("resolved" as const) : null;
  state.lastRecordAt = now;
  state.pending = blocking;
  state.announced = false;
  return resolved;
}

/**
 * Scan-tick check: announce the pending block once it has gone unanswered
 * past the threshold. Returns "pending" exactly once per block.
 */
export function detectAttention(
  state: AttentionState,
  now: number,
  thresholdMs: number = ATTENTION_THRESHOLD_MS,
): "pending" | null {
  if (state.pending && !state.announced && now - state.lastRecordAt >= thresholdMs) {
    state.announced = true;
    return "pending";
  }
  return null;
}
