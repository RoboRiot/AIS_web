/** @type {import('next').NextConfig} */
const nextConfig = {
  // module.exports = {
  //     reactStrictMode: true,
  env: {
    // next.config.mjs
    emailAccounts: 'isavchenko@advancedimagingparts.com,swang@advancedimagingparts.com,sredd@advancedimagingparts.com'
    // emailAccount: 'testing@softenica.com',
  },
  images: {
    remotePatterns: [
          {
            protocol: "https",
            hostname: "**",
          },
        ],
      },
    //   
};

export default nextConfig;
