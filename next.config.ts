import type { NextConfig } from "next";

const supabaseRuntimeFiles = [
  "./supabase/APPLY-ORDER.md",
  "./supabase/migrations/**/*.sql",
  "./supabase/owner-bootstrap.sql",
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  // readFileSync paths are dynamic, so the serverless trace omits these unless listed.
  outputFileTracingIncludes: {
    "/agency": supabaseRuntimeFiles,
    "/command-centre": supabaseRuntimeFiles,
    "/command-centre/*": supabaseRuntimeFiles,
  },
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/command-centre", headers: noindex },
      { source: "/command-centre/:path*", headers: noindex },
      { source: "/api/:path*", headers: noindex },
    ];
  },
};

export default nextConfig;
