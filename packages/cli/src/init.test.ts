import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { scaffoldProject } from "./init";

describe("scaffoldProject", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "diorama-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates project directory with given name", () => {
    const projectDir = path.join(tmpDir, "my-office");
    scaffoldProject({ name: "my-office", dir: projectDir, template: "starter" });
    expect(fs.existsSync(projectDir)).toBe(true);
  });

  it("creates a valid package.json", () => {
    const projectDir = path.join(tmpDir, "test-project");
    scaffoldProject({ name: "test-project", dir: projectDir, template: "starter" });
    const pkgPath = path.join(projectDir, "package.json");
    expect(fs.existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    expect(pkg.name).toBe("test-project");
    expect(pkg.dependencies).toHaveProperty("@diorama/engine");
    expect(pkg.dependencies).toHaveProperty("@diorama/plugins");
  });

  it("creates a diorama.config.json with starter template", () => {
    const projectDir = path.join(tmpDir, "starter-test");
    scaffoldProject({ name: "starter-test", dir: projectDir, template: "starter" });
    const configPath = path.join(projectDir, "diorama.config.json");
    expect(fs.existsSync(configPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(config.name).toBe("starter-test");
    expect(config.rooms.length).toBeGreaterThanOrEqual(3);
    expect(config.view).toBe("3d-office");
    expect(config.theme).toBe("neon-dark");
  });

  it("creates a diorama.config.json with minimal template", () => {
    const projectDir = path.join(tmpDir, "minimal-test");
    scaffoldProject({ name: "minimal-test", dir: projectDir, template: "minimal" });
    const config = JSON.parse(
      fs.readFileSync(path.join(projectDir, "diorama.config.json"), "utf-8")
    );
    expect(config.rooms.length).toBe(1);
    expect(config.view).toBe("dashboard");
  });

  it("creates a tsconfig.json", () => {
    const projectDir = path.join(tmpDir, "ts-test");
    scaffoldProject({ name: "ts-test", dir: projectDir, template: "starter" });
    expect(fs.existsSync(path.join(projectDir, "tsconfig.json"))).toBe(true);
  });

  it("throws if directory already exists and is not empty", () => {
    const projectDir = path.join(tmpDir, "existing");
    fs.mkdirSync(projectDir);
    fs.writeFileSync(path.join(projectDir, "file.txt"), "content");
    expect(() =>
      scaffoldProject({ name: "existing", dir: projectDir, template: "starter" })
    ).toThrow();
  });

  it("succeeds if directory exists but is empty", () => {
    const projectDir = path.join(tmpDir, "empty-dir");
    fs.mkdirSync(projectDir);
    scaffoldProject({ name: "empty-dir", dir: projectDir, template: "starter" });
    expect(fs.existsSync(path.join(projectDir, "package.json"))).toBe(true);
  });
});
