import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const PLAYBOOKS_DIR = path.join(process.cwd(), "ansible", "playbooks");

export async function GET(
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
    const content = await fs.readFile(filePath, "utf-8");
    const stat = await fs.stat(filePath);

    return NextResponse.json({
      name,
      content,
      size: stat.size,
      modified: stat.mtimeMs,
    });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to read playbook" }, { status: 500 });
  }
}

export async function PUT(
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
    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    await fs.writeFile(filePath, content, "utf-8");

    return NextResponse.json({ success: true, name });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update playbook" }, { status: 500 });
  }
}

export async function DELETE(
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
    await fs.unlink(filePath);
    return NextResponse.json({ success: true, name });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete playbook" }, { status: 500 });
  }
}
