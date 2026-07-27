import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empty Turbopack config: Turbopack is the default dev bundler (`npm run dev`)
  // and is dramatically faster at compiling the large Firebase SDK graph than
  // webpack. Its presence alongside the webpack() hook below also stops Next 16
  // from erroring when Turbopack sees a webpack config.
  turbopack: {},

  // Webpack fallback (`npm run dev:webpack`, and production `build`). On /mnt/c
  // (Windows drive over WSL's 9P mount) native file-watch events never arrive,
  // so webpack must poll for HMR to work. Turbopack dev doesn't use this.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = { poll: 800, aggregateTimeout: 300 };
    }
    return config;
  },
};

export default nextConfig;
