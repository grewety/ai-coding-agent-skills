#!/usr/bin/env node
import { detectAgents } from "./agent-discovery.mjs";
import { qualificationInventory } from "./adapter-qualification.mjs";

if (process.argv.length !== 2) {
  process.stderr.write("Usage: detect-agents.mjs\n");
  process.exitCode = 2;
} else {
  const agents = detectAgents();
  process.stdout.write(JSON.stringify({ schemaVersion: 1, agents, qualification: qualificationInventory(agents) }, null, 2) + "\n");
}
