import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getReleaseDistDir,
  readCurrentReleaseId,
} from "./release-config.mjs";

const STATIC_URL_PATTERN = /\/_next\/static\/([^"'\\\s<>)?]+)(?:\?[^"'\\\s<>)]*)?/g;
const CSS_URL_PATTERN = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

const walkFiles = (directory) => {
  if (!existsSync(directory)) return [];
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(entryPath));
    if (entry.isFile()) files.push(entryPath);
  }

  return files;
};

const decodeAssetPath = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const verifyBuildAssets = ({ distDir, projectRoot = process.cwd() }) => {
  const absoluteDistDir = path.resolve(projectRoot, distDir);
  const staticDirectory = path.join(absoluteDistDir, "static");
  const serverDirectory = path.join(absoluteDistDir, "server");

  if (!existsSync(staticDirectory) || !existsSync(serverDirectory)) {
    throw new Error(`Build output is incomplete at ${absoluteDistDir}.`);
  }

  const renderedFiles = walkFiles(serverDirectory).filter((file) => {
    if (/\.(?:html|rsc)$/.test(file)) return true;
    if (!file.endsWith(".json")) return false;

    const relativePath = path.relative(serverDirectory, file);
    return (
      relativePath.startsWith(`app${path.sep}`) ||
      relativePath.startsWith(`pages${path.sep}`)
    );
  });
  const referencedAssets = new Map();

  for (const renderedFile of renderedFiles) {
    const contents = readFileSync(renderedFile, "utf8");
    for (const match of contents.matchAll(STATIC_URL_PATTERN)) {
      const relativeAssetPath = decodeAssetPath(match[1]).replaceAll("/", path.sep);
      if (!referencedAssets.has(relativeAssetPath)) {
        referencedAssets.set(relativeAssetPath, renderedFile);
      }
    }
  }

  const cssFiles = walkFiles(path.join(staticDirectory, "css"));
  for (const cssFile of cssFiles) {
    const contents = readFileSync(cssFile, "utf8");
    for (const match of contents.matchAll(CSS_URL_PATTERN)) {
      const assetUrl = match[2].trim();
      if (
        !assetUrl ||
        assetUrl.startsWith("data:") ||
        assetUrl.startsWith("http:") ||
        assetUrl.startsWith("https:")
      ) {
        continue;
      }

      const cleanAssetUrl = assetUrl.split(/[?#]/, 1)[0];
      const resolvedAsset = cleanAssetUrl.startsWith("/_next/static/")
        ? path.join(
            staticDirectory,
            decodeAssetPath(cleanAssetUrl.slice("/_next/static/".length)).replaceAll(
              "/",
              path.sep,
            ),
          )
        : cleanAssetUrl.startsWith("/")
          ? path.join(projectRoot, "public", cleanAssetUrl.replace(/^\/+/, ""))
          : path.resolve(path.dirname(cssFile), cleanAssetUrl);

      if (
        !resolvedAsset.startsWith(staticDirectory) &&
        !resolvedAsset.startsWith(path.join(projectRoot, "public"))
      ) {
        throw new Error(`CSS asset escapes approved asset directories: ${assetUrl} in ${cssFile}`);
      }
      if (!existsSync(resolvedAsset)) {
        throw new Error(`CSS references a missing asset: ${assetUrl} in ${cssFile}`);
      }
    }
  }

  const missingAssets = [];
  for (const [relativeAssetPath, sourceFile] of referencedAssets) {
    const assetPath = path.join(staticDirectory, relativeAssetPath);
    if (!existsSync(assetPath) || !statSync(assetPath).isFile()) {
      missingAssets.push({
        asset: `/_next/static/${relativeAssetPath.replaceAll(path.sep, "/")}`,
        source: path.relative(projectRoot, sourceFile),
      });
    }
  }

  if (missingAssets.length > 0) {
    const detail = missingAssets
      .slice(0, 30)
      .map(({ asset, source }) => `- ${asset} (referenced by ${source})`)
      .join("\n");
    throw new Error(
      `Build integrity check found ${missingAssets.length} missing static asset(s):\n${detail}`,
    );
  }

  return {
    renderedFiles: renderedFiles.length,
    referencedAssets: referencedAssets.size,
    staticFiles: walkFiles(staticDirectory).length,
  };
};

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const distArgument = process.argv.find((argument) => argument.startsWith("--dist-dir="));
  const currentReleaseId = readCurrentReleaseId();
  const distDir =
    distArgument?.slice("--dist-dir=".length) ||
    process.env.AIS_NEXT_DIST_DIR ||
    (currentReleaseId ? getReleaseDistDir(currentReleaseId) : ".next");

  try {
    const result = verifyBuildAssets({ distDir });
    console.log(
      `Build assets verified: ${result.renderedFiles} rendered files, ` +
        `${result.referencedAssets} references, ${result.staticFiles} static files.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
