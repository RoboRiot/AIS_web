import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export const RELEASE_POINTER_FILE = ".next-release-current";
export const RELEASE_DIRECTORY = ".next-releases";

export const sanitizeReleaseId = (value) => {
  const normalized = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalized || null;
};

export const getSourceRevision = (projectRoot = process.cwd()) => {
  const configuredRevision =
    process.env.AIS_SOURCE_REVISION ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.SOURCE_VERSION ||
    process.env.COMMIT_SHA;

  if (configuredRevision) {
    return sanitizeReleaseId(configuredRevision)?.slice(0, 12) || "unknown";
  }

  try {
    return sanitizeReleaseId(
      execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
        cwd: projectRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    return "unknown";
  }
};

export const createReleaseId = (projectRoot = process.cwd()) => {
  const configuredRelease = sanitizeReleaseId(process.env.AIS_RELEASE_ID);
  if (configuredRelease) return configuredRelease;

  const revision = getSourceRevision(projectRoot);
  const timestamp = Date.now().toString(36);
  return `${revision}-${timestamp}`;
};

export const readCurrentReleaseId = (projectRoot = process.cwd()) => {
  const configuredRelease = sanitizeReleaseId(process.env.AIS_RELEASE_ID);
  if (configuredRelease) return configuredRelease;

  const pointerPath = path.join(projectRoot, RELEASE_POINTER_FILE);
  if (!existsSync(pointerPath)) return null;
  return sanitizeReleaseId(readFileSync(pointerPath, "utf8"));
};

export const getReleaseDistDir = (releaseId) =>
  path.posix.join(RELEASE_DIRECTORY, sanitizeReleaseId(releaseId));

export const writeCurrentReleaseId = (releaseId, projectRoot = process.cwd()) => {
  const safeReleaseId = sanitizeReleaseId(releaseId);
  if (!safeReleaseId) throw new Error("Cannot write an empty release ID.");

  const pointerPath = path.join(projectRoot, RELEASE_POINTER_FILE);
  const temporaryPath = `${pointerPath}.tmp`;
  writeFileSync(temporaryPath, `${safeReleaseId}\n`, "utf8");
  renameSync(temporaryPath, pointerPath);
};
