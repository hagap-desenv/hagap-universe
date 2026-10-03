import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Monorepo: rastreia dependências a partir da raiz (node_modules içado).
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
