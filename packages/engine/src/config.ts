import { z } from "zod";

const FurnitureItemSchema = z.object({
  geometry: z.enum(["box", "cylinder", "sphere", "plane"]),
  size: z.tuple([z.number(), z.number(), z.number()]),
  position: z.tuple([z.number(), z.number(), z.number()]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).optional(),
  label: z.string().optional(),
  material: z.object({
    color: z.string(),
    emissive: z.string().optional(),
    wireframe: z.boolean().optional(),
    opacity: z.number().optional(),
  }),
});

const RoomColorsSchema = z.object({
  accent: z.string().optional(),
  floor: z.string().optional(),
  wall: z.string().optional(),
});

const RoomSchema = z.object({
  preset: z.string(),
  position: z.tuple([z.number(), z.number()]),
  size: z.tuple([z.number(), z.number()]),
  label: z.string(),
  colors: RoomColorsSchema.optional(),
  furniture: z.array(FurnitureItemSchema).optional(),
  floorStyle: z.enum(["solid", "grid-tiles", "wood-planks", "hex-tiles", "carpet"]).optional(),
});

const AgentAssignmentSchema = z.object({
  desk: z.string(),
  /** Reference to a specific seat: "room-label::furniture-index" */
  seat: z.string().optional(),
  /** Room labels this agent can visit. Empty array = unrestricted (can go anywhere). */
  allowedRooms: z.array(z.string()).default([]),
  /** Energy level 0 (calm) to 1 (restless). Controls idle animation speed/intensity. */
  energy: z.number().min(0).max(1).default(0.5),
  color: z.string().optional(),
});

const GatewaySchema = z.object({
  url: z.string(),
  token: z.string().optional(),
});

/**
 * An agent event source. `openclaw` uses the gateway settings; `codex` and
 * `claude-code` tail local session files; `ingest` accepts pushed events on
 * the public protocol (POST /api/ingest).
 */
const SourceSchema = z.object({
  type: z.enum(["openclaw", "codex", "claude-code", "ingest"]),
  /** Optional override (gateway URL, sessions dir…) */
  target: z.string().optional(),
});

const DioramaConfigSchema = z.object({
  name: z.string(),
  gateway: GatewaySchema,
  view: z.string().default("3d-office"),
  theme: z.string().default("neon-dark"),
  rooms: z.array(RoomSchema).default([]),
  agents: z.record(z.string(), AgentAssignmentSchema).default({}),
  /** Connected agent sources. Empty/omitted = legacy gateway-or-demo behavior. */
  sources: z.array(SourceSchema).default([]),
});

export type DioramaConfig = z.infer<typeof DioramaConfigSchema>;
export type RoomConfig = z.infer<typeof RoomSchema>;
export type RoomColors = z.infer<typeof RoomColorsSchema>;
export type AgentAssignment = z.infer<typeof AgentAssignmentSchema>;
export type SourceConfig = z.infer<typeof SourceSchema>;

export class DioramaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DioramaConfigError";
  }
}

function resolveEnvVars(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value.startsWith("$")) {
    const envName = value.slice(1);
    return process.env[envName] ?? "";
  }
  return value;
}

export function parseConfig(raw: unknown): DioramaConfig {
  const result = DioramaConfigSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new DioramaConfigError(`Invalid config: ${messages}`);
  }
  const config = result.data;
  config.gateway.token = resolveEnvVars(config.gateway.token);
  return config;
}
