#!/usr/bin/env node
import { writeSync } from "node:fs";
import { detectAgents } from "./agent-discovery.mjs";
import { qualificationInventory } from "./adapter-qualification.mjs";

if (process.argv.length !== 2) {
  writeSync(2, "Usage: detect-agents.mjs\n");
  process.exitCode = 2;
} else {
  const agents = detectAgents();
  writeSync(1, JSON.stringify({ schemaVersion: 1, agents, qualification: qualificationInventory(agents) }, null, 2) + "\n");
}
