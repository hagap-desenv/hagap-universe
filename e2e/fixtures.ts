// Dados do supabase/seed.sql (todos fictícios).
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Teste@1234";

export const USERS = {
  adminA: "admin.a@teste.invalid",
  coordA: "coord.a@teste.invalid",
  mentorA: "mentor.a@teste.invalid",
  adminB: "admin.b@teste.invalid",
  multi: "multi@teste.invalid",
  adminC: "admin.c@teste.invalid",
} as const;

export const TENANT_A = { id: "a1000000-0000-4000-8000-00000000000a", name: "Igreja Fictícia Esperança", cnpj: "12.345.678/0001-95" };
export const TENANT_B = { id: "b1000000-0000-4000-8000-00000000000b", name: "Igreja Fictícia Bom Pastor", cnpj: "98.765.432/0001-98" };

export const TENANT_C = { id: "c1000000-0000-4000-8000-00000000000c", name: "Igreja Fictícia Nova Aliança", cnpj: "77.788.899/0001-83" };

export const INSTANCE_A = { id: "a3000000-0000-4000-8000-000000000001", name: "seed-esperanca-01" };
export const INSTANCE_B = { id: "b3000000-0000-4000-8000-000000000001", name: "seed-bompastor-01" };

export const GROUP_A = { id: "a5000000-0000-4000-8000-000000000001", name: "Jovens (fictício)" };
export const GROUP_B = { id: "b5000000-0000-4000-8000-000000000001", name: "Liderança (fictício)" };

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await expect(page.getByTestId("active-tenant")).toBeVisible();
}

// Só violações sérias/críticas falham o teste (WCAG 2.1 AA)
export async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(serious, serious.join("\n")).toEqual([]);
}
