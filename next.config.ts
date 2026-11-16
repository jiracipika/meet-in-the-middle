import type { NextConfig } from "next";

/**
 * MOBILE=1 is set only by mobile/scripts/export-web.mjs to produce the static
 * bundle for the Capacitor apps: the UI is exported as plain files (there is
 * no Next server on device) and the server-only API routes are excluded from
 * that build. The normal web deployment is completely unaffected.
 */
const isMobile = process.env.MOBILE === "1";

const nextConfig: NextConfig = {
  /* config options here */
  output: isMobile ? "export" : undefined,
  cacheComponents: !isMobile,
  partialPrefetching: !isMobile,
  // The export build runs with the API routes moved aside, so type
  // references to them (generated dev types, route-level tests) cannot
  // resolve. Full typechecking happens on every normal build.
  typescript: isMobile ? { ignoreBuildErrors: true } : undefined,
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
