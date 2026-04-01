import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const INVENTORY_PATH = path.join(process.cwd(), "ansible", "inventory.ini");

interface InventoryHost {
  name: string;
  vars: Record<string, string>;
}

interface InventoryGroup {
  name: string;
  hosts: string[];
  vars: Record<string, string>;
}

function parseInventory(content: string): { hosts: InventoryHost[]; groups: InventoryGroup[] } {
  const hosts: InventoryHost[] = [];
  const groups: InventoryGroup[] = [];
  let currentGroup: InventoryGroup | null = null;

  const lines = content.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#') || line.startsWith(';')) {
      continue;
    }

    // Group header: [group_name] or [group_name:vars] or [group_name:children]
    const groupMatch = line.match(/^\[([^\]]+)\]$/);
    if (groupMatch) {
      const groupHeader = groupMatch[1].trim();
      const parts = groupHeader.split(':');

      if (parts[0]) {
        // End previous group
        currentGroup = {
          name: parts[0],
          hosts: [],
          vars: {},
        };
        // Only add as a group (not as host vars section)
        if (!parts.includes('vars') && !parts.includes('children')) {
          groups.push(currentGroup);
        } else {
          currentGroup = null;
        }
      }
      continue;
    }

    // Parse host line: hostname ansible_var=value ...
    // Could also be in format: hostname
    const hostMatch = line.match(/^([^\s\[=]+)(?:\s+(.+))?$/);
    if (hostMatch) {
      const hostName = hostMatch[1];
      const varsStr = hostMatch[2] || '';

      // Parse key=value pairs
      const vars: Record<string, string> = {};
      if (varsStr) {
        const varPairs = varsStr.match(/(\w[\w.-]*)=([^\s]+)/g);
        if (varPairs) {
          for (const pair of varPairs) {
            const eqIdx = pair.indexOf('=');
            const key = pair.substring(0, eqIdx);
            const val = pair.substring(eqIdx + 1);
            vars[key] = val;
          }
        }
      }

      const host: InventoryHost = { name: hostName, vars };

      if (currentGroup) {
        currentGroup.hosts.push(hostName);
        hosts.push(host);
      } else {
        hosts.push(host);
      }
      continue;
    }
  }

  return { hosts, groups };
}

export async function GET() {
  try {
    const content = await fs.readFile(INVENTORY_PATH, "utf-8");
    const { hosts, groups } = parseInventory(content);

    return NextResponse.json({
      content,
      hosts,
      groups,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // Create the file with default content if it doesn't exist
      const defaultContent = "localhost ansible_connection=local\n";
      await fs.writeFile(INVENTORY_PATH, defaultContent, "utf-8");
      return NextResponse.json({
        content: defaultContent,
        hosts: [{ name: "localhost", vars: { ansible_connection: "local" } }],
        groups: [],
      });
    }
    return NextResponse.json(
      { error: "Error reading inventory file" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { content } = body;

    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Content must be a string" },
        { status: 400 }
      );
    }

    await fs.writeFile(INVENTORY_PATH, content, "utf-8");

    // Re-parse and return updated data
    const { hosts, groups } = parseInventory(content);

    return NextResponse.json({
      success: true,
      content,
      hosts,
      groups,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error writing inventory file" },
      { status: 500 }
    );
  }
}
