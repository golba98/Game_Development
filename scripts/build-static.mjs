import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "dist");
const maxAssetBytes = 25 * 1024 * 1024;

const staticEntries = [
  "index.html",
  "1-Menu_Index.html",
  "3-Game_Index.html",
  "favicon.ico",
  "assets",
  "src",
  "maps",
];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const entry of staticEntries) {
  const source = path.join(root, entry);
  const target = path.join(outputDir, entry);

  await cp(source, target, { recursive: true });
}

const files = [];

async function collectFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true });

  for (const dirent of dirents) {
    const filePath = path.join(dir, dirent.name);

    if (dirent.isDirectory()) {
      await collectFiles(filePath);
    } else if (dirent.isFile()) {
      files.push(filePath);
    }
  }
}

await collectFiles(outputDir);

const oversized = [];
let largest = { filePath: "", size: 0 };

for (const filePath of files) {
  const { size } = await stat(filePath);

  if (size > largest.size) {
    largest = { filePath, size };
  }

  if (size > maxAssetBytes) {
    oversized.push({ filePath, size });
  }
}

if (oversized.length > 0) {
  const details = oversized
    .map(({ filePath, size }) => {
      const relativePath = path.relative(outputDir, filePath);
      const mib = (size / 1024 / 1024).toFixed(1);
      return `- ${relativePath}: ${mib} MiB`;
    })
    .join("\n");

  throw new Error(`Static asset limit exceeded:\n${details}`);
}

const largestRelativePath = path.relative(outputDir, largest.filePath);
const largestMib = (largest.size / 1024 / 1024).toFixed(1);

console.log(`Built ${files.length} static files into dist/`);
console.log(`Largest asset: ${largestRelativePath} (${largestMib} MiB)`);
