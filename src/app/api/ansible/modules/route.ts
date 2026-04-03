import { NextResponse } from "next/server";
import { spawn } from "child_process";

const ANSIBLE_DOC = "/home/z/.local/bin/ansible-doc";
const ANSIBLE_GALAXY = "/home/z/.local/bin/ansible-galaxy";
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

// Export cache clearer for install endpoint
export function clearModuleCache() {
  moduleCache = null;
}

// Known valid collection names (namespace.collection format)
// Used to correctly parse modules with sub-namespaces (e.g., hitachivantara.vspone_block.sds_block.module)
function getKnownCollections(): Promise<Set<string>> {
  return new Promise((resolve) => {
    const proc = spawn(ANSIBLE_GALAXY, ["collection", "list"], {
      cwd: process.cwd(),
      env: { ...process.env, HOME, PATH: process.env.PATH },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks: string[] = [];
    proc.stdout.on("data", (data: Buffer) => { stdoutChunks.push(data.toString()); });
    proc.stderr.on("data", () => {});
    proc.on("close", () => {
      const stdout = stdoutChunks.join("");
      const collections = new Set<string>();
      for (const line of stdout.split("\n")) {
        const trimmed = line.trim();
        // Lines look like: "  collection_name    version"
        const match = trimmed.match(/^([a-z][a-z0-9_]+\.[a-z][a-z0-9_]+)\s+/);
        if (match) {
          collections.add(match[1]);
        }
      }
      // Always include ansible.builtin (not shown by galaxy list)
      collections.add("ansible.builtin");
      resolve(collections);
    });
    proc.on("error", () => resolve(new Set(["ansible.builtin"])));
  });
}

function parseModules(stdout: string, knownCollections: Set<string>): { modules: ModuleEntry[]; collections: CollectionInfo[] } {
  const lines = stdout.split("\n");
  const modules: ModuleEntry[] = [];
  const seen = new Set<string>();

  // Build a sorted list of known collections by length (longest first)
  // This ensures "hitachivantara.vspone_block" matches before "hitachivantara"
  const sortedCollections = [...knownCollections].sort((a, b) => b.length - a.length);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("[WARNING]")) continue;

    // Module name is everything before 2+ whitespace
    const spaceIdx = trimmed.search(/\s{2,}/);
    if (spaceIdx <= 0) continue;

    const fullName = trimmed.substring(0, spaceIdx);

    // Must contain at least one dot
    if (!fullName.includes(".")) continue;

    // Deduplicate
    if (seen.has(fullName)) continue;
    seen.add(fullName);

    // Find the correct collection by matching against known collections
    // Try longest match first (e.g., "hitachivantara.vspone_block" before "hitachivantara")
    let collection = "";
    let shortName = "";

    for (const col of sortedCollections) {
      if (fullName.startsWith(col + ".")) {
        collection = col;
        shortName = fullName.substring(col.length + 1);
        break;
      }
    }

    // Fallback to lastIndexOf if no known collection matched
    if (!collection) {
      const dotIndex = fullName.lastIndexOf(".");
      collection = fullName.substring(0, dotIndex > 0 ? dotIndex : fullName.length);
      shortName = fullName.substring(dotIndex + 1);
    }

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

async function loadModules(): Promise<CachedModules> {
  // Return cached data if still valid
  if (moduleCache && Date.now() - moduleCache.timestamp < CACHE_TTL) {
    return moduleCache;
  }

  // Get known collections first, then get modules
  const knownCollections = await getKnownCollections();

  const { modules, collections } = await new Promise<{ modules: ModuleEntry[]; collections: CollectionInfo[] }>((resolve, reject) => {
    const proc = spawn(ANSIBLE_DOC, ["-F"], {
      cwd: process.cwd(),
      env: { ...process.env, HOME, PATH: process.env.PATH },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    proc.stdout.on("data", (data: Buffer) => { stdoutChunks.push(data.toString()); });
    proc.stderr.on("data", (data: Buffer) => { stderrChunks.push(data.toString()); });

    proc.on("close", (code) => {
      const stdout = stdoutChunks.join("");
      const stderr = stderrChunks.join("");
      if (code === 0 && stdout) {
        resolve(parseModules(stdout, knownCollections));
      } else {
        reject(new Error(`Failed to list modules (exit ${code}): ${stderr.substring(0, 500)}`));
      }
    });

    proc.on("error", (err) => { reject(err); });
  });

  moduleCache = {
    modules,
    collections,
    total: modules.length,
    timestamp: Date.now(),
  };

  return moduleCache;
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
