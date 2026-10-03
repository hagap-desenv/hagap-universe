import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Pacote partilhado: mesmas regras dos apps Next.js (inclui jsx-a11y).
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: { next: { rootDir: "." } },
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
]);
