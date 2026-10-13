import { spawn } from "node:child_process";

const dev = process.argv.includes("--dev");
const forwarded = process.argv.slice(2).filter((arg) => arg !== "--dev");
const env = { ...process.env, NODE_ENV: dev ? "development" : "production" };
const children = [
  spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", dev ? "dev" : "start", ...forwarded],
    { stdio: "inherit", env, windowsHide: true },
  ),
  spawn(process.execPath, ["--import", "tsx", "scripts/automation-worker.ts"], {
    stdio: "inherit",
    env,
    windowsHide: true,
  }),
];
let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
  const timer = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 10000);
  timer.unref();
}
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => close());
for (const child of children) {
  child.on("error", () => {
    console.error("Impossible de démarrer l’application et son worker.");
    close(1);
  });
  child.on("exit", (code) => {
    if (!closing) close(code || 1);
  });
}
