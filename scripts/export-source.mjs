import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";
const root = resolve(import.meta.dirname, "..");
const ignored = new Set([
  "node_modules",
  "dist",
  ".git",
  ".codex",
  ".agents",
  "test-results",
  "SOURCE_CODE.md",
  "package-lock.json",
  ".env",
]);
async function walk(dir) {
  const files = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(item.name)) continue;
    const path = resolve(dir, item.name);
    if (item.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}
let output =
  "# Complete project source\n\nEvery authored file below includes its full workspace path and complete contents. Dependency lockfiles, generated builds, screenshots and secret environment files are excluded.\n\n";
for (const path of (await walk(root)).sort()) {
  const extension = extname(path).slice(1);
  const language =
    {
      js: "javascript",
      mjs: "javascript",
      jsx: "jsx",
      json: "json",
      css: "css",
      sql: "sql",
      html: "html",
      md: "markdown",
    }[extension] || "text";
  output += `## ${relative(root, path).replaceAll("\\", "/")}\n\nFull path: ${path}\n\n\`\`\`\`${language}\n${await readFile(path, "utf8")}\n\`\`\`\`\n\n`;
}
await writeFile(resolve(root, "SOURCE_CODE.md"), output);
console.log("Created SOURCE_CODE.md with complete source files.");
