// Builder store
export { createBuilderState, builderReducer } from "./builderStore";
export type { BuilderState, RoomPlacement, BuilderAction, FurnitureRef } from "./builderStore";

// Copilot tool surface
export {
  COPILOT_TOOLS,
  applyToolCall,
  roomProgramForTeam,
  describeWorld,
} from "./copilotTools";
export type {
  CopilotToolDef,
  CopilotToolCall,
  CopilotEffect,
  ApplyResult,
  LayoutRoomSpec,
} from "./copilotTools";

// Config sync
export { loadBuilderStateFromConfig, saveBuilderStateToConfig } from "./configSync";

// Room catalog
export { createRoomCatalog } from "./roomCatalog";
export type { RoomCatalogEntry } from "./roomCatalog";

// Agent assignment
export { assignAgentToDesk, unassignAgent, getAssignments } from "./agentAssignment";
export type { AgentDeskMap, DeskAssignment } from "./agentAssignment";
