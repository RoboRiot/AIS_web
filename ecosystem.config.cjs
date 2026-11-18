const fs = require("node:fs");
const path = require("node:path");

const cwd = fs.realpathSync(process.env.AIS_APP_ROOT || __dirname);
const release = process.env.AIS_RELEASE_ID;
if (!release || !/^[A-Za-z0-9_-]{1,80}$/.test(release)) throw new Error("An explicit AIS_RELEASE_ID is required");
const dist = path.join(".next-releases", release);
if (fs.readFileSync(path.join(cwd, dist, "BUILD_ID"), "utf8").trim() !== release) throw new Error("Release build ID does not match");
const port = Number(process.env.AIS_PORT || 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid AIS_PORT");

module.exports = { apps: [{
  name: "AIS_web",
  cwd,
  // Supervise Node itself. A bash/npm wrapper hides the child process's memory.
  script: path.join(cwd, "node_modules", "next", "dist", "bin", "next"),
  interpreter: process.execPath,
  args: ["start", "-H", "127.0.0.1", "-p", String(port)],
  node_args: ["--max-old-space-size=480"],
  exec_mode: "fork",
  instances: 1,
  autorestart: true,
  restart_delay: 1000,
  kill_timeout: 10000,
  // Operational guard, not proof that sustained memory growth is repaired.
  max_memory_restart: "450M",
  env: { NODE_ENV: "production", AIS_RELEASE_ID: release, AIS_NEXT_DIST_DIR: dist },
}] };
