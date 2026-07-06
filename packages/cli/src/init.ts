import fs from "fs";
import path from "path";

export interface ScaffoldOptions {
  name: string;
  dir: string;
  template: "starter" | "full-office" | "minimal";
}

const TEMPLATES: Record<string, object> = {
  starter: {
    view: "3d-office",
    theme: "neon-dark",
    rooms: [
      { preset: "meeting", position: [0, 0], size: [4, 3], label: "Strategy Room" },
      { preset: "workspace", position: [4, 0], size: [5, 4], label: "Workspace" },
      { preset: "lab", position: [0, 3], size: [4, 4], label: "Lab" },
    ],
  },
  "full-office": {
    view: "3d-office",
    theme: "neon-dark",
    rooms: [
      { preset: "meeting", position: [0, 0], size: [4, 3], label: "Meeting Room" },
      { preset: "workspace", position: [4, 0], size: [5, 4], label: "Workspace" },
      { preset: "private", position: [9, 0], size: [2, 2], label: "Private Office" },
      { preset: "social", position: [0, 3], size: [3, 3], label: "Social Lounge" },
      { preset: "lab", position: [3, 4], size: [4, 4], label: "Lab" },
    ],
  },
  minimal: {
    view: "dashboard",
    theme: "minimal",
    rooms: [
      { preset: "workspace", position: [0, 0], size: [5, 4], label: "General" },
    ],
  },
};

export function scaffoldProject(opts: ScaffoldOptions): void {
  const { name, dir, template } = opts;

  // Check if dir exists and is non-empty
  if (fs.existsSync(dir)) {
    const contents = fs.readdirSync(dir);
    if (contents.length > 0) {
      throw new Error(`Directory "${dir}" is not empty`);
    }
  } else {
    fs.mkdirSync(dir, { recursive: true });
  }

  const templateConfig = TEMPLATES[template] ?? TEMPLATES.starter;

  // package.json
  const pkg = {
    name,
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "diorama dev",
      build: "diorama build",
    },
    dependencies: {
      "@diorama/engine": "^0.1.0",
      "@diorama/plugins": "^0.1.0",
      "@diorama/cli": "^0.1.0",
      "@diorama/ui": "^0.1.0",
    },
  };
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg, null, 2));

  // diorama.config.json — v3 shape: sources[] is the connection mechanism,
  // gateway stays configurable but empty (no fake defaults)
  const config = {
    name,
    gateway: { url: "", token: "" },
    sources: [],
    ...templateConfig,
    agents: {},
  };
  fs.writeFileSync(path.join(dir, "diorama.config.json"), JSON.stringify(config, null, 2));

  // tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
  };
  fs.writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));
}
