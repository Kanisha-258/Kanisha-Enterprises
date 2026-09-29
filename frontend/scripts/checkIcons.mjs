/**
 * Verifies that every icon imported from lucide-react actually exists.
 *
 * lucide-react v1 removed the brand icons (Facebook, Instagram, Youtube, …),
 * which turns a typo or a removed export into a confusing build error.
 * This catches it in one second instead.
 *
 *   node scripts/checkIcons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const lucide = require("lucide-react");

const SRC_DIR = path.join(process.cwd(), "src");

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.jsx?$/.test(entry.name)) files.push(full);
  }
})(SRC_DIR);

const missing = new Map();

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const re = /import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']/g;

  let match;
  while ((match = re.exec(src)) !== null) {
    for (const raw of match[1].split(",")) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (!name) continue;

      if (!(name in lucide)) {
        if (!missing.has(name)) missing.set(name, new Set());
        missing.get(name).add(path.relative(process.cwd(), file));
      }
    }
  }
}

if (missing.size === 0) {
  console.log(`PASS - all lucide imports resolve (${files.length} files checked)`);
} else {
  console.log("FAIL - missing icons:");
  for (const [name, where] of missing) {
    console.log(`  ${name}  <-  ${[...where].join(", ")}`);
  }
  process.exit(1);
}
