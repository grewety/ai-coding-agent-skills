import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { need, fields } from "./role-config.mjs";

const commands = { codex: "codex.exe", "claude-code": "claude.exe", "grok-build": "grok.exe", pi: "pi.exe" };

export function windowsPrerequisites({ enabled, clients, platform = process.platform, release = os.release(),
  interop = process.env.WSL_INTEROP, observe = observeWindows } = {}) {
  if (!enabled) return { status: "disabled" };
  need(Array.isArray(clients) && clients.length > 0 && new Set(clients).size === clients.length &&
    clients.every((name) => Object.hasOwn(commands, name)), "Select the required native Windows AI clients");
  if (platform !== "win32" && !(platform === "linux" && /microsoft.*wsl2/i.test(release) && interop))
    return { status: "unsupported-on-host" };
  const observed = observe(clients.map((name) => commands[name]), platform);
  if (!observed || observed.nativeWindows !== true) return { status: "unsupported-on-host" };
  fields(observed, ["nativeWindows", "executables", "container", "job", "filesystem"], [], "Windows prerequisite report");
  fields(observed.executables, clients.map((name) => commands[name]), [], "Windows native client inventory");
  const missing = clients.filter((name) => observed.executables[commands[name]] !== true);
  if (missing.length) return { status: "missing-windows-client", missing };
  const pending = ["container", "job", "filesystem"].filter((name) => observed[name] !== true);
  return { status: "unqualified", pending: [...pending, "exact-native-qualification"] };
}

function observeWindows(names, platform) {
  const powershell = platform === "win32"
    ? path.win32.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    : "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";
  const script = `
    $ErrorActionPreference = 'Stop'
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { exit 2 }
    $found = @{}
    foreach ($name in @(${names.map((name) => "'" + name + "'").join(",")})) {
      $found[$name] = $false
      $cmd = Get-Command -CommandType Application -Name $name -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($cmd -and $cmd.Source -match '^[A-Za-z]:\\\\') {
        $file = [IO.File]::OpenRead($cmd.Source)
        try {
          $reader = New-Object IO.BinaryReader($file)
          if ($file.Length -ge 64 -and $reader.ReadUInt16() -eq 0x5a4d) {
            $file.Position = 60
            $offset = $reader.ReadUInt32()
            if ($offset -ge 64 -and $offset -le $file.Length - 4) {
              $file.Position = $offset
              $found[$name] = $reader.ReadUInt32() -eq 0x00004550
            }
          }
        } finally { $file.Dispose() }
      }
    }
    @{nativeWindows=$true;executables=$found;container=$false;job=$false;filesystem=$false} | ConvertTo-Json -Compress
  `;
  const result = spawnSync(powershell, ["-NoProfile", "-NonInteractive", "-EncodedCommand",
    Buffer.from(script, "utf16le").toString("base64")], { encoding: "utf8", timeout: 5000, maxBuffer: 4096, windowsHide: true });
  if (result.status !== 0) return null;
  try { return JSON.parse(result.stdout); } catch { return null; }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [flag, ...clients] = process.argv.slice(2);
  try {
    const result = windowsPrerequisites({ enabled: flag === "--enable", clients });
    process.stdout.write(JSON.stringify(result) + "\n");
    process.exitCode = 2;
  } catch {
    process.stdout.write(JSON.stringify({ status: "unqualified", pending: ["valid-prerequisite-request"] }) + "\n");
    process.exitCode = 2;
  }
}
