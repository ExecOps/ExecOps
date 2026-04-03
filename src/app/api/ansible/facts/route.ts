import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

const ANSIBLE = "/home/z/.local/bin/ansible";
const ANSIBLE_PLAYBOOK_BIN = "/home/z/.local/bin/ansible-playbook";
const HOME = "/home/z";
const INVENTORY = path.join(process.cwd(), "ansible", "inventory.ini");

function parseAnsibleOutput(stdout: string): Record<string, unknown> {
  // Ansible CLI outputs: "localhost | SUCCESS => { ... }"
  const match = stdout.match(/=>\s*(\{[\s\S]*)/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {
      // Try to find just the JSON object
      const jsonStart = stdout.indexOf("{");
      const jsonEnd = stdout.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        try {
          return JSON.parse(stdout.substring(jsonStart, jsonEnd + 1));
        } catch {
          // fall through
        }
      }
    }
  }
  return {};
}

function getAnsibleVersion(): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn(ANSIBLE_PLAYBOOK_BIN, ["--version"], {
      cwd: process.cwd(),
      env: { ...process.env, HOME, PATH: process.env.PATH },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks: string[] = [];
    proc.stdout.on("data", (data: Buffer) => {
      stdoutChunks.push(data.toString());
    });

    proc.on("close", () => {
      const stdout = stdoutChunks.join("");
      const match = stdout.match(/ansible-playbook\s+\[core\s+([\d.]+)/);
      resolve(match ? match[1] : "unknown");
    });

    proc.on("error", () => resolve("unknown"));
  });
}

export async function GET() {
  return new Promise((resolve) => {
    const proc = spawn(
      ANSIBLE,
      ["-i", INVENTORY, "localhost", "-m", "setup"],
      {
        cwd: process.cwd(),
        env: { ...process.env, HOME, PATH: process.env.PATH },
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    proc.stdout.on("data", (data: Buffer) => {
      stdoutChunks.push(data.toString());
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderrChunks.push(data.toString());
    });

    proc.on("close", async (code) => {
      const stdout = stdoutChunks.join("");
      const stderr = stderrChunks.join("");
      if (code === 0 && stdout) {
        try {
          const data = parseAnsibleOutput(stdout);
          const facts = (data.ansible_facts || data) as Record<string, unknown>;
          const version = await getAnsibleVersion();

          return resolve(
            NextResponse.json({
              hostname: facts.ansible_hostname || "unknown",
              distribution: facts.ansible_distribution || "Unknown",
              distribution_version: facts.ansible_distribution_version || "0",
              distribution_release: facts.ansible_distribution_release || "",
              architecture: facts.ansible_architecture || "unknown",
              kernel: facts.ansible_kernel || "unknown",
              os_family: facts.ansible_os_family || "unknown",
              system: facts.ansible_system || "Linux",
              processor_vcpus: facts.ansible_processor_vcpus || 0,
              processor_count: facts.ansible_processor_count || 0,
              memtotal_mb: facts.ansible_memtotal_mb || 0,
              memfree_mb: facts.ansible_memfree_mb || 0,
              memreal: (facts.ansible_memory_mb as Record<string, Record<string, number>>)?.real || null,
              swaptotal_mb: facts.ansible_swaptotal_mb || 0,
              swapfree_mb: facts.ansible_swapfree_mb || 0,
              python_version: facts.ansible_python_version || "",
              uptime_seconds: facts.ansible_uptime_seconds || 0,
              virtualization_type: facts.ansible_virtualization_type || "",
              ansible_version: version,
            })
          );
        } catch (e) {
          return resolve(
            NextResponse.json(
              { error: "Failed to parse facts", raw_output: stdout.substring(0, 500), stderr: stderr.substring(0, 500) },
              { status: 500 }
            )
          );
        }
      } else {
        return resolve(
          NextResponse.json(
            { error: "Failed to gather facts", exitCode: code, stderr: stderr.substring(0, 500) },
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
