import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  createReleaseId,
  getReleaseDistDir,
  writeCurrentReleaseId,
} from "./release-config.mjs";
import { verifyBuildAssets } from "./verify-build-assets.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const copyDirectoryContents = (sourceDirectory, targetDirectory) => {
  mkdirSync(targetDirectory, { recursive: true });

  for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath);
    } else if (entry.isFile()) {
      mkdirSync(path.dirname(targetPath), { recursive: true });
      copyFileSync(sourcePath, targetPath);
    }
  }
};

const copyMissingDirectoryContents = (sourceDirectory, targetDirectory) => {
  mkdirSync(targetDirectory, { recursive: true });

  for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);

    if (entry.isDirectory()) {
      copyMissingDirectoryContents(sourcePath, targetPath);
    } else if (entry.isFile() && !existsSync(targetPath)) {
      mkdirSync(path.dirname(targetPath), { recursive: true });
      copyFileSync(sourcePath, targetPath);
    }
  }
};

const mergeHistoricalAssets = (archiveDirectory, staticDirectory) => {
  if (!existsSync(archiveDirectory)) return;

  for (const entry of readdirSync(archiveDirectory, { withFileTypes: true })) {
    if (entry.name === ".gitignore" || entry.name === "releases") continue;
    const archivePath = path.join(archiveDirectory, entry.name);
    const staticPath = path.join(staticDirectory, entry.name);

    if (entry.isDirectory()) {
      copyMissingDirectoryContents(archivePath, staticPath);
    } else if (entry.isFile() && !existsSync(staticPath)) {
      mkdirSync(path.dirname(staticPath), { recursive: true });
      copyFileSync(archivePath, staticPath);
    }
  }
};

const verifyArchive = (sourceDirectory, archiveDirectory) => {
  const pending = [[sourceDirectory, archiveDirectory]];
  let verifiedFiles = 0;

  while (pending.length > 0) {
    const [source, archive] = pending.pop();
    for (const entry of readdirSync(source, { withFileTypes: true })) {
      const sourcePath = path.join(source, entry.name);
      const archivePath = path.join(archive, entry.name);
      if (entry.isDirectory()) {
        pending.push([sourcePath, archivePath]);
      } else if (
        !existsSync(archivePath) ||
        statSync(sourcePath).size !== statSync(archivePath).size
      ) {
        throw new Error(`Static asset archive mismatch: ${archivePath}`);
      } else {
        verifiedFiles += 1;
      }
    }
  }

  return verifiedFiles;
};

const releaseId = createReleaseId(projectRoot);
const distDir =
  process.env.AIS_NEXT_DIST_DIR || getReleaseDistDir(releaseId);
const nextBin = require.resolve("next/dist/bin/next");
const buildEnvironment = {
  ...process.env,
  AIS_RELEASE_ID: releaseId,
  AIS_NEXT_DIST_DIR: distDir,
  NEXT_DEPLOYMENT_ID: releaseId,
};

console.log(`Building immutable release ${releaseId} in ${distDir}`);
const build = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: projectRoot,
  env: buildEnvironment,
  stdio: "inherit",
});

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status || 1);

const integrity = verifyBuildAssets({ distDir, projectRoot });
const staticDirectory = path.join(projectRoot, distDir, "static");
const archiveRoot = path.join(projectRoot, "public", "assets", "next-static");

// Static filenames are content-hashed. Carrying prior files into the new,
// immutable release lets cached HTML from the previous release keep working
// after the process switches over.
mergeHistoricalAssets(archiveRoot, staticDirectory);
copyDirectoryContents(staticDirectory, archiveRoot);
const archivedFiles = verifyArchive(staticDirectory, archiveRoot);

if (!process.env.AIS_NEXT_DIST_DIR) {
  writeCurrentReleaseId(releaseId, projectRoot);
}

console.log(
  `Release ${releaseId} is ready: ${integrity.renderedFiles} rendered files, ` +
    `${integrity.referencedAssets} static references, ${archivedFiles} retained static assets.`,
);
