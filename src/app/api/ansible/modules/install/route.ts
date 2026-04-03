import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { clearModuleCache } from "../route";

const ANSIBLE_GALAXY = "/home/z/.local/bin/ansible-galaxy";
const HOME = "/home/z";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collection } = body;

    if (!collection || typeof collection !== "string") {
      return NextResponse.json(
        { error: "Collection name is required (e.g., 'community.general')" },
        { status: 400 }
      );
    }

    // Validate collection name format: namespace.collection
    const validName = /^[a-z][a-z0-9_]+\.[a-z][a-z0-9_]+$/;
    if (!validName.test(collection)) {
      return NextResponse.json(
        { error: "Invalid collection name. Use format: namespace.collection (e.g., community.general)" },
        { status: 400 }
      );
    }

    const result = await new Promise<{ success: boolean; stdout: string; stderr: string }>((resolve, reject) => {
      const proc = spawn(ANSIBLE_GALAXY, ["collection", "install", collection, "--force"], {
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
        resolve({ success: code === 0, stdout, stderr });
      });

      proc.on("error", (err) => { reject(err); });
    });

    if (result.success) {
      // Clear the module cache so next request picks up new modules
      clearModuleCache();

      return NextResponse.json({
        success: true,
        message: `Collection '${collection}' installed successfully`,
        stdout: result.stdout.substring(0, 500),
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to install '${collection}'`,
          stderr: result.stderr.substring(0, 500),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
