import { PRODUCTION_SITE_URL } from "./site.config.mjs";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
} from "next/constants.js";
import {
  getReleaseDistDir,
  readCurrentReleaseId,
  sanitizeReleaseId,
} from "./scripts/release-config.mjs";

const buildContentSecurityPolicy = (isDevelopment) => {
  const developmentScriptPolicy = isDevelopment ? " 'unsafe-eval'" : "";
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'unsafe-inline'${developmentScriptPolicy} https://www.googletagmanager.com https://www.google.com https://www.gstatic.com https://js-na2.hs-scripts.com https://js-na2.hscollectedforms.net https://*.hubspot.com https://*.hs-analytics.net https://*.hs-banner.com https://*.usemessages.com`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://storage.googleapis.com https://www.google-analytics.com https://*.hubspot.com https://*.hubspotusercontent.com https://*.hsforms.com",
    "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://www.google.com https://www.gstatic.com https://*.googleapis.com https://*.firebaseio.com https://firebasestorage.googleapis.com https://*.hubspot.com https://*.hsforms.com https://*.hscollectedforms.net https://*.hs-analytics.net https://*.hs-banner.com",
    "frame-src https://www.google.com https://recaptcha.google.com https://*.hubspot.com https://*.hsforms.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' https://firebasestorage.googleapis.com https://storage.googleapis.com",
  ];

  if (PRODUCTION_SITE_URL.startsWith("https://")) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
};

const securityHeaders = (contentSecurityPolicy, releaseId) => [
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
  ...(releaseId
    ? [
        {
          key: "X-AIS-Release",
          value: releaseId,
        },
      ]
    : []),
];

export default function createNextConfig(phase) {
  const isDevelopment =
    phase === PHASE_DEVELOPMENT_SERVER || process.env.NODE_ENV === "development";
  const isProductionBuild = phase === PHASE_PRODUCTION_BUILD;
  const configuredDistDir = process.env.AIS_NEXT_DIST_DIR;
  const releaseId =
    sanitizeReleaseId(process.env.AIS_RELEASE_ID) ||
    (!isProductionBuild ? readCurrentReleaseId() : null);

  if (isProductionBuild && !configuredDistDir && !releaseId) {
    throw new Error(
      "Production builds must run through `npm run build` so they are written to an immutable release directory.",
    );
  }

  if (!isDevelopment && !configuredDistDir && !releaseId) {
    throw new Error(
      "No completed production release was found. Run `npm run build` before starting the server.",
    );
  }

  const distDir =
    configuredDistDir ||
    (isDevelopment ? ".next-dev" : getReleaseDistDir(releaseId));
  const contentSecurityPolicy = buildContentSecurityPolicy(isDevelopment);

  /** @type {import('next').NextConfig} */
  const nextConfig = {
    distDir,
    ...(releaseId
      ? {
          deploymentId: releaseId,
          generateBuildId: async () => releaseId,
        }
      : {}),
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
          source: "/_next/static/:path*",
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=31536000, immutable",
            },
          ],
        },
        {
          source: "/assets/next-static/:path*",
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=31536000, immutable",
            },
          ],
        },
        {
          source: "/(.*)",
          headers: securityHeaders(contentSecurityPolicy, releaseId),
        },
      ];
    },
  };

  return nextConfig;
}
