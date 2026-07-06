import fs from "fs";
import path from "path";

/**
 * Generic JSONL directory tailer — the primitive under every
 * session-file-based connector (Codex CLI, Claude Code, anything that
 * appends JSON lines to per-session files).
 *
 * Polling-based (fs.watch is unreliable across editors/platforms for
 * append-heavy files): every `intervalMs` it scans for matching files,
 * reads bytes appended since the last offset, splits complete lines, and
 * hands each parsed JSON value to `onRecord` with the file path.
 *
 * New files found on a scan start from EITHER the beginning (replay) or
 * the current end (live-only), controlled by `fromStart`.
 */

export interface JsonlTailOptions {
  /** Directory to scan (recursively). */
  dir: string;
  /** File filter — return true to tail this file. Default: *.jsonl */
  filter?: (filePath: string) => boolean;
  /** Poll interval in ms. Default 1000. */
  intervalMs?: number;
  /** Replay existing content of files discovered on the FIRST scan. Default false (live-only). */
  fromStart?: boolean;
  /** Only consider files modified within this many ms (default 24h); older files are ignored. */
  maxAgeMs?: number;
  /** Called for each parsed JSON line. */
  onRecord: (record: unknown, filePath: string) => void;
  /** Called when a line fails to parse (optional). */
  onParseError?: (line: string, filePath: string) => void;
}

export interface JsonlTailHandle {
  stop(): void;
  /** Force an immediate scan (used by tests). */
  scan(): void;
}

function listFilesRecursive(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFilesRecursive(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

export function tailJsonlDirectory(options: JsonlTailOptions): JsonlTailHandle {
  const {
    dir,
    filter = (f) => f.endsWith(".jsonl"),
    intervalMs = 1000,
    fromStart = false,
    maxAgeMs = 24 * 60 * 60 * 1000,
    onRecord,
    onParseError,
  } = options;

  // Per-file byte offset + partial-line carry
  const offsets = new Map<string, { offset: number; carry: string }>();
  let firstScan = true;
  let stopped = false;

  const scan = () => {
    if (stopped) return;
    const now = Date.now();
    const files = listFilesRecursive(dir).filter(filter);

    for (const file of files) {
      let stat: fs.Stats;
      try {
        stat = fs.statSync(file);
      } catch {
        continue;
      }
      if (now - stat.mtimeMs > maxAgeMs) continue;

      let entry = offsets.get(file);
      if (!entry) {
        entry = { offset: firstScan && !fromStart ? stat.size : 0, carry: "" };
        offsets.set(file, entry);
      }
      // File truncated/rotated — start over
      if (stat.size < entry.offset) {
        entry.offset = 0;
        entry.carry = "";
      }
      if (stat.size === entry.offset) continue;

      let fd: number;
      try {
        fd = fs.openSync(file, "r");
      } catch {
        continue;
      }
      try {
        const length = stat.size - entry.offset;
        const buf = Buffer.alloc(length);
        fs.readSync(fd, buf, 0, length, entry.offset);
        entry.offset = stat.size;

        const text = entry.carry + buf.toString("utf-8");
        const lines = text.split("\n");
        entry.carry = lines.pop() ?? ""; // last piece may be incomplete

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            onRecord(JSON.parse(trimmed), file);
          } catch {
            onParseError?.(trimmed, file);
          }
        }
      } finally {
        fs.closeSync(fd);
      }
    }
    firstScan = false;
  };

  scan();
  const timer = setInterval(scan, intervalMs);
  // Don't hold the process open just for tailing
  timer.unref?.();

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
    scan,
  };
}
