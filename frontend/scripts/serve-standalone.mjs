/**
 * Run the built app the way production runs it.
 *
 * `next.config.mjs` sets `output: "standalone"`, and Next says plainly what that
 * means: `next start` "does not work with output: standalone" — it prints that
 * warning on every boot. It mostly appears to work, which is the problem: the
 * thing being verified locally is not the thing that ships. Production runs
 * `node server.js` out of the standalone bundle, so local verification should
 * too.
 *
 * The bundle is deliberately incomplete on its own. Next traces and copies the
 * modules the server imports, but not `.next/static` or `public/` — the
 * Dockerfile copies those in as separate layers, and away from Docker nobody
 * does, so `node .next/standalone/server.js` serves HTML whose every script and
 * image 404s. This puts them where the server looks and then starts it.
 *
 * Symlinks rather than copies: `public/` is 11MB of book covers, and duplicating
 * it on every boot is both slow and a way to serve yesterday's assets. A link
 * cannot go stale.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const standalone = path.join(root, ".next", "standalone");

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error(
    "No standalone build found at .next/standalone/server.js.\n" +
      "Run `npm run build` first.",
  );
  process.exit(1);
}

/** Point `target` at `source`, replacing whatever is there now. */
const link = (source, target) => {
  const rel = path.relative(path.dirname(target), source);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // lstat, not exists: a link pointing at a deleted directory still "exists".
  try {
    fs.lstatSync(target);
    fs.rmSync(target, { recursive: true, force: true });
  } catch {
    // Nothing there yet, which is the normal case after a fresh build.
  }
  fs.symlinkSync(rel, target, "junction");
  console.log(`  linked ${path.relative(root, target)} -> ${rel}`);
};

link(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"));
link(path.join(root, "public"), path.join(standalone, "public"));

const port = process.env.PORT ?? "5173";
console.log(`  serving the standalone build on http://localhost:${port}\n`);

const child = spawn(process.execPath, [path.join(standalone, "server.js")], {
  stdio: "inherit",
  env: { ...process.env, PORT: port, NODE_ENV: "production" },
});

// Hand signals through so Ctrl-C and `docker stop` both shut the server down
// rather than orphaning it.
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
