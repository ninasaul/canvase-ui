#!/usr/bin/env node
/**
 * One command for the whole local dev stack:
 *   pnpm dev  →  Next.js (:3917) + asset thumbnail worker (BullMQ)
 *
 * - Prefixes each line so app / worker output stays readable.
 * - Warns (does not fail) when Redis is unreachable; the app still runs.
 * - Ctrl-C stops both; if the app exits, the worker is stopped too.
 */
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";

const ROOT = path.resolve(import.meta.dirname, "..");
// Next and the worker load .env themselves; the launcher needs it for the preflight.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(ROOT, file));
  } catch {
    // Missing file is fine (CI / prod env vars).
  }
}
const PORT = String(process.env.PORT ?? "3917");
const USE_COLOR = process.stdout.isTTY;

const COLORS = {
  app: "\u001b[36m", // cyan
  worker: "\u001b[35m", // magenta
  warn: "\u001b[33m",
  reset: "\u001b[0m",
};

function paint(name, text) {
  if (!USE_COLOR) {
    return text;
  }
  return `${COLORS[name]}${text}${COLORS.reset}`;
}

function log(name, message) {
  process.stdout.write(`${paint(name, `[${name}]`)} ${message}\n`);
}

function binPath(name) {
  const suffix = process.platform === "win32" ? ".cmd" : "";
  return path.join(ROOT, "node_modules", ".bin", `${name}${suffix}`);
}

function pipeWithPrefix(child, name) {
  for (const stream of [child.stdout, child.stderr]) {
    if (!stream) {
      continue;
    }
    const rl = readline.createInterface({ input: stream });
    rl.on("line", (line) => {
      process.stdout.write(`${paint(name, `[${name}]`)} ${line}\n`);
    });
  }
}

function redisTarget() {
  const raw = process.env.REDIS_URL?.trim();
  if (!raw) {
    return null;
  }
  try {
    const url = new URL(raw);
    return {
      host: url.hostname || "127.0.0.1",
      port: Number(url.port || "6379") || 6379,
      db: url.pathname.replace(/^\//, "") || "0",
    };
  } catch {
    return null;
  }
}

function checkTcp(host, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function preflight() {
  const redis = redisTarget();
  if (!redis) {
    log("warn", "REDIS_URL 未设置 —— worker 会跳过缩略图任务");
    return;
  }
  const ok = await checkTcp(redis.host, redis.port);
  if (!ok) {
    log(
      "warn",
      `Redis ${redis.host}:${redis.port} 连不上 —— worker 会重试/退出，应用不受影响`,
    );
  }
}

const children = new Set();
let shuttingDown = false;

function spawnChild(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);
  pipeWithPrefix(child, name);
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  const force = setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
    process.exit(code);
  }, 3000);
  force.unref();
  const check = setInterval(() => {
    if ([...children].every((child) => child.exitCode !== null)) {
      clearInterval(check);
      process.exit(code);
    }
  }, 100);
  check.unref();
  setTimeout(() => process.exit(code), 3500).unref();
}

async function main() {
  await preflight();

  log("app", `starting next dev on http://localhost:${PORT}`);
  const app = spawnChild("app", binPath("next"), ["dev", "-p", PORT], {});

  log("worker", "starting asset thumbnail worker");
  const worker = spawnChild(
    "worker",
    binPath("tsx"),
    ["watch", "--tsconfig", "tsconfig.json", "worker/src/main.ts"],
    {},
  );

  app.on("exit", (code, signal) => {
    if (!shuttingDown) {
      log("warn", `app exited (${signal ?? code}) — stopping worker`);
      shutdown(code ?? 1);
    }
  });

  worker.on("exit", (code, signal) => {
    children.delete(worker);
    if (!shuttingDown) {
      log(
        "warn",
        `worker exited (${signal ?? code}) — app keeps running; fix the error and rerun pnpm dev:worker`,
      );
    }
  });

  process.on("SIGINT", () => {
    log("warn", "SIGINT — stopping dev stack");
    shutdown(0);
  });
  process.on("SIGTERM", () => shutdown(0));
}

main().catch((error) => {
  console.error("dev:all failed:", error);
  shutdown(1);
});
