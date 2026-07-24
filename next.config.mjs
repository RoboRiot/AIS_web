import { PRODUCTION_SITE_URL } from "./site.config.mjs";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV === "development";
const defaultDistDir = isDevelopment ? ".next-dev" : ".next";
const configuredDistDir = process.env.AIS_NEXT_DIST_DIR || defaultDistDir;
const developmentScriptPolicy = isDevelopment ? " 'unsafe-eval'" : "";
let finalStaticMirrorRegistered = false;

const copyDirectoryContents = (sourceDirectory, targetDirectory) => {
  if (!existsSync(sourceDirectory)) return;
  mkdirSync(targetDirectory, { recursive: true });

  for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath);
    } else if (entry.isFile()) {
      copyFileSync(sourcePath, targetPath);
    }
  }
};

class MirrorNextStaticAssetsPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tap("MirrorNextStaticAssetsPlugin", () => {
      mirrorNextStaticAssets();
    });
  }
}

const mirrorNextStaticAssets = () => {
  copyDirectoryContents(
    path.join(process.cwd(), configuredDistDir, "static"),
    path.join(process.cwd(), "public", "assets", "next-static"),
  );
};

const contentSecurityDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${developmentScriptPolicy} https://www.googletagmanager.com https://www.google.com https://www.gstatic.com https://js-na2.hs-scripts.com https://js-na2.hscollectedforms.net https://*.hubspot.com https://*.hs-analytics.net https://*.hs-banner.com https://*.usemessages.com`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://storage.googleapis.com https://www.google-analytics.com https://*.hubspot.com https://*.hubspotusercontent.com",
  "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://www.google.com https://www.gstatic.com https://*.googleapis.com https://*.firebaseio.com https://firebasestorage.googleapis.com https://*.hubspot.com https://*.hsforms.com https://*.hs-analytics.net https://*.hs-banner.com",
  "frame-src https://www.google.com https://recaptcha.google.com https://*.hubspot.com https://*.hsforms.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self' https://firebasestorage.googleapis.com https://storage.googleapis.com",
];

if (PRODUCTION_SITE_URL.startsWith("https://")) {
  contentSecurityDirectives.push("upgrade-insecure-requests");
}

const contentSecurityPolicy = contentSecurityDirectives.join("; ");

const nextConfig = {
  distDir: configuredDistDir,
  webpack(config, { dev }) {
    if (!dev) {
      config.plugins.push(new MirrorNextStaticAssetsPlugin());
      if (!finalStaticMirrorRegistered) {
        finalStaticMirrorRegistered = true;
        process.once("exit", mirrorNextStaticAssets);
      }
    }
    return config;
  },
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-site",
          },
          {
            key: "X-Permitted-Cross-Domain-Policies",
            value: "none",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
