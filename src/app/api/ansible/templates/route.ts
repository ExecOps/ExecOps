import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { parseTemplateMetadata } from "@/lib/ansible-utils";

const TEMPLATES_DIR = path.join(process.cwd(), "ansible", "templates");
const PLAYBOOKS_DIR = path.join(process.cwd(), "ansible", "playbooks");

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateName = searchParams.get("name");

    await fs.mkdir(TEMPLATES_DIR, { recursive: true });

    // Fetch single template content
    if (templateName) {
      const filePath = path.join(TEMPLATES_DIR, templateName);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        return NextResponse.json({ content });
      } catch {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
    }

    const files = await fs.readdir(TEMPLATES_DIR);
    const templates = [];

    for (const file of files) {
      if (!file.endsWith(".yml") && !file.endsWith(".yaml")) continue;
      const filePath = path.join(TEMPLATES_DIR, file);
      const content = await fs.readFile(filePath, "utf-8");
      const metadata = parseTemplateMetadata(content);

      templates.push({
        name: file,
        displayName: metadata.name || file.replace(/\.(yml|yaml)$/, ""),
        description: metadata.description || "Sin descripción",
        category: metadata.category || "General",
        taskCount: metadata.taskCount,
      });
    }

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error listing templates:", error);
    return NextResponse.json({ error: "Failed to list templates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateName, newPlaybookName } = body;

    if (!templateName || !newPlaybookName) {
      return NextResponse.json({ error: "templateName and newPlaybookName are required" }, { status: 400 });
    }

    const templatePath = path.join(TEMPLATES_DIR, templateName);
    const safeName = newPlaybookName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const playbookPath = path.join(PLAYBOOKS_DIR, `${safeName}.yml`);

    await fs.readFile(templatePath, "utf-8");
    await fs.mkdir(PLAYBOOKS_DIR, { recursive: true });
    await fs.writeFile(playbookPath, await fs.readFile(templatePath, "utf-8"), "utf-8");

    return NextResponse.json({ success: true, name: `${safeName}.yml`, displayName: newPlaybookName });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to use template" }, { status: 500 });
  }
}
