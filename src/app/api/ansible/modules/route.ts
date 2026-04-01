import { NextResponse } from "next/server";
import { spawn } from "child_process";

const ANSIBLE_DOC = "/home/z/.local/bin/ansible-doc";
const HOME = "/home/z";

interface ModuleEntry {
  name: string;
  collection: string;
  shortName: string;
}

interface CollectionInfo {
  name: string;
  count: number;
}

interface CachedModules {
  modules: ModuleEntry[];
  collections: CollectionInfo[];
  total: number;
  timestamp: number;
}

// In-memory cache to avoid re-running ansible-doc on every request
let moduleCache: CachedModules | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function parseModules(stdout: string): { modules: ModuleEntry[]; collections: CollectionInfo[] } {
  const lines = stdout.split("\n");
  const modules: ModuleEntry[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("[WARNING]")) continue;

    // Module name is everything before 2+ whitespace, path after
    const spaceIdx = trimmed.search(/\s{2,}/);
    if (spaceIdx <= 0) continue;

    const fullName = trimmed.substring(0, spaceIdx);

    // Must contain at least one dot (collection.module format)
    if (!fullName.includes(".")) continue;

    // Deduplicate
    if (seen.has(fullName)) continue;
    seen.add(fullName);

    const dotIndex = fullName.lastIndexOf(".");
    const collection = fullName.substring(0, dotIndex > 0 ? dotIndex : fullName.length);
    const shortName = fullName.substring(dotIndex + 1);

    modules.push({ name: fullName, collection, shortName });
  }

  // Group by collection
  const collectionMap = new Map<string, number>();
  for (const m of modules) {
    collectionMap.set(m.collection, (collectionMap.get(m.collection) || 0) + 1);
  }

  // Sort collections by count descending
  const collections = [...collectionMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  return { modules, collections };
}

function loadModules(): Promise<CachedModules> {
  // Return cached data if still valid
  if (moduleCache && Date.now() - moduleCache.timestamp < CACHE_TTL) {
    return Promise.resolve(moduleCache);
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(ANSIBLE_DOC, ["-F"], {
      cwd: process.cwd(),
      env: { ...process.env, HOME, PATH: process.env.PATH },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0 && stdout) {
        const { modules, collections } = parseModules(stdout);
        moduleCache = {
          modules,
          collections,
          total: modules.length,
          timestamp: Date.now(),
        };
        resolve(moduleCache);
      } else {
        reject(new Error(`Failed to list modules (exit ${code}): ${stderr.substring(0, 500)}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

export async function GET() {
  try {
    const data = await loadModules();
    return NextResponse.json({
      modules: data.modules,
      total: data.total,
      collections: data.collections,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
