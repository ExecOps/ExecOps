export function parseTemplateMetadata(content: string) {
  const lines = content.split("\n");
  const metadata: { name: string; description: string; category: string } = {
    name: "",
    description: "",
    category: "General",
  };

  for (const line of lines) {
    if (line.startsWith("# name:")) {
      metadata.name = line.replace(/^#\s*name:\s*/, "").trim();
    } else if (line.startsWith("# description:")) {
      metadata.description = line.replace(/^#\s*description:\s*/, "").trim();
    } else if (line.startsWith("# category:")) {
      metadata.category = line.replace(/^#\s*category:\s*/, "").trim();
    } else if (line.trim() === "---" || line.trim().startsWith("- name:")) {
      break;
    }
  }

  const taskCount = (content.match(/^\s*-\s+name:/gm) || []).length;
  return { ...metadata, taskCount };
}
