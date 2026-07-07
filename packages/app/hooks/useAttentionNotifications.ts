"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** One agent currently blocked waiting for the user. */
export interface AttentionEntry {
  agent: string;
  since: number;
  label: string;
}

const OPT_OUT_KEY = "diorama.notifications.optout";

function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Only interrupt people who are looking elsewhere. */
function tabIsAway(): boolean {
  return document.visibilityState !== "visible" || !document.hasFocus();
}

/**
 * Browser notifications for "agent needs you" moments.
 *
 * - Never auto-prompts for permission: while permission is "default" and
 *   there is pending attention, `promptVisible` turns true so the caller can
 *   render an inline "Enable notifications" chip. `dismiss()` opts out
 *   permanently (localStorage).
 * - Notifies once per attention episode, tagged by agent so repeats replace
 *   rather than stack, and only when the tab is hidden/unfocused.
 * - Closes the notification when the agent's attention resolves.
 */
export function useAttentionNotifications(attention: AttentionEntry[]): {
  promptVisible: boolean;
  enableNotifications: () => void;
  dismissPrompt: () => void;
} {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [optedOut, setOptedOut] = useState(true);
  const openRef = useRef<Map<string, Notification>>(new Map());
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!notificationsSupported()) return;
    setPermission(Notification.permission);
    try {
      setOptedOut(localStorage.getItem(OPT_OUT_KEY) === "1");
    } catch {
      setOptedOut(false);
    }
  }, []);

  useEffect(() => {
    if (permission !== "granted") return;

    const current = new Set(attention.map((a) => a.agent));

    // Resolved agents: close their notification, forget the episode.
    for (const agent of [...notifiedRef.current]) {
      if (!current.has(agent)) {
        notifiedRef.current.delete(agent);
        openRef.current.get(agent)?.close();
        openRef.current.delete(agent);
      }
    }

    // New episodes: notify once each, only when the user is looking away.
    for (const entry of attention) {
      if (notifiedRef.current.has(entry.agent)) continue;
      if (!tabIsAway()) continue;
      notifiedRef.current.add(entry.agent);
      try {
        const n = new Notification(`${entry.agent} needs you`, {
          body: entry.label,
          tag: entry.agent, // same-agent repeats replace instead of stacking
        });
        openRef.current.set(entry.agent, n);
      } catch {
        // Notification construction can throw (e.g. some platforms require a
        // service worker) — attention still shows in-world.
      }
    }
  }, [attention, permission]);

  const enableNotifications = useCallback(() => {
    if (!notificationsSupported()) return;
    Notification.requestPermission().then((p) => setPermission(p));
  }, []);

  const dismissPrompt = useCallback(() => {
    setOptedOut(true);
    try {
      localStorage.setItem(OPT_OUT_KEY, "1");
    } catch {
      // private mode — session-only dismissal still applies
    }
  }, []);

  const promptVisible = permission === "default" && !optedOut && attention.length > 0;

  return { promptVisible, enableNotifications, dismissPrompt };
}
