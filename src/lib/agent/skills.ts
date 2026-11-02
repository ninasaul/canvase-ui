import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Filesystem-backed skills for the canvas agent (progressive disclosure):
 *   skills/<skill-id>/SKILL.md      — YAML frontmatter + instructions
 *   skills/<skill-id>/references/*  — optional resources, read on demand
 *
 * Only the summary catalog is injected into the prompt; full text is fetched
 * by the `skills_read` tool so big skill packs cost nothing until used.
 */

const SKILL_FILE = "SKILL.md";
const MAX_SKILLS = 200;
const MAX_SKILL_BYTES = 256 * 1024;
const MAX_RESOURCE_BYTES = 256 * 1024;
const MAX_RESOURCE_FILES = 100;
const CACHE_TTL_MS = 5_000;

const SKILL_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const TEXT_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".csv",
]);

export type CanvasSkill = {
  /** Folder name; stable identifier used by `skills_read`. */
  id: string;
  name: string;
  description: string;
  tags: string[];
  /** Absolute directory, never exposed to clients. */
  dir: string;
};

export type CanvasSkillDetail = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  content: string;
  files: string[];
};

export function getSkillsDir(): string {
  const configured = (process.env.CANVASE_SKILLS_DIR ?? "").trim();
  return configured ? path.resolve(configured) : path.join(process.cwd(), "skills");
}

function isInside(base: string, target: string): boolean {
  const relative = path.relative(base, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function readTextFile(filePath: string, maxBytes: number): Promise<string> {
  const stat = await fs.stat(filePath);
  if (!stat.isFile() || stat.size > maxBytes) {
    throw new Error("Skill file is missing or too large");
  }
  return fs.readFile(filePath, "utf8");
}

/** Minimal YAML frontmatter parser: `key: value` plus indented continuations. */
export function parseSkillFrontmatter(raw: string): {
  data: Record<string, string>;
  body: string;
} {
  const normalized = raw.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---")) {
    return { data: {}, body: normalized };
  }
  const closing = normalized.indexOf("\n---", 3);
  if (closing === -1) {
    return { data: {}, body: normalized };
  }
  const block = normalized.slice(3, closing);
  const body = normalized.slice(closing + 4).replace(/^\r?\n/, "");

  const data: Record<string, string> = {};
  let currentKey = "";
  for (const line of block.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (match) {
      currentKey = match[1]!;
      data[currentKey] = match[2]!.trim();
      continue;
    }
    if (currentKey) {
      data[currentKey] = `${data[currentKey]} ${line.trim()}`.trim();
    }
  }

  for (const key of Object.keys(data)) {
    const value = data[key]!.trim();
    // Drop block scalar markers and surrounding quotes.
    const cleaned = value.replace(/^[|>][+-]?\s*/, "").trim();
    data[key] =
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))
        ? cleaned.slice(1, -1)
        : cleaned;
  }
  return { data, body };
}

function parseTags(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean)
    .slice(0, 12);
}

function firstParagraph(body: string): string {
  for (const block of body.split(/\n\s*\n/)) {
    const text = block
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("#"))
      .join(" ")
      .trim();
    if (text) {
      return text.slice(0, 240);
    }
  }
  return "";
}

let cache: { dir: string; at: number; skills: CanvasSkill[] } | null = null;

export async function listSkills(): Promise<CanvasSkill[]> {
  const dir = getSkillsDir();
  if (cache && cache.dir === dir && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.skills;
  }

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    cache = { dir, at: Date.now(), skills: [] };
    return [];
  }

  const skills: CanvasSkill[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }
    if (!SKILL_ID_RE.test(entry.name)) {
      continue;
    }
    const skillDir = path.join(dir, entry.name);
    let raw: string;
    try {
      raw = await readTextFile(path.join(skillDir, SKILL_FILE), MAX_SKILL_BYTES);
    } catch {
      continue;
    }
    const { data, body } = parseSkillFrontmatter(raw);
    skills.push({
      id: entry.name,
      name: data.name?.trim() || entry.name,
      description: data.description?.trim() || firstParagraph(body),
      tags: parseTags(data.tags),
      dir: skillDir,
    });
    if (skills.length >= MAX_SKILLS) {
      break;
    }
  }

  skills.sort((left, right) => left.id.localeCompare(right.id));
  cache = { dir, at: Date.now(), skills };
  return skills;
}

async function listSkillFiles(skillDir: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (current: string, depth: number): Promise<void> => {
    if (files.length >= MAX_RESOURCE_FILES || depth > 2) {
      return;
    }
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= MAX_RESOURCE_FILES || entry.name.startsWith(".")) {
        continue;
      }
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute, depth + 1);
        continue;
      }
      const relative = path.relative(skillDir, absolute);
      if (entry.name === SKILL_FILE && current === skillDir) {
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      if (!TEXT_EXTENSIONS.has(extension) && extension !== "") {
        continue;
      }
      files.push(relative.split(path.sep).join("/"));
    }
  };
  await walk(skillDir, 0);
  return files.sort();
}

export async function readSkill(input: {
  name: string;
  file?: string;
}): Promise<CanvasSkillDetail> {
  const id = input.name.trim().toLowerCase();
  if (!SKILL_ID_RE.test(id)) {
    throw new Error("Invalid skill name");
  }

  const skills = await listSkills();
  const skill = skills.find((item) => item.id === id);
  if (!skill) {
    throw new Error(`Unknown skill: ${input.name}`);
  }

  const realBase = await fs.realpath(getSkillsDir());
  const realSkillDir = await fs.realpath(skill.dir);
  if (!isInside(realBase, realSkillDir)) {
    throw new Error("Invalid skill path");
  }

  const requested = input.file?.trim();
  if (requested) {
    if (path.isAbsolute(requested) || requested.split(/[\\/]/).includes("..")) {
      throw new Error("Invalid skill file path");
    }
    const extension = path.extname(requested).toLowerCase();
    if (extension && !TEXT_EXTENSIONS.has(extension)) {
      throw new Error("Unsupported skill file type");
    }
    const target = path.resolve(realSkillDir, requested);
    if (!isInside(realSkillDir, target)) {
      throw new Error("Invalid skill file path");
    }
    const realTarget = await fs.realpath(target).catch(() => {
      throw new Error(`Skill file not found: ${requested}`);
    });
    if (!isInside(realSkillDir, realTarget)) {
      throw new Error("Invalid skill file path");
    }
    const content = await readTextFile(realTarget, MAX_RESOURCE_BYTES);
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      tags: skill.tags,
      content,
      files: [requested],
    };
  }

  const raw = await readTextFile(
    path.join(realSkillDir, SKILL_FILE),
    MAX_SKILL_BYTES,
  );
  const { body } = parseSkillFrontmatter(raw);
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    tags: skill.tags,
    content: body.trim(),
    files: await listSkillFiles(realSkillDir),
  };
}

/** Compact catalog for the system prompt (name + description only). */
export async function loadSkillCatalog(): Promise<CanvasSkill[]> {
  return listSkills();
}

export function testHooks() {
  return { cache, reset: () => void (cache = null) };
}
