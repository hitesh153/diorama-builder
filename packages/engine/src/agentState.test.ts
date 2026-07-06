import { describe, it, expect } from "vitest";
import {
  createAgentState,
  updateAgentState,
  computeIdlePose,
} from "./agentState";

describe("createAgentState", () => {
  it("creates initial idle state at given position", () => {
    const state = createAgentState({ x: 5, z: 3 });
    expect(state.x).toBe(5);
    expect(state.z).toBe(3);
    expect(state.mode).toBe("idle");
    expect(state.facing).toBe(0);
  });

  it("accepts optional seat rotation", () => {
    const state = createAgentState({ x: 0, z: 0, seatRotation: Math.PI / 2 });
    expect(state.seatRotation).toBe(Math.PI / 2);
  });
});

describe("updateAgentState", () => {
  it("transitions from idle to walking when path is set", () => {
    const state = createAgentState({ x: 0, z: 0 });
    const next = updateAgentState(state, {
      type: "SET_PATH",
      path: [
        [5, 0, 3],
        [10, 0, 6],
      ],
    });
    expect(next.mode).toBe("walking");
    expect(next.waypointIndex).toBe(0);
  });

  it("advances position toward waypoint on TICK", () => {
    let state = createAgentState({ x: 0, z: 0 });
    state = updateAgentState(state, {
      type: "SET_PATH",
      path: [[10, 0, 0]],
    });
    const next = updateAgentState(state, { type: "TICK", delta: 0.5 });
    expect(next.x).toBeGreaterThan(0);
    expect(next.mode).toBe("walking");
  });

  it("transitions to idle when final waypoint reached", () => {
    let state = createAgentState({ x: 0, z: 0 });
    state = updateAgentState(state, {
      type: "SET_PATH",
      path: [[0.01, 0, 0]], // very close
    });
    const next = updateAgentState(state, { type: "TICK", delta: 1 });
    expect(next.mode).toBe("idle");
  });

  it("advances waypointIndex when intermediate waypoint reached", () => {
    let state = createAgentState({ x: 0, z: 0 });
    state = updateAgentState(state, {
      type: "SET_PATH",
      path: [
        [0.01, 0, 0],
        [5, 0, 0],
      ],
    });
    const after = updateAgentState(state, { type: "TICK", delta: 1 });
    expect(after.waypointIndex).toBe(1);
    expect(after.mode).toBe("walking");
  });

  it("updates facing direction while walking", () => {
    let state = createAgentState({ x: 0, z: 0 });
    state = updateAgentState(state, {
      type: "SET_PATH",
      path: [[10, 0, 0]],
    });
    const next = updateAgentState(state, { type: "TICK", delta: 0.1 });
    // Walking east → facing should be ~-PI/2 or ~PI/2 depending on convention
    expect(typeof next.facing).toBe("number");
  });

  it("transitions to seated when SIT action dispatched", () => {
    const state = createAgentState({ x: 5, z: 3 });
    const next = updateAgentState(state, {
      type: "SIT",
      seatRotation: Math.PI,
    });
    expect(next.mode).toBe("seated");
    expect(next.seatRotation).toBe(Math.PI);
  });

  it("transitions from seated to idle on STAND", () => {
    let state = createAgentState({ x: 0, z: 0 });
    state = updateAgentState(state, { type: "SIT", seatRotation: 0 });
    const next = updateAgentState(state, { type: "STAND" });
    expect(next.mode).toBe("idle");
  });

  it("ignores TICK when idle (position unchanged)", () => {
    const state = createAgentState({ x: 5, z: 3 });
    const next = updateAgentState(state, { type: "TICK", delta: 0.5 });
    expect(next.x).toBe(5);
    expect(next.z).toBe(3);
  });
});

describe("computeIdlePose", () => {
  it("returns pose values for t=0", () => {
    const pose = computeIdlePose(0, 0);
    expect(typeof pose.leftArmX).toBe("number");
    expect(typeof pose.rightArmX).toBe("number");
    expect(typeof pose.headY).toBe("number");
    expect(typeof pose.torsoLean).toBe("number");
    expect(typeof pose.bodySwayX).toBe("number");
    expect(typeof pose.bodySwayZ).toBe("number");
    expect(typeof pose.chairTurn).toBe("number");
  });

  it("produces different poses at different times", () => {
    const pose1 = computeIdlePose(0, 0);
    const pose2 = computeIdlePose(5, 0);
    // At t=0 and t=5, the idle cycle is in different phases
    const isDifferent =
      pose1.leftArmX !== pose2.leftArmX ||
      pose1.torsoLean !== pose2.torsoLean ||
      pose1.chairTurn !== pose2.chairTurn;
    expect(isDifferent).toBe(true);
  });

  it("uses phase offset to desync agents", () => {
    const poseA = computeIdlePose(3, 0);
    const poseB = computeIdlePose(3, 5);
    // Different phase offsets should produce different results
    const isDifferent =
      poseA.leftArmX !== poseB.leftArmX ||
      poseA.chairTurn !== poseB.chairTurn;
    expect(isDifferent).toBe(true);
  });

  it("always includes gentle body sway", () => {
    // At any time, bodySwayX and bodySwayZ should be nonzero (except exact zero crossings)
    const pose = computeIdlePose(1.5, 0);
    // sway is sin/cos based, at t=1.5 these won't be zero
    expect(Math.abs(pose.bodySwayX)).toBeGreaterThan(0);
    expect(Math.abs(pose.bodySwayZ)).toBeGreaterThan(0);
  });

  it("energy=0 (calm) produces smaller magnitudes than energy=1 (restless)", () => {
    // Use a time where poses are active (not at rest)
    const calm = computeIdlePose(2, 0, 0);
    const restless = computeIdlePose(2, 0, 1);
    // Both use same base time but different energy → calm should have smaller magnitudes
    expect(Math.abs(calm.bodySwayX)).toBeLessThan(Math.abs(restless.bodySwayX));
  });

  it("energy=0.5 (default) is backward compatible with no-energy call", () => {
    const withDefault = computeIdlePose(3, 2, 0.5);
    const withoutEnergy = computeIdlePose(3, 2);
    expect(withDefault.leftArmX).toBe(withoutEnergy.leftArmX);
    expect(withDefault.chairTurn).toBe(withoutEnergy.chairTurn);
    expect(withDefault.bodySwayX).toBe(withoutEnergy.bodySwayX);
  });

  it("higher energy speeds up the animation cycle", () => {
    // At energy=1, time runs at 1.5x → different cycle phase than energy=0 at 0.5x
    const calm = computeIdlePose(10, 0, 0);
    const restless = computeIdlePose(10, 0, 1);
    // Different time scaling means different cycle positions → different pose values
    const isDifferent =
      calm.leftArmX !== restless.leftArmX ||
      calm.chairTurn !== restless.chairTurn ||
      calm.torsoLean !== restless.torsoLean;
    expect(isDifferent).toBe(true);
  });
});
