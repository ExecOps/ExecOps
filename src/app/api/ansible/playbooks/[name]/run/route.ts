import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import path from "path";

const PLAYBOOKS_DIR = path.join(process.cwd(), "ansible", "playbooks");
const EXECUTIONS_DIR = path.join(process.cwd(), "ansible", "executions");
const ANSIBLE_PLAYBOOK = "/home/z/.local/bin/ansible-playbook";
const HOME = "/home/z";
const INVENTORY = path.join(process.cwd(), "ansible", "inventory.ini");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const filePath = path.join(PLAYBOOKS_DIR, name);
  const relative = path.relative(PLAYBOOKS_DIR, filePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return NextResponse.json({ error: "Invalid playbook name" }, { status: 400 });
  }

  try {
    await fs.access(filePath);

    const id = randomUUID();
    const startTime = Date.now();
    const logPath = path.join(EXECUTIONS_DIR, `${id}.log`);
    const metaPath = path.join(EXECUTIONS_DIR, `${id}.json`);

    await fs.mkdir(EXECUTIONS_DIR, { recursive: true });

    // Save initial execution metadata
    const meta = {
      id,
      playbook: name,
      status: "running",
      startTime,
      endTime: null,
      duration: null,
      exitCode: null,
    };
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");

    // Stream output
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const logLines: string[] = [];

        const proc = spawn(
          ANSIBLE_PLAYBOOK,
          ["-i", INVENTORY, filePath],
          {
            cwd: process.cwd(),
            env: { ...process.env, HOME, PATH: process.env.PATH },
            stdio: ["pipe", "pipe", "pipe"],
          }
        );

        proc.stdout.on("data", (data: Buffer) => {
          const text = data.toString();
          logLines.push(text);
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "stdout", text })}\n\n`)
            );
          } catch { /* stream might be closed */ }
        });

        proc.stderr.on("data", (data: Buffer) => {
          const text = data.toString();
          logLines.push(text);
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "stderr", text })}\n\n`)
            );
          } catch { /* stream might be closed */ }
        });

        proc.on("close", async (code) => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          const status = code === 0 ? "success" : "failed";

          // Save log file
          await fs.writeFile(logPath, logLines.join(""), "utf-8");

          // Update execution metadata
          const finalMeta = {
            ...meta,
            status,
            exitCode: code,
            endTime,
            duration,
          };
          await fs.writeFile(metaPath, JSON.stringify(finalMeta, null, 2), "utf-8");

          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "complete", status, exitCode: code, duration })}\n\n`)
            );
            controller.close();
          } catch { /* stream might be closed */ }
        });

        proc.on("error", async (err) => {
          const endTime = Date.now();
          logLines.push(`Error: ${err.message}`);

          await fs.writeFile(logPath, logLines.join(""), "utf-8");

          const finalMeta = {
            ...meta,
            status: "failed",
            exitCode: -1,
            endTime,
            duration: endTime - startTime,
          };
          await fs.writeFile(metaPath, JSON.stringify(finalMeta, null, 2), "utf-8");

          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "complete", status: "failed", exitCode: -1, duration: endTime - startTime })}\n\n`)
            );
            controller.close();
          } catch { /* stream might be closed */ }
        });

        // Handle abort
        request.signal.addEventListener("abort", () => {
          proc.kill("SIGTERM");
          try { controller.close(); } catch { /* noop */ }
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to execute playbook" }, { status: 500 });
  }
}
