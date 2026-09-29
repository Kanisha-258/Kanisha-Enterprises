/**
 * Removes unused named imports reported by eslint's no-unused-vars rule.
 * Only touches import specifier lists — never reorders or reformats code.
 *
 *   node scripts/pruneUnusedImports.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] || path.join(process.cwd(), "src");
const REPORT = process.argv[3];

if (!REPORT || !fs.existsSync(REPORT)) {
  console.error("Usage: node scripts/pruneUnusedImports.mjs <srcDir> <lint.json>");
  process.exit(1);
}

const raw = fs.readFileSync(REPORT, "utf8");
const report = JSON.parse(raw.slice(raw.indexOf("[")));

// filePath -> Set of unused binding names
const byFile = new Map();

for (const entry of report) {
  for (const msg of entry.messages) {
    if (msg.ruleId !== "no-unused-vars") continue;
    const m = /'([^']+)' is defined but never used/.exec(msg.message);
    if (!m) continue;

    if (!byFile.has(entry.filePath)) byFile.set(entry.filePath, new Set());
    byFile.get(entry.filePath).add(m[1]);
  }
}

let totalFixed = 0;

for (const [file, names] of byFile) {
  let src = fs.readFileSync(file, "utf8");
  const before = src;

  for (const name of names) {
    // Single-line:  import { A, B, C } from "x";
    const single = new RegExp(`(import\\s*\\{)([^}]*)(\\}\\s*from\\s*["'][^"']+["'];?)`);

    src = src.replace(single, (whole, open, inner, close) => {
      const parts = inner
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const kept = parts.filter((p) => {
        const local = p.split(/\s+as\s+/).pop().trim();
        return local !== name;
      });

      if (kept.length === 0) {
        // The whole import becomes empty — drop the entire line.
        return "\u0000DROP\u0000";
      }

      const oneLine = `${open} ${kept.join(", ")} ${close}`;
      return oneLine.length <= 90 ? oneLine : `${open}\n  ${kept.join(",\n  ")},\n${close}`;
    });
  }

  // Remove any import lines that lost every specifier.
  src = src
    .split("\n")
    .filter((line) => !line.includes("\u0000DROP\u0000"))
    .join("\n");

  // Collapse the blank gap left behind by a removed import.
  src = src.replace(/^\n{3,}/gm, "\n\n");

  if (src !== before) {
    fs.writeFileSync(file, src);
    const removed = names.size;
    totalFixed += removed;
    console.log(`cleaned ${removed} unused import(s): ${path.relative(process.cwd(), file)}`);
  }
}

console.log(`\nTotal removed: ${totalFixed}`);
