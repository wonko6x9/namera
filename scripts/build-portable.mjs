#!/usr/bin/env node
import { existsSync, mkdirSync, rmSync, copyFileSync, cpSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const portableRoot = join(repoRoot, "dist-portable", platform());
const appDir = join(portableRoot, "Namera");

const tauriResult = spawnSync("pnpm", ["exec", "tauri", "build", "--no-bundle"], {
  cwd: join(repoRoot, "apps", "desktop"),
  stdio: "inherit",
  shell: platform() === "win32",
});

if (tauriResult.error || tauriResult.status !== 0) {
  process.exit(tauriResult.status ?? 1);
}

const releaseDirs = [
  join(repoRoot, "target", "release"),
  join(repoRoot, "apps", "desktop", "src-tauri", "target", "release"),
];

const exeName = platform() === "win32" ? "namera-desktop.exe" : "namera-desktop";
const sourceExe = releaseDirs.map((dir) => join(dir, exeName)).find((candidate) => existsSync(candidate));

if (!sourceExe) {
  console.error(`Could not find built executable ${exeName} after tauri build --no-bundle.`);
  process.exit(1);
}

rmSync(portableRoot, { recursive: true, force: true });
mkdirSync(appDir, { recursive: true });
copyFileSync(sourceExe, join(appDir, platform() === "win32" ? "Namera.exe" : "Namera"));

for (const relative of ["target/release/resources", "apps/desktop/src-tauri/target/release/resources"]) {
  const candidate = join(repoRoot, relative);
  if (existsSync(candidate)) {
    cpSync(candidate, join(appDir, "resources"), { recursive: true });
    break;
  }
}

console.log(`Portable app folder prepared at ${appDir}`);

if (platform() === "win32") {
  const zipPath = join(portableRoot, "Namera-portable-win64.zip");
  const zipResult = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${appDir.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: "inherit" },
  );

  if (zipResult.error || zipResult.status !== 0) {
    console.error("Portable app folder was created, but ZIP packaging failed.");
    process.exit(zipResult.status ?? 1);
  }

  console.log(`Portable ZIP prepared at ${zipPath}`);
}
