import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const EXECUTIONS_DIR = path.join(process.cwd(), "ansible", "executions");

export async function GET() {
  try {
    await fs.mkdir(EXECUTIONS_DIR, { recursive: true });
    const files = await fs.readdir(EXECUTIONS_DIR);
    const executions = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const filePath = path.join(EXECUTIONS_DIR, file);
      const content = await fs.readFile(filePath, "utf-8");
      const meta = JSON.parse(content);
      executions.push(meta);
    }

    executions.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
    return NextResponse.json(executions);
  } catch (error) {
    console.error("Error listing executions:", error);
    return NextResponse.json({ error: "Failed to list executions" }, { status: 500 });
  }
}
