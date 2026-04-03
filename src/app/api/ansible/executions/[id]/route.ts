import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const EXECUTIONS_DIR = path.join(process.cwd(), "ansible", "executions");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const metaPath = path.join(EXECUTIONS_DIR, `${id}.json`);
  const logPath = path.join(EXECUTIONS_DIR, `${id}.log`);

  try {
    const metaContent = await fs.readFile(metaPath, "utf-8");
    const meta = JSON.parse(metaContent);

    let log = "";
    try {
      log = await fs.readFile(logPath, "utf-8");
    } catch {
      log = "Log file not found";
    }

    return NextResponse.json({ ...meta, log });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Execution not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to get execution" }, { status: 500 });
  }
}
