import { need } from "./review-inputs.mjs";

export function packetConcurrency(value) {
  need(value === undefined || Number.isSafeInteger(value) && value >= 1 && value <= 3,
    "Invalid packetConcurrency (expected an integer from 1 through 3)");
  return value ?? 1;
}

// A prepared packet enters the schedule only when the runtime is about to
// start its sandbox. The same callback checks the deadline and failure latch.
export async function schedulePackets(count, concurrency, clock, run) {
  const events = [];
  const active = new Set();
  const stop = new AbortController();
  let error;
  try {
    for (let packet = 1; packet <= count && !stop.signal.aborted; packet++) {
      if (active.size === concurrency) await Promise.race(active);
      if (stop.signal.aborted || !await clock.next(packet - 1, stop.signal)) break;
      const ready = Promise.withResolvers();
      let launched = false;
      const begin = () => {
        if (stop.signal.aborted) return 0;
        const timeoutMs = clock.remaining();
        if (timeoutMs === 0) return 0;
        need(!launched, "Packet already launched");
        launched = true;
        events.push(["launch", packet]);
        ready.resolve();
        return timeoutMs;
      };
      const halt = () => {
        if (!launched || stop.signal.aborted) return;
        events.push(["halt", packet]);
        stop.abort();
      };
      const pending = Promise.resolve().then(() => run(packet, begin, halt, stop.signal)).then((passed) => {
        if (launched) events.push(["settle", packet]);
        if (!passed) stop.abort();
      }).catch((cause) => {
        error ??= cause;
        stop.abort();
      }).finally(() => {
        active.delete(pending);
        ready.resolve();
      });
      active.add(pending);
      await ready.promise;
    }
  } catch (cause) {
    if (!stop.signal.aborted && cause?.name !== "AbortError") error ??= cause;
    stop.abort();
  } finally {
    await Promise.all(active);
  }
  if (error) throw error;
  return events;
}

export function replayPacketSchedule(events, concurrency, packets, probePassed) {
  need(Array.isArray(events) && events.length <= packets.length * 2 + 1, "Missing or invalid packet schedule");
  const active = new Set();
  let next = 1;
  let stopped = !probePassed;
  let firstFailure;
  for (const event of events) {
    need(Array.isArray(event) && event.length === 2, "Invalid packet schedule event");
    const [action, packet] = event;
    const observation = packets[packet - 1];
    need(Number.isSafeInteger(packet) && observation, "Packet schedule has no matching capture");
    if (action === "launch") {
      need(!stopped && packet === next && active.size < concurrency, "Packet launched after failure or outside its schedule");
      next++;
      active.add(packet);
    } else if (action === "halt") {
      need(!stopped && active.has(packet) && observation.failure, "Unproved packet schedule halt");
      stopped = true;
      firstFailure = observation;
    } else {
      need(action === "settle" && active.delete(packet), "Packet settlement has no active launch");
      if (observation.failure) {
        stopped = true;
        firstFailure ??= observation;
      }
    }
  }
  need(active.size === 0 && next === packets.length + 1, "Packet schedule does not settle every captured launch");
  return firstFailure;
}
