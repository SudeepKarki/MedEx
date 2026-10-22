import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Automatic memoisation: unchanged subtrees (results, filter panel) are
  // skipped while the customer types. See README › Performance.
  reactCompiler: true,
  partialPrefetching: true,
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
