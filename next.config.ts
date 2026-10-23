import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Automatic memoisation: unchanged subtrees (results, filter panel) are
  // skipped while the customer types. See README › Performance.
  reactCompiler: true,
  partialPrefetching: true,
  images: {
    // Landing-page photos from Unsplash, always requested at the same source size
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/photo-*",
        search: "?auto=format&fit=crop&w=1600&q=80",
      },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
