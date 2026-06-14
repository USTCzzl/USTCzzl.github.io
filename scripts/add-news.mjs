#!/usr/bin/env node
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const NEWS_PATH = path.join(ROOT_DIR, "assets", "data", "news.json");
const SYNC_SCRIPT = path.join(SCRIPT_DIR, "sync-dblp.mjs");

function readArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      continue;
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = "true";
      continue;
    }
    result[key] = next;
    index += 1;
  }
  return result;
}

function slugify(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72) || "news";
}

async function readNews() {
  if (!existsSync(NEWS_PATH)) {
    return [];
  }
  return JSON.parse(await fs.readFile(NEWS_PATH, "utf8"));
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  const person = args.person || args.author;
  const role = args.role || "first author";
  const paperTitle = args.title || args.paper;
  const venue = args.venue || args.conference || args.journal;
  const date = args.date || new Date().toISOString().slice(0, 10);
  const link = args.link || args.url || "";

  if (!person || !paperTitle || !venue) {
    console.error("Usage: node scripts/add-news.mjs --person \"Name\" --role \"first author\" --title \"Paper title\" --venue \"ICRA 2026\" [--date 2026-06-13] [--link URL]");
    process.exit(1);
  }

  const news = await readNews();
  const item = {
    id: `news-${date}-${slugify(`${person}-${paperTitle}`)}`,
    date,
    title: `Congratulations to ${person} (${role}) on having the paper "${paperTitle}" accepted by ${venue}.`,
    summary: args.summary || `${paperTitle} has been accepted by ${venue}.`,
    links: link ? [{ label: args["link-label"] || "Paper", url: link }] : []
  };

  const filtered = news.filter((entry) => entry.id !== item.id);
  await fs.mkdir(path.dirname(NEWS_PATH), { recursive: true });
  await fs.writeFile(NEWS_PATH, `${JSON.stringify([item, ...filtered], null, 2)}\n`, "utf8");

  const sync = spawnSync(process.execPath, [SYNC_SCRIPT, "--local-only"], {
    cwd: ROOT_DIR,
    stdio: "inherit"
  });

  process.exit(sync.status || 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
