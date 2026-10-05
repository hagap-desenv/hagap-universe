// E2E dos apps PAI e Disparador contra o Supabase LOCAL (seed fictício). Nunca contra HOM/PRD.
// Pré-requisito: `supabase start` + builds com NEXT_PUBLIC_SUPABASE_* do Supabase local.
import { defineConfig, devices } from "@playwright/test";

const PAI_URL = "http://127.0.0.1:3000";
const DISPARADOR_URL = "http://127.0.0.1:3001";
const HUB_URL = "http://127.0.0.1:3002";
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    locale: "pt-BR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "pai", testMatch: /pai\.spec\.ts/, use: { ...devices["Desktop Chrome"], baseURL: PAI_URL } },
    {
      name: "disparador",
      testMatch: /disparador\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: DISPARADOR_URL },
    },
    { name: "hub", testMatch: /hub\.spec\.ts/, use: { ...devices["Desktop Chrome"], baseURL: HUB_URL } },
  ],
  webServer: [
    {
      command: "npm run start -w apps/pai -- -H 127.0.0.1 -p 3000",
      url: `${PAI_URL}/api/health`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: "npm run start -w apps/disparador -- -H 127.0.0.1",
      url: `${DISPARADOR_URL}/api/health`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: "npm run start -w apps/hub -- -H 127.0.0.1",
      url: `${HUB_URL}/api/health`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
});
