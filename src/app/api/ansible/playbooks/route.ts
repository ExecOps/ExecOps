import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const PLAYBOOKS_DIR = path.join(process.cwd(), "ansible", "playbooks");

function parsePlaybookMetadata(content: string) {
  const lines = content.split("\n");
  const metadata: { name: string; description: string } = { name: "", description: "" };

  for (const line of lines) {
    if (line.startsWith("# name:")) {
      metadata.name = line.replace(/^#\s*name:\s*/, "").trim();
    } else if (line.startsWith("# description:")) {
      metadata.description = line.replace(/^#\s*description:\s*/, "").trim();
    } else if (line.trim() === "---" || line.trim().startsWith("- name:")) {
      break;
    }
  }

  if (!metadata.name && lines.length > 0) {
    for (const line of lines) {
      if (line.startsWith("- name:")) {
        metadata.name = line.replace(/^-\s*name:\s*/, "").trim();
        break;
      }
    }
  }

  // Count tasks
  const taskCount = (content.match(/^\s+-\s+name:/gm) || []).length;

  return { ...metadata, taskCount };
}

export async function GET() {
  try {
    await fs.mkdir(PLAYBOOKS_DIR, { recursive: true });
    const files = await fs.readdir(PLAYBOOKS_DIR);
    const playbooks = [];

    for (const file of files) {
      if (!file.endsWith(".yml") && !file.endsWith(".yaml")) continue;
      const filePath = path.join(PLAYBOOKS_DIR, file);
      const stat = await fs.stat(filePath);
      const content = await fs.readFile(filePath, "utf-8");
      const metadata = parsePlaybookMetadata(content);

      playbooks.push({
        name: file,
        displayName: metadata.name || file.replace(/\.(yml|yaml)$/, ""),
        description: metadata.description || "Sin descripción",
        taskCount: metadata.taskCount,
        size: stat.size,
        modified: stat.mtimeMs,
        created: stat.birthtimeMs,
      });
    }

    playbooks.sort((a, b) => b.modified - a.modified);
    return NextResponse.json(playbooks);
  } catch (error) {
    console.error("Error listing playbooks:", error);
    return NextResponse.json({ error: "Failed to list playbooks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, content } = body;

    if (!name || !content) {
      return NextResponse.json({ error: "Name and content are required" }, { status: 400 });
    }

    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = safeName.endsWith(".yml") ? safeName : `${safeName}.yml`;
    const filePath = path.join(PLAYBOOKS_DIR, fileName);

    // Add metadata header if not present
    let finalContent = content;
    if (!content.includes("# name:")) {
      finalContent = `# name: ${name}\n# description: ${description || "Sin descripción"}\n${content}`;
    }

    await fs.mkdir(PLAYBOOKS_DIR, { recursive: true });
    await fs.writeFile(filePath, finalContent, "utf-8");

    const stat = await fs.stat(filePath);
    return NextResponse.json({
      name: fileName,
      displayName: name,
      description: description || "Sin descripción",
      created: stat.birthtimeMs,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating playbook:", error);
    return NextResponse.json({ error: "Failed to create playbook" }, { status: 500 });
  }
}
