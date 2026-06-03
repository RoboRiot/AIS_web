/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // module.exports = {
  //     reactStrictMode: true,
  env: {
    // next.config.mjs
    emailAccounts: 'isavchenko@advancedimagingparts.com,swang@advancedimagingparts.com,sredd@advancedimagingparts.com',
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY: '6LcmZyIqAAAAAIztRJsHyudfi22qgQzTvkSVm82X'
    // emailAccount: 'testing@softenica.com',
  },
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
