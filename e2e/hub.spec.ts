import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations, login, TENANT_A, TENANT_B, TENANT_C, USERS } from "./fixtures";

const DISPARADOR_URL = "http://127.0.0.1:3001";
const PAI_URL = "http://127.0.0.1:3000";

test.describe("Hub Hangap — login e painel de apps", () => {
  test("painel protegido redireciona para o login com a marca Hangap", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("img", { name: "Hangap" }).first()).toBeVisible();
    await expect(page.getByText("Conectando tecnologia, pessoas e inteligência.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Esqueci minha senha" })).toBeVisible();
  });

  test("senha errada mostra erro claro", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(USERS.adminA);
    await page.getByLabel("Senha", { exact: true }).fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator(".hg-alert--error")).toHaveText(/E-mail ou senha inválidos/);
  });

  test("admin A entra, vai ao painel e vê Disparador e PAI da igreja A", async ({ page }) => {
    await login(page, USERS.adminA);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: /^Olá, Admin Fictício A/ })).toBeVisible();
    await expect(page.getByTestId("active-tenant")).toContainText(TENANT_A.name);
    await expect(page.getByRole("link", { name: "Abrir Disparador" })).toHaveAttribute("href", DISPARADOR_URL);
    await expect(page.getByRole("link", { name: "Abrir PAI" })).toHaveAttribute("href", PAI_URL);
    await expect(page.getByText("Do potencial à realização.")).toBeVisible();
  });

  test("igreja sem o módulo PAI não mostra o card do PAI", async ({ page }) => {
    await login(page, USERS.adminC);
    await expect(page.getByTestId("active-tenant")).toContainText(TENANT_C.name);
    await expect(page.getByTestId("app-card-disparador")).toBeVisible();
    await expect(page.getByTestId("app-card-pai")).toHaveCount(0);
  });

  test("mentor vê os apps liberados ao seu papel", async ({ page }) => {
    await login(page, USERS.mentorA);
    await expect(page.getByTestId("app-card-disparador")).toBeVisible();
    await expect(page.getByTestId("app-card-pai")).toBeVisible();
  });

  test("troca de igreja muda a igreja ativa do painel", async ({ page }) => {
    await login(page, USERS.multi);
    await expect(page.getByTestId("active-tenant")).toContainText(TENANT_B.name);
    await page.getByLabel("Trocar igreja").selectOption(TENANT_A.id);
    await page.getByRole("button", { name: "Trocar" }).click();
    await expect(page.getByTestId("active-tenant")).toContainText(TENANT_A.name);
  });

  test("cookie de tenant forjado é ignorado", async ({ page, context }) => {
    await login(page, USERS.adminA);
    await context.addCookies([{ name: "hub_tenant", value: TENANT_B.id, domain: "127.0.0.1", path: "/" }]);
    await page.reload();
    await expect(page.getByTestId("active-tenant")).toContainText(TENANT_A.name);
    await expect(page.getByText(TENANT_B.name)).toHaveCount(0);
  });

  test("sair volta ao login", async ({ page }) => {
    await login(page, USERS.adminA);
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("axe: login e painel sem violações sérias/críticas (inclusive no celular)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto("/login");
    await expectNoSeriousA11yViolations(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await expectNoSeriousA11yViolations(page);
    await login(page, USERS.multi);
    await expectNoSeriousA11yViolations(page);
    await page.setViewportSize({ width: 375, height: 740 });
    await expectNoSeriousA11yViolations(page);
  });
});
