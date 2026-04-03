import { expect, test, describe } from "bun:test";
import { parseTemplateMetadata } from "./ansible-utils";

describe("parseTemplateMetadata", () => {
  test("should parse all metadata correctly", () => {
    const content = `# name: Test Template
# description: A test description
# category: Database
---
- name: Test Task
  debug:
    msg: "Hello"`;
    const result = parseTemplateMetadata(content);
    expect(result).toEqual({
      name: "Test Template",
      description: "A test description",
      category: "Database",
      taskCount: 1,
    });
  });

  test("should use default values for missing metadata", () => {
    const content = `---
- name: Test Task
  debug:
    msg: "Hello"`;
    const result = parseTemplateMetadata(content);
    expect(result).toEqual({
      name: "",
      description: "",
      category: "General",
      taskCount: 1,
    });
  });

  test("should handle extra whitespace in metadata tags", () => {
    const content = `# name:   Test Template
# description:    A test description
# category:     Database
---
- name: Test Task
  debug:
    msg: "Hello"`;
    const result = parseTemplateMetadata(content);
    expect(result).toEqual({
      name: "Test Template",
      description: "A test description",
      category: "Database",
      taskCount: 1,
    });
  });

  test("should handle empty content", () => {
    const content = "";
    const result = parseTemplateMetadata(content);
    expect(result).toEqual({
      name: "",
      description: "",
      category: "General",
      taskCount: 0,
    });
  });

  test("should correctly count tasks", () => {
    const content = `---
- name: Task 1
  debug: msg="1"
- name: Task 2
  debug: msg="2"
- name: Task 3
  debug: msg="3"`;
    const result = parseTemplateMetadata(content);
    expect(result.taskCount).toBe(3);
  });

  test("should stop parsing metadata at '---' or '- name:'", () => {
    const content = `# name: Real Name
---
# name: Fake Name
- name: Real Task
# name: Another Fake Name`;
    const result = parseTemplateMetadata(content);
    expect(result.name).toBe("Real Name");
    expect(result.taskCount).toBe(1);
  });

  test("should handle content without '---' or '- name:' but with metadata", () => {
    const content = `# name: Metadata Only
# description: No tasks here`;
    const result = parseTemplateMetadata(content);
    expect(result).toEqual({
      name: "Metadata Only",
      description: "No tasks here",
      category: "General",
      taskCount: 0,
    });
  });

  test("should count tasks with indentation", () => {
    const content = `
- name: Play
  tasks:
    - name: Indented Task 1
      debug: msg="1"
    - name: Indented Task 2
      debug: msg="2"`;
    const result = parseTemplateMetadata(content);
    // The current implementation counts all "- name:" including plays.
    // In this case: 1 Play + 2 Tasks = 3
    expect(result.taskCount).toBe(3);
  });
});
