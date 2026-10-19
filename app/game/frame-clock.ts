export type FrameClock = {
  previousTimestamp: number | null;
  accumulatedMs: number;
};

export function createFrameClock(): FrameClock {
  return { previousTimestamp: null, accumulatedMs: 0 };
}

export function advanceFrameClock(clock: FrameClock, timestamp: number, tickMs: number): {
  clock: FrameClock;
  steps: number;
} {
  if (!Number.isFinite(timestamp) || !Number.isFinite(tickMs) || tickMs <= 0) {
    throw new RangeError("invalid frame clock arguments");
  }
  const elapsed = clock.previousTimestamp === null
    ? tickMs
    : Math.max(0, Math.min(timestamp - clock.previousTimestamp, 250));
  let accumulatedMs = clock.accumulatedMs + elapsed;
  let steps = 0;
  while (accumulatedMs >= tickMs && steps < 5) {
    accumulatedMs -= tickMs;
    steps++;
  }
  if (steps === 5) accumulatedMs = Math.min(accumulatedMs, tickMs);
  return {
    clock: { previousTimestamp: timestamp, accumulatedMs },
    steps,
  };
}
