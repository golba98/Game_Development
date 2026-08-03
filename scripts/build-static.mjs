import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "dist");
const buildLockDir = path.join(root, ".build-static.lock");
const maxAssetBytes = 25 * 1024 * 1024;

const staticEntries = [
  "index.html",
  "menu.html",
  "game.html",
  "favicon.ico",
  "assets",
  "src",
  "maps",
];

async function acquireBuildLock() {
  const deadline = Date.now() + 30_000;
  while (true) {
    try {
      await mkdir(buildLockDir);
      return;
    } catch (error) {
      if (error?.code !== "EEXIST" || Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

await acquireBuildLock();

try {
  // Update the output in place. Deleting dist first makes Wrangler's asset
  // watcher observe a moment where every route is gone, leaving dev sessions
  // stuck on empty 500 responses even after the copy finishes.
  await mkdir(outputDir, { recursive: true });

  const expectedFiles = new Set();

  async function collectExpected(source, relativeTarget) {
    const sourceStat = await stat(source);
    if (sourceStat.isFile()) {
      expectedFiles.add(relativeTarget.split(path.sep).join('/'));
      return;
    }
    const entries = await readdir(source, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() && !entry.isDirectory()) continue;
      await collectExpected(path.join(source, entry.name), path.join(relativeTarget, entry.name));
    }
  }

  for (const entry of staticEntries) {
    const source = path.join(root, entry);
    const target = path.join(outputDir, entry);

    await cp(source, target, { recursive: true });
    await collectExpected(source, entry);
  }

let files = [];

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

  for (const filePath of files) {
    const relativePath = path.relative(outputDir, filePath).split(path.sep).join('/');
    if (!expectedFiles.has(relativePath)) await rm(filePath, { force: true });
  }
  files = [];
  await collectFiles(outputDir);

const oversized = [];
let largest = { filePath: "", fileSizeBytes: 0 };

  for (const filePath of files) {
    const { size: fileSizeBytes } = await stat(filePath);

    if (fileSizeBytes > largest.fileSizeBytes) {
      largest = { filePath, fileSizeBytes };
    }

    if (fileSizeBytes > maxAssetBytes) {
      oversized.push({ filePath, fileSizeBytes });
    }
  }

  if (oversized.length > 0) {
    const details = oversized
      .map(({ filePath, fileSizeBytes }) => {
        const relativePath = path.relative(outputDir, filePath);
        const mib = (fileSizeBytes / 1024 / 1024).toFixed(1);
        return `- ${relativePath}: ${mib} MiB`;
      })
      .join("\n");

    throw new Error(`Static asset limit exceeded:\n${details}`);
  }

  const largestRelativePath = path.relative(outputDir, largest.filePath);
  const largestMib = (largest.fileSizeBytes / 1024 / 1024).toFixed(1);

  console.log(`Built ${files.length} static files into dist/`);
  console.log(`Largest asset: ${largestRelativePath} (${largestMib} MiB)`);
} finally {
  await rm(buildLockDir, { recursive: true, force: true });
}
