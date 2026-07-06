"use client";

import { useEffect, useRef } from "react";
import { type EventBus } from "@diorama/engine";
import { createMockEventStream } from "@diorama/plugins";

export function useMockEventSource(eventBus: EventBus, active: boolean, roomLabels?: string[]) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Room labels only matter on (re)start of the stream — keep a ref so the
  // effect doesn't restart on every render from a fresh array identity.
  const roomLabelsRef = useRef<string[] | undefined>(roomLabels);
  roomLabelsRef.current = roomLabels;

  useEffect(() => {
    if (!active) return;

    const events = createMockEventStream(20, roomLabelsRef.current);
    let index = 0;

    function dispatchNext() {
      if (index >= events.length) {
        // Loop back to beginning after a pause
        index = 0;
        timerRef.current = setTimeout(dispatchNext, 3000);
        return;
      }

      eventBus.dispatch(events[index]);
      index++;

      const delay = index < events.length ? 800 + Math.random() * 400 : 3000;
      timerRef.current = setTimeout(dispatchNext, delay);
    }

    timerRef.current = setTimeout(dispatchNext, 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [eventBus, active]);
}
