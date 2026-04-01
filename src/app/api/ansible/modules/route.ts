import { NextResponse } from "next/server";
import { spawn } from "child_process";

const ANSIBLE_DOC = "/home/z/.local/bin/ansible-doc";
const HOME = "/home/z";

interface ModuleEntry {
  name: string;
  collection: string;
  shortName: string;
}

export async function GET() {
  return new Promise((resolve) => {
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
        // Parse: each line is "MODULE_NAME    /path/to/module.py"
        const lines = stdout.split("\n");
        const modules: ModuleEntry[] = [];

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("[WARNING]")) continue;

          // Module name is everything before whitespace, path after
          const parts = trimmed.split(/\s{2,}/);
          if (parts.length >= 1 && parts[0].includes(".")) {
            const fullName = parts[0];
            const dotIndex = fullName.lastIndexOf(".");
            const collection = fullName.substring(0, dotIndex > 0 ? dotIndex : fullName.length);
            const shortName = fullName.includes(".") ? fullName.split(".").pop() || fullName : fullName;

            modules.push({
              name: fullName,
              collection,
              shortName,
            });
          }
        }

        // Group by collection
        const collections = new Map<string, number>();
        for (const m of modules) {
          collections.set(m.collection, (collections.get(m.collection) || 0) + 1);
        }

        // Sort collections by count (most popular first)
        const sortedCollections = [...collections.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count }));

        return resolve(
          NextResponse.json({
            modules: modules.slice(0, 5000), // Limit for performance
            total: modules.length,
            collections: sortedCollections,
          })
        );
      } else {
        return resolve(
          NextResponse.json(
            { error: "Failed to list modules", exitCode: code, stderr: stderr.substring(0, 500) },
            { status: 500 }
          )
        );
      }
    });

    proc.on("error", (err) => {
      resolve(NextResponse.json({ error: err.message }, { status: 500 }));
    });
  });
}
