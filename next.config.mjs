/** @type {import('next').NextConfig} */
const nextConfig = {
    // module.exports = {
    //     reactStrictMode: true,
    env: {
      emailAccount: 'isavchenko@advancedimagingparts.com',
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
