/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_OUTPUT === "export";

const nextConfig = {
  // Static export for Electron production build (npm run build:next)
  output: isExport ? "export" : undefined,
  images: {
    unoptimized: isExport,
  },
  // Required for file:// loading in Electron production
  assetPrefix: isExport ? "./" : undefined,
  trailingSlash: isExport,
};

export default nextConfig;
