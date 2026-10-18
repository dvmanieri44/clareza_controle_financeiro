import type { NextConfig } from "next";
const isGitHubPages = process.env.GITHUB_PAGES === "true";
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(isGitHubPages ? {
    output: "export",
    basePath: process.env.PAGES_BASE_PATH ?? "/clareza_controle_financeiro",
    trailingSlash: true,
  } : {}),
};
export default config;
