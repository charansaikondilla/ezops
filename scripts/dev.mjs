// One command for local development: starts the API and the web app together, already wired to each other.
//   npm run dev
// Picks a free port for the API (8080 if available) and points the web app at it.
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** True when something already answers on this port at the given address. */
function answers(port, host) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host });
    const done = (v) => { s.destroy(); resolve(v); };
    s.setTimeout(800, () => done(false));
    s.once("connect", () => done(true));
    s.once("error", () => done(false));
  });
}

/** A port is free only if nothing answers on it (IPv4 or IPv6) and we can bind it ourselves. */
async function isFree(port) {
  if ((await answers(port, "127.0.0.1")) || (await answers(port, "::1"))) return false;
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(port);
  });
}

async function pickPort(preferred) {
  for (let p = preferred; p < preferred + 50; p++) if (await isFree(p)) return p;
  throw new Error(`No free port found from ${preferred} to ${preferred + 49}.`);
}

const apiPort = await pickPort(Number(process.env.PORT ?? 8080));
const apiUrl = `http://localhost:${apiPort}`;
if (apiPort !== Number(process.env.PORT ?? 8080)) console.log(`[dev] Port ${process.env.PORT ?? 8080} is busy, so the API will use ${apiPort}.`);

const children = [];
function run(name, workspace, extraEnv) {
  const child = spawn(`npm run dev --workspace ${workspace}`, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
    shell: true,
  });
  child.on("exit", (code) => {
    console.log(`[dev] ${name} stopped${code ? ` (exit code ${code})` : ""}.`);
    stop();
    process.exitCode = code ?? 0;
  });
  children.push(child);
}

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

run("API", "apps/api", { PORT: String(apiPort) });
run("Web app", "apps/web", { VITE_API_URL: apiUrl });
console.log(`[dev] API: ${apiUrl}   Web app: http://localhost:5173 (sign in at /#/login)`);
