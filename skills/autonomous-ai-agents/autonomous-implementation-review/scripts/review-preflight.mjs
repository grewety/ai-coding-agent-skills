import { lstat } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { digest, hash, jsonBytes, need, parseStrictJson, separate, absolute } from "./review-inputs.mjs";
import { requireReviewHost, validateHostConfig, verifyRuntimePins } from "./review-runtime.mjs";
import { readClosed } from "./worker-handoff.mjs";
import { packetConcurrency } from "./review-packet-scheduler.mjs";

export async function trustedJson(file, excluded, privateFile = false) {
  need(absolute(file) && excluded.every((root) => separate(file, root)), "Trusted configuration overlaps the checkout or review records");
  const bytes = await readClosed(file, 65536);
  const stat = await lstat(file);
  need(stat.isFile() && stat.nlink === 1 && (stat.mode & (privateFile ? 0o077 : 0o022)) === 0 &&
    (process.getuid === undefined || [0, process.getuid()].includes(stat.uid)), "Untrusted configuration ownership");
  return { value: parseStrictJson(bytes), configurationSha256: hash(bytes) };
}

export async function offlineHostBinding(file, expect, excluded, exactBytes = true, pilotOptions = {}) {
  const { value: config, configurationSha256 } = await trustedJson(file, excluded);
  const concurrency = packetConcurrency(config.packetConcurrency);
  need(concurrency === packetConcurrency(expect.packetConcurrency) &&
    (concurrency === 1 || expect.configurationSha256 === configurationSha256),
  "Review packet concurrency differs from the exact host pin or independent expectation");
  if (config.schemaVersion === 2) {
    need(configurationSha256 === expect.configurationSha256 && config.roleBinding?.model === expect.model,
      "Explicit host configuration pin or model mismatch");
    const admitted = requireReviewHost(config, excluded, { ...pilotOptions, configurationSha256,
      hostPin: { path: file, sha256: configurationSha256 } });
    await verifyRuntimePins(admitted, excluded);
    return { config: admitted, configurationSha256 };
  }
  need(expect.explicit === undefined && expect.qualification === undefined && expect.generator === undefined,
    "Explicit reviewer expectation requires schema 2 host configuration");
  validateHostConfig(config);
  need(digest(expect.configurationSha256) &&
    (configurationSha256 === expect.configurationSha256 || !exactBytes && hash(jsonBytes(config)) === expect.configurationSha256) &&
    config.model === expect.model, "Host configuration pin or model mismatch");
  return { config, configurationSha256 };
}

export function checkPacketTurns({ manifest }, maxTurns) {
  need(Number.isSafeInteger(maxTurns) && maxTurns <= 128, "Invalid maxTurns for packet review");
  need(maxTurns >= 11, "maxTurns must be at least 11 to leave a 10-turn reserve for at least 1 whole-file read");
  for (const [index, packet] of manifest.packets.entries()) {
    need(packet.paths.length <= maxTurns - 10,
      `Packet ${index + 1} requires ${packet.paths.length} whole-file reads. maxTurns ${maxTurns} allows ${maxTurns - 10} after reserve.`);
  }
}

export function reviewClock(config, count, { signal, now = () => performance.now(), wait = delay } = {}) {
  const interval = config.interPacketDelayMs ?? 0;
  const deadline = now() + (config.runTimeoutMs ?? (count + 1) * config.timeoutMs + Math.max(0, count - 1) * interval);
  function remaining() {
    signal?.throwIfAborted();
    return Math.max(0, Math.floor(deadline - now()));
  }
  return {
    remaining,
    async next(index, stop) {
      const waitSignal = signal && stop ? AbortSignal.any([signal, stop]) : signal ?? stop;
      waitSignal?.throwIfAborted();
      if (index > 0 && interval) {
        if (remaining() <= interval) return false;
        const earliest = now() + interval;
        await wait(interval, undefined, { signal: waitSignal });
        while (stop && now() < earliest) {
          await wait(Math.ceil(earliest - now()), undefined, { signal: waitSignal });
        }
      }
      waitSignal?.throwIfAborted();
      return remaining() > 0;
    },
  };
}
