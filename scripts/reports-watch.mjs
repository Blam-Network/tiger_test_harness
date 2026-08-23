#!/usr/bin/env node
/**
 * Watch Xenia Destiny report folders and tail a configured log file,
 * filtering by level / category.
 *
 * Config: reports_watch.json (gitignored). See reports_watch.example.json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "reports_watch.json");
const EXAMPLE_PATH = path.join(ROOT, "reports_watch.example.json");

const KNOWN_LEVELS = [
  "verbose",
  "status",
  "message",
  "warning",
  "error",
  "critical",
];

const LEVEL_COLOR = {
  verbose: "\x1b[90m",
  status: "\x1b[36m",
  message: "\x1b[37m",
  warning: "\x1b[33m",
  error: "\x1b[31m",
  critical: "\x1b[35m",
};
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

/** Hardcoded substrings — if any appear in a line, skip console output. */
const IGNORED_LOG_SUBSTRINGS = [
  "defrag:tag",
  "resourcer:callbacks",
  "defrag:gpu",
];

/** Always print these, even when the configured level filter would drop them. */
const ALWAYS_PRINT_SUBSTRINGS = [
  "world_controller:state_manager: Entering state",
];

/** @typedef {{ reportsDir: string, logFile?: string, levels?: string[], categories?: string[] }} ReportsWatchConfig */

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(
      `[reports] missing ${path.basename(CONFIG_PATH)} — copy ${path.basename(EXAMPLE_PATH)} and set reportsDir`
    );
    process.exit(1);
  }
  /** @type {ReportsWatchConfig} */
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const reportsDir = path.resolve(raw.reportsDir ?? "");
  if (!(raw.reportsDir && fs.existsSync(reportsDir))) {
    console.error(
      `[reports] reportsDir not found: ${raw.reportsDir ?? "(unset)"}`
    );
    process.exit(1);
  }
  const levels = (raw.levels?.length ? raw.levels : ["error", "critical"]).map(
    (l) => l.toLowerCase()
  );
  const categories = raw.categories?.length ? raw.categories : ["*"];
  return {
    reportsDir,
    logFile: raw.logFile?.trim() || "debug_full.txt",
    levels,
    categories,
  };
}

/**
 * Destiny debug_full line:
 *   MM/DD/YYYY HH:MM:SS.mmm gXXXXXXXX XXXXXXXX LEVEL____ category:path: message
 */
function parseLine(line) {
  const m = line.match(
    /^(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}\.\d{3})\s+\S+\s+\S+\s+(\w+)\s+(.+)$/
  );
  if (!m) {
    return null;
  }
  const level = m[2].toLowerCase();
  if (!KNOWN_LEVELS.includes(level)) {
    return null;
  }
  const rest = m[3];
  const catMatch = rest.match(/^((?:[\w.-]+)(?::[\w.-]+)*)(?::\s|\s)(.*)$/);
  const category = catMatch ? catMatch[1] : (rest.split(/\s/, 1)[0] ?? "");
  const message = catMatch ? catMatch[2] : rest;
  return {
    time: m[1],
    level,
    category,
    message,
    raw: line,
  };
}

function categoryAllowed(category, filters) {
  if (!filters.length || filters.includes("*")) {
    return true;
  }
  const cat = category.toLowerCase();
  return filters.some((f) => {
    const needle = f.toLowerCase();
    return (
      cat === needle || cat.startsWith(`${needle}:`) || cat.startsWith(needle)
    );
  });
}

function listSessionDirs(reportsDir) {
  return fs
    .readdirSync(reportsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      name: d.name,
      full: path.join(reportsDir, d.name),
      mtime: fs.statSync(path.join(reportsDir, d.name)).mtimeMs,
    }))
    .sort((a, b) => a.mtime - b.mtime);
}

function newestSession(reportsDir) {
  const dirs = listSessionDirs(reportsDir);
  return dirs.length ? dirs.at(-1) : null;
}

class LogTailer {
  /**
   * @param {ReturnType<typeof loadConfig>} config
   */
  constructor(config) {
    this.config = config;
    this.sessionName = null;
    this.filePath = null;
    this.offset = 0;
    this.watcher = null;
    this.pollTimer = null;
    this.pending = "";
    this.dirWatchers = new Set();
  }

  logMeta(msg) {
    console.log(`${DIM}[reports]${RESET} ${msg}`);
  }

  printEntry(entry) {
    const color = LEVEL_COLOR[entry.level] ?? "";
    const lvl = entry.level.padEnd(8);
    console.log(
      `${DIM}${entry.time}${RESET} ${color}${BOLD}${lvl}${RESET} ${DIM}${entry.category}${RESET} ${entry.message}`
    );
  }

  handleChunk(text) {
    this.pending += text;
    const parts = this.pending.split(/\r?\n/);
    this.pending = parts.pop() ?? "";
    for (const line of parts) {
      if (!line.trim()) {
        continue;
      }
      const entry = parseLine(line);
      if (!entry) {
        continue;
      }
      if (IGNORED_LOG_SUBSTRINGS.some((s) => line.includes(s))) {
        continue;
      }
      const alwaysPrint = ALWAYS_PRINT_SUBSTRINGS.some((s) => line.includes(s));
      if (!(alwaysPrint || this.config.levels.includes(entry.level))) {
        continue;
      }
      if (
        !(
          alwaysPrint || categoryAllowed(entry.category, this.config.categories)
        )
      ) {
        continue;
      }
      this.printEntry(entry);
    }
  }

  async readNew() {
    if (!this.filePath) {
      return;
    }
    let st;
    try {
      st = fs.statSync(this.filePath);
    } catch {
      return;
    }
    if (st.size < this.offset) {
      // truncated / rotated
      this.offset = 0;
    }
    if (st.size === this.offset) {
      return;
    }
    const len = st.size - this.offset;
    const fd = fs.openSync(this.filePath, "r");
    try {
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, this.offset);
      this.offset = st.size;
      this.handleChunk(buf.toString("utf8"));
    } finally {
      fs.closeSync(fd);
    }
  }

  stopFileWatch() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * @param {string} sessionName
   * @param {{ fromStart?: boolean }} [opts]
   */
  attachSession(sessionName, opts = {}) {
    const fromStart = opts.fromStart ?? false;
    const sessionDir = path.join(this.config.reportsDir, sessionName);
    const filePath = path.join(sessionDir, this.config.logFile);

    this.stopFileWatch();
    this.sessionName = sessionName;
    this.filePath = filePath;
    this.pending = "";

    this.logMeta(`${BOLD}session${RESET} ${sessionName}`);
    this.logMeta(`watching ${this.config.logFile}`);

    const startTail = () => {
      try {
        const st = fs.statSync(filePath);
        this.offset = fromStart ? 0 : st.size;
      } catch {
        this.offset = 0;
      }
      this.readNew().catch(() => {});

      try {
        this.watcher = fs.watch(filePath, () => {
          this.readNew().catch(() => {});
        });
      } catch {
        // file may appear later
      }
      this.pollTimer = setInterval(() => {
        this.readNew().catch(() => {});
      }, 500);

      // Also watch session dir in case log file is created after the folder.
      try {
        const dw = fs.watch(sessionDir, (event, filename) => {
          if (filename === this.config.logFile || event === "rename") {
            if (!this.watcher && fs.existsSync(filePath)) {
              try {
                this.watcher = fs.watch(filePath, () => {
                  this.readNew().catch(() => {});
                });
              } catch {
                /* ignore */
              }
            }
            this.readNew().catch(() => {});
          }
        });
        this.dirWatchers.add(dw);
      } catch {
        /* ignore */
      }
    };

    if (fs.existsSync(filePath)) {
      startTail();
    } else {
      this.logMeta(`waiting for ${this.config.logFile}…`);
      const wait = fs.watch(sessionDir, (_event, filename) => {
        if (filename === this.config.logFile && fs.existsSync(filePath)) {
          wait.close();
          startTail();
        }
      });
      this.dirWatchers.add(wait);
      // Poll in case watch misses create on Windows
      const iv = setInterval(() => {
        if (fs.existsSync(filePath)) {
          clearInterval(iv);
          try {
            wait.close();
          } catch {
            /* ignore */
          }
          startTail();
        }
      }, 400);
    }
  }

  start() {
    const { reportsDir, logFile, levels, categories } = this.config;
    this.logMeta(`reportsDir ${reportsDir}`);
    this.logMeta(`logFile    ${logFile}`);
    this.logMeta(`levels     ${levels.join(", ")}`);
    this.logMeta(
      `categories ${categories.includes("*") ? "(all)" : categories.join(", ")}`
    );

    const current = newestSession(reportsDir);
    if (current) {
      // Existing session: only follow new lines.
      this.attachSession(current.name, { fromStart: false });
    } else {
      this.logMeta("no sessions yet — waiting for a new report folder");
    }

    let known = new Set(listSessionDirs(reportsDir).map((d) => d.name));

    const onReportsChange = () => {
      const dirs = listSessionDirs(reportsDir);
      for (const d of dirs) {
        if (!known.has(d.name)) {
          known.add(d.name);
          this.attachSession(d.name, { fromStart: true });
        }
      }
      // Refresh known set (don't shrink — folders rarely deleted mid-watch)
      known = new Set([...known, ...dirs.map((d) => d.name)]);
    };

    try {
      fs.watch(reportsDir, { persistent: true }, () => {
        // Debounce: directory events can fire before mkdir finishes.
        setTimeout(onReportsChange, 150);
      });
    } catch (err) {
      console.error(`[reports] failed to watch reportsDir: ${err}`);
      process.exit(1);
    }

    // Periodic scan — Windows fs.watch on directories can miss creates.
    setInterval(onReportsChange, 2000);
  }
}

const config = loadConfig();
const tailer = new LogTailer(config);
tailer.start();
