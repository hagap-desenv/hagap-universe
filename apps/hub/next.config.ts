import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Monorepo: rastreia dependências a partir da raiz (node_modules içado).
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // @hagap/core é publicado como fonte TypeScript no workspace
  transpilePackages: ["@hagap/core"],
};

export default nextConfig;
