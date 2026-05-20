#!/usr/bin/env node

import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_URL = "https://www.draftsharks.com/rankings/ppr-superflex";
const PUBLIC_ROW_LIMIT = 26;

const url = process.argv[2] || DEFAULT_URL;
const cdpUrl = process.env.DRAFTSHARKS_CHROME_CDP_URL || "http://127.0.0.1:9222";
const userDataDir =
  process.env.DRAFTSHARKS_BROWSER_PROFILE ||
  path.join(os.tmpdir(), "keeper-optimizer-draftsharks-browser-profile");
const headless = process.env.DRAFTSHARKS_HEADLESS === "1";
const timeoutMs = Number(process.env.DRAFTSHARKS_SCRAPER_TIMEOUT_MS || 90000);

const startedAt = Date.now();

function emit(payload, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exit(exitCode);
}

function timedOut() {
  return Date.now() - startedAt > timeoutMs;
}

async function connectBrowser() {
  try {
    const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 2500 });
    const context = browser.contexts()[0] || (await browser.newContext());
    const page = context.pages()[0] || (await context.newPage());
    return {
      browser,
      context,
      page,
      mode: "cdp",
      close: async () => browser.close(),
    };
  } catch {
    await mkdir(userDataDir, { recursive: true });
    const executablePath = process.env.DRAFTSHARKS_CHROME_PATH;
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: executablePath ? undefined : "chrome",
      executablePath,
      headless,
      viewport: { width: 1440, height: 1200 },
      args: ["--disable-blink-features=AutomationControlled"],
    });
    const page = context.pages()[0] || (await context.newPage());
    return {
      browser: null,
      context,
      page,
      mode: "persistent",
      close: async () => context.close(),
    };
  }
}

function normalizeRow(row) {
  const player = String(row.player || "").replace(/\s+/g, " ").trim();
  const position = String(row.position || "").replace(/^DEF$/, "DST").trim().toUpperCase();
  const nflTeam = String(row.nfl_team || "").trim().toUpperCase();
  const adp = Number(row.adp_pick);
  if (!player || !position || !Number.isFinite(adp) || adp <= 0) {
    return null;
  }
  return {
    player,
    position,
    nfl_team: nflTeam || null,
    adp_pick: adp,
  };
}

async function extractVisibleRows(page) {
  return page.evaluate(() => {
    function clean(value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    }

    function parseAdp(row) {
      const adpCell = row.querySelector("td.adp[data-value], [data-value].adp, td.adp");
      const raw = adpCell?.getAttribute("data-value") || adpCell?.textContent || "";
      const value = Number.parseFloat(clean(raw));
      return Number.isFinite(value) ? value : null;
    }

    function parsePosition(row) {
      const attr = row.getAttribute("data-fantasy-position");
      if (attr) return attr;
      const positionRank = clean(row.querySelector(".position-rank")?.textContent || "");
      const match = positionRank.match(/^(QB|RB|WR|TE|K|DEF|DST)/i);
      return match ? match[1] : "";
    }

    function parsePlayer(row) {
      const attr = row.getAttribute("data-player-name");
      if (attr) return attr;
      return (
        row.querySelector("a.hide-on-mobile")?.textContent ||
        row.querySelector(".player-name a")?.textContent ||
        row.querySelector("[data-player-name]")?.getAttribute("data-player-name") ||
        ""
      );
    }

    function parseTeam(row) {
      return (
        row.getAttribute("data-team") ||
        row.querySelector(".team-position-logo-container span")?.textContent ||
        ""
      );
    }

    const rowNodes = [
      ...document.querySelectorAll("tbody tr[data-player-row], tr[data-player-row], tr.player-row"),
    ];
    return rowNodes
      .map((row) => ({
        player: clean(parsePlayer(row)),
        position: clean(parsePosition(row)).toUpperCase(),
        nfl_team: clean(parseTeam(row)).toUpperCase(),
        adp_pick: parseAdp(row),
      }))
      .filter((row) => row.player && row.position && row.adp_pick !== null);
  });
}

async function scrollPage(page) {
  await page.evaluate(() => {
    const scrollingElement = document.scrollingElement || document.documentElement;
    const scrollables = [scrollingElement, ...document.querySelectorAll("*")].filter((element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      return (
        element.scrollHeight > element.clientHeight + 100 &&
        ["auto", "scroll"].includes(style.overflowY)
      );
    });

    for (const element of scrollables) {
      element.scrollTop = Math.min(element.scrollTop + Math.max(600, element.clientHeight * 0.85), element.scrollHeight);
    }
    window.scrollBy(0, Math.max(700, window.innerHeight * 0.85));
  });
}

async function scrape() {
  const session = await connectBrowser();
  const { page, mode } = session;
  const rowsByKey = new Map();
  const warnings = [];

  try {
    page.setDefaultTimeout(15000);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {
      warnings.push("networkidle timeout");
    });
    await page.waitForSelector("tr.player-row, tr[data-player-row]", { timeout: 30000 });

    let stablePasses = 0;
    let previousCount = 0;

    while (stablePasses < 8 && !timedOut()) {
      const visibleRows = await extractVisibleRows(page);
      for (const rawRow of visibleRows) {
        const row = normalizeRow(rawRow);
        if (!row) continue;
        rowsByKey.set(`${row.player.toLowerCase()}|${row.position}`, row);
      }

      const rowCount = rowsByKey.size;
      stablePasses = rowCount > previousCount ? 0 : stablePasses + 1;
      previousCount = rowCount;

      await scrollPage(page);
      await page.waitForTimeout(stablePasses === 0 ? 650 : 1000);
    }

    const rows = [...rowsByKey.values()].sort((a, b) => a.adp_pick - b.adp_pick || a.player.localeCompare(b.player));
    const payload = {
      source_url: url,
      browser_mode: mode,
      row_count: rows.length,
      rows,
      warnings,
    };

    if (rows.length <= PUBLIC_ROW_LIMIT) {
      emit(
        {
          ...payload,
          error: `DraftSharks browser scrape only found ${rows.length} rows, which looks like the truncated public response`,
        },
        2,
      );
    }

    emit(payload);
  } finally {
    await session.close();
  }
}

if (!existsSync(path.join(process.cwd(), "node_modules", "playwright"))) {
  emit({ error: "Playwright is not installed. Run `npm install` from the repo root." }, 1);
}

scrape().catch((error) => {
  emit(
    {
      source_url: url,
      row_count: 0,
      rows: [],
      error: error instanceof Error ? error.message : String(error),
    },
    1,
  );
});
