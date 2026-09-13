export function clockSample(serverTime, startedAt, endedAt, roundTrip = endedAt - startedAt) {
  const server = Number(serverTime);
  if (!Number.isFinite(server) || !Number.isFinite(roundTrip) || roundTrip < 0) {
    throw new Error("The server clock could not be synchronized.");
  }
  return { offset: server + roundTrip / 2 - endedAt, latency: roundTrip, measuredAt: endedAt };
}

export function bestClockSample(samples) {
  if (!samples.length) throw new Error("The server clock could not be reached. Reconnect before taking a photo.");
  return samples.reduce((best, sample) => sample.latency < best.latency ? sample : best);
}

export function countdownTiming(captureAt, offset, now = Date.now()) {
  const target = typeof captureAt === "number" ? captureAt : Date.parse(captureAt);
  const difference = target - (now + offset);
  return { target, difference, remaining: Math.max(0, Math.ceil(difference / 1000)), late: Math.max(0, -difference) };
}
