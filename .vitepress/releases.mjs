import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "Nerdy-Technician/JellyGlance";
const API_URL = `https://api.github.com/repos/${REPO}/releases`;
const ATOM_URL = `https://github.com/${REPO}/releases.atom`;
const RELEASES_URL = `https://github.com/${REPO}/releases`;
const USER_AGENT = "JellyGlance-docs";
const REQUEST_TIMEOUT_MS = 8000;

const configDir = dirname(fileURLToPath(import.meta.url));
// The site's own package.json version is only used for the local offline
// fallback below; real release data always comes from GitHub.
const repoRoot = resolve(configDir, "..");
const rootPackage = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
const packageVersion = String(rootPackage.version || "").replace(/-.+$/, "") || "0.0.0";


function githubToken() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
}

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": USER_AGENT
  };
  const token = githubToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function decodeEntities(value = "") {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripTags(value = "") {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseVersion(value = "") {
  const raw = String(value).trim().replace(/^v/i, "");
  const [core = "0.0.0", pre = ""] = raw.split("-");
  const [major = 0, minor = 0, patch = 0] = core.split(".").map((part) => Number.parseInt(part, 10) || 0);
  return { raw, major, minor, patch, pre, tagged: `v${raw}` };
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (!a.pre && b.pre) return 1;
  if (a.pre && !b.pre) return -1;
  return a.pre.localeCompare(b.pre, undefined, { numeric: true });
}

function isPrereleaseTag(value = "") {
  return Boolean(parseVersion(value).pre);
}

function normalizeRelease(entry) {
  const version = String(entry.version || "").trim();
  if (!version) return null;
  const tagged = version.startsWith("v") ? version : `v${version}`;
  const body = entry.body || "";
  return {
    version: tagged,
    name: entry.name || `JellyGlance ${tagged}`,
    url: entry.url || `${RELEASES_URL}/tag/${tagged}`,
    publishedAt: entry.publishedAt || null,
    body,
    prerelease: Boolean(entry.prerelease || isPrereleaseTag(tagged)),
    sections: parseReleaseNotes(body)
  };
}

function parseMarkdownNotes(body = "") {
  const sections = [];
  let current = { title: "Notes", items: [] };

  body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const heading = line.match(/^#{1,4}\s+(.+)/);
      if (heading) {
        if (current.items.length) sections.push(current);
        current = { title: heading[1].replace(/[*_`]/g, ""), items: [] };
        return;
      }

      const table = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/);
      if (table && !/^\s*:?-+:?\s*$/.test(table[1])) {
        const label = table[1].replace(/[*_`]/g, "").trim();
        const detail = table[2].replace(/[*_`]/g, "").trim();
        if (label && detail) current.items.push(`${label} — ${detail}`);
        return;
      }

      const item = line.replace(/^[-*]\s+/, "").replace(/^`([^`]+)`$/, "$1");
      if (item && item !== line) current.items.push(item);
    });

  if (current.items.length) sections.push(current);
  return sections.slice(0, 8).map((section) => ({
    title: section.title,
    items: section.items.slice(0, 12)
  }));
}

function parseHtmlNotes(html = "") {
  const sections = [];
  const parts = html.split(/<h2\b[^>]*>/i).slice(1);

  for (const part of parts) {
    const titleMatch = part.match(/^([\s\S]*?)<\/h2>/i);
    if (!titleMatch) continue;
    const title = stripTags(titleMatch[1]);
    if (!title) continue;
    const rest = part.slice(titleMatch[0].length);
    const items = [];

    for (const row of rest.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)) {
      const cells = [...row[0].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((cell) => stripTags(cell[1]))
        .filter(Boolean);
      if (cells.length >= 2) items.push(`${cells[0]} — ${cells[1]}`);
      else if (cells.length === 1) items.push(cells[0]);
    }

    for (const item of rest.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
      const text = stripTags(item[1]);
      if (text) items.push(text);
    }

    if (items.length) sections.push({ title, items: items.slice(0, 12) });
  }

  return sections.slice(0, 8);
}

export function parseReleaseNotes(body = "") {
  const decoded = decodeEntities(body);
  const markdown = parseMarkdownNotes(decoded);
  const html = /<[a-z][\s\S]*>/i.test(decoded) ? parseHtmlNotes(decoded) : [];
  return html.length > markdown.length ? html : markdown;
}

function pickStable(releases) {
  return releases
    .filter((release) => !release.prerelease)
    .sort((left, right) => compareVersions(right.version, left.version))[0] || null;
}

function pickNewerBeta(releases, stable) {
  return releases
    .filter((release) => release.prerelease)
    .filter((release) => !stable || compareVersions(release.version, stable.version) > 0)
    .sort((left, right) => compareVersions(right.version, left.version))[0] || null;
}

function emptyBeta() {
  return {
    version: "",
    name: "",
    url: RELEASES_URL,
    publishedAt: null,
    body: "",
    prerelease: true,
    sections: []
  };
}

function offlineFallbackPair() {
  const stable = normalizeRelease({
    version: `v${packageVersion}`,
    name: `JellyGlance v${packageVersion}`,
    url: `${RELEASES_URL}/latest`,
    body: "Release notes are loaded from the latest GitHub release when the site is built."
  });
  return { latestRelease: stable, latestBetaRelease: emptyBeta() };
}

async function fetchApiReleases() {
  const response = await fetch(API_URL, {
    headers: githubHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`GitHub releases request failed: ${response.status}`);
  }
  const releases = await response.json();
  return releases
    .filter((entry) => !entry.draft)
    .map((entry) =>
      normalizeRelease({
        version: entry.tag_name,
        name: entry.name || entry.tag_name,
        url: entry.html_url,
        publishedAt: entry.published_at || entry.created_at || null,
        body: entry.body || "",
        prerelease: Boolean(entry.prerelease)
      })
    )
    .filter(Boolean);
}

async function fetchAtomReleases() {
  const response = await fetch(ATOM_URL, {
    headers: { Accept: "application/atom+xml", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`GitHub releases feed failed: ${response.status}`);
  }

  const xml = await response.text();
  const entries = [];
  const blocks = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

  for (const block of blocks) {
    const id = block.match(/<id>([^<]+)<\/id>/)?.[1] || "";
    const title = stripTags(block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] || "");
    const url = block.match(/<link[^>]+href="([^"]+)"/)?.[1] || "";
    const updated = block.match(/<updated>([^<]+)<\/updated>/)?.[1] || null;
    const content = decodeEntities(block.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] || "");
    const tag = id.match(/\/(v?\d[\w.-]*)$/)?.[1] || url.match(/\/tag\/(v?[\d][\w.-]*)/)?.[1];
    if (!tag) continue;
    entries.push(
      normalizeRelease({
        version: tag,
        name: title || `JellyGlance ${tag}`,
        url: url || `${RELEASES_URL}/tag/${tag}`,
        publishedAt: updated,
        body: content,
        prerelease: isPrereleaseTag(tag)
      })
    );
  }

  if (!entries.length) {
    throw new Error("GitHub releases feed had no entries");
  }

  return entries;
}

function pairFromList(releases) {
  const stable = pickStable(releases);
  const beta = pickNewerBeta(releases, stable);
  if (!stable) throw new Error("no stable release found");
  return {
    latestRelease: stable,
    latestBetaRelease: beta || emptyBeta()
  };
}

function isCI() {
  return Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
}

export async function getDocsReleases() {
  const errors = [];

  try {
    return pairFromList(await fetchApiReleases());
  } catch (error) {
    errors.push(`API: ${error.message}`);
    console.warn(`[docs] GitHub releases API failed, trying public feed: ${error.message}`);
  }

  try {
    return pairFromList(await fetchAtomReleases());
  } catch (error) {
    errors.push(`feed: ${error.message}`);
    console.warn(`[docs] GitHub releases feed failed: ${error.message}`);
  }

  if (isCI()) {
    // Fail the deploy rather than publish a stale version; the last good
    // deploy stays live until GitHub answers again.
    throw new Error(
      `[docs] Could not load JellyGlance releases from GitHub (${errors.join("; ")}). ` +
        "Failing the build so the last good deploy stays up. Re-run the workflow once GitHub is reachable."
    );
  }

  console.warn(`[docs] Using offline fallback v${packageVersion}. This is a local build only; CI would fail here.`);
  return offlineFallbackPair();
}
