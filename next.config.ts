import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "undici", "ai", "@ai-sdk/google", "@ai-sdk/anthropic", "@ai-sdk/openai", "@ai-sdk/provider-utils", "@ai-sdk/provider"],
};

export default nextConfig;
