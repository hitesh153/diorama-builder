import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { tailJsonlDirectory, type JsonlTailHandle } from "./jsonlTail";

let tmpDir: string;
let handle: JsonlTailHandle | null = null;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "diorama-tail-"));
});

afterEach(() => {
  handle?.stop();
  handle = null;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function write(file: string, content: string) {
  fs.writeFileSync(path.join(tmpDir, file), content);
}
function append(file: string, content: string) {
  fs.appendFileSync(path.join(tmpDir, file), content);
}

describe("tailJsonlDirectory", () => {
  it("live-only by default: skips pre-existing content, picks up appends", () => {
    write("a.jsonl", '{"n":1}\n');
    const records: unknown[] = [];
    handle = tailJsonlDirectory({
      dir: tmpDir,
      intervalMs: 60_000,
      onRecord: (r) => records.push(r),
    });
    expect(records).toHaveLength(0);

    append("a.jsonl", '{"n":2}\n{"n":3}\n');
    handle.scan();
    expect(records).toEqual([{ n: 2 }, { n: 3 }]);
  });

  it("fromStart replays existing content", () => {
    write("a.jsonl", '{"n":1}\n{"n":2}\n');
    const records: unknown[] = [];
    handle = tailJsonlDirectory({
      dir: tmpDir,
      intervalMs: 60_000,
      fromStart: true,
      onRecord: (r) => records.push(r),
    });
    expect(records).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it("handles partial lines across scans", () => {
    write("a.jsonl", "");
    const records: unknown[] = [];
    handle = tailJsonlDirectory({ dir: tmpDir, intervalMs: 60_000, onRecord: (r) => records.push(r) });

    append("a.jsonl", '{"n":');
    handle.scan();
    expect(records).toHaveLength(0);

    append("a.jsonl", '1}\n');
    handle.scan();
    expect(records).toEqual([{ n: 1 }]);
  });

  it("discovers new files (from byte 0) after the first scan", () => {
    const records: Array<{ file: string; record: unknown }> = [];
    handle = tailJsonlDirectory({
      dir: tmpDir,
      intervalMs: 60_000,
      onRecord: (record, file) => records.push({ file: path.basename(file), record }),
    });

    write("new.jsonl", '{"fresh":true}\n');
    handle.scan();
    expect(records).toEqual([{ file: "new.jsonl", record: { fresh: true } }]);
  });

  it("scans nested directories and applies the filter", () => {
    fs.mkdirSync(path.join(tmpDir, "2026/07/06"), { recursive: true });
    const records: unknown[] = [];
    handle = tailJsonlDirectory({ dir: tmpDir, intervalMs: 60_000, onRecord: (r) => records.push(r) });

    fs.writeFileSync(path.join(tmpDir, "2026/07/06/session.jsonl"), '{"deep":1}\n');
    fs.writeFileSync(path.join(tmpDir, "2026/07/06/notes.txt"), "not json\n");
    handle.scan();
    expect(records).toEqual([{ deep: 1 }]);
  });

  it("reports parse errors without stopping", () => {
    write("a.jsonl", "");
    const records: unknown[] = [];
    const errors: string[] = [];
    handle = tailJsonlDirectory({
      dir: tmpDir,
      intervalMs: 60_000,
      onRecord: (r) => records.push(r),
      onParseError: (line) => errors.push(line),
    });

    append("a.jsonl", 'not-json\n{"ok":1}\n');
    handle.scan();
    expect(errors).toEqual(["not-json"]);
    expect(records).toEqual([{ ok: 1 }]);
  });

  it("recovers from truncation", () => {
    write("a.jsonl", "");
    const records: unknown[] = [];
    handle = tailJsonlDirectory({ dir: tmpDir, intervalMs: 60_000, onRecord: (r) => records.push(r) });

    append("a.jsonl", '{"n":1111}\n');
    handle.scan();
    write("a.jsonl", '{"n":9}\n'); // truncated to a smaller size → offset reset
    handle.scan();
    expect(records).toEqual([{ n: 1111 }, { n: 9 }]);
  });

  it("survives a missing directory", () => {
    const records: unknown[] = [];
    handle = tailJsonlDirectory({
      dir: path.join(tmpDir, "does-not-exist"),
      intervalMs: 60_000,
      onRecord: (r) => records.push(r),
    });
    handle.scan();
    expect(records).toHaveLength(0);
  });
});
