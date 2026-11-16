// Starts the prototype's dev server for QA on port 5180 in sample-data mode with the Google Maps key forced EMPTY.
// Vite gives variables that already exist in the process environment priority over .env files, so the key in .env is neither read
// nor used: the prototype's venue picker then shows the same "not configured" panel it shows without a key.
// Usage: node start-prototype-nokey.mjs   (detaches; stop it by killing the process listening on 5180)
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve("../..");
const log = fs.openSync(path.join(os.tmpdir(), "proto.log"), "w");
const child = spawn("npx", ["vite", "--port", "5180", "--strictPort"], {
  cwd: root, shell: true, detached: true, stdio: ["ignore", log, log],
  env: { ...process.env, VITE_USE_DATABASE: "false", VITE_GOOGLE_MAPS_API_KEY: "" },
});
child.unref();
console.log("prototype QA server starting on :5180 (sample data, Maps key forced empty), pid", child.pid);
