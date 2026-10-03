import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations, login, TENANT_A, TENANT_B, USERS } from "./fixtures";

test.describe("PAI — fundação (auth, tenant, permissões, a11y)", () => {
  test("rota protegida redireciona para o login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });

  test("login com usuário seed abre o shell da igreja", async ({ page }) => {
    await login(page, USERS.adminA);
    await expect(page.getByTestId("active-tenant")).toContainText(TENANT_A.name);
    await expect(page.getByRole("heading", { level: 1, name: TENANT_A.name })).toBeVisible();
    await expect(page.getByTestId("tenant-cnpj")).toHaveText(TENANT_A.cnpj);
  });

  test("senha errada mostra erro genérico", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(USERS.adminA);
    await page.getByLabel("Senha", { exact: true }).fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert")).toHaveText(/E-mail ou senha inválidos/);
  });

  test("troca de igreja muda os dados", async ({ page }) => {
    await login(page, USERS.multi);
    // Sem cookie: primeira igreja em ordem alfabética (Bom Pastor)
    await expect(page.getByTestId("tenant-cnpj")).toHaveText(TENANT_B.cnpj);
    await page.getByLabel("Trocar igreja").selectOption(TENANT_A.id);
    await page.getByRole("button", { name: "Trocar" }).click();
    await expect(page.getByTestId("tenant-cnpj")).toHaveText(TENANT_A.cnpj);
    await expect(page.getByTestId("active-tenant")).toContainText(TENANT_A.name);
    // Módulo "cuidado" ligado só na A
    await expect(page.getByRole("link", { name: "Cuidado" })).toBeVisible();
  });

  test("cookie de tenant forjado é rejeitado", async ({ page, context }) => {
    await login(page, USERS.adminA);
    await context.addCookies([{ name: "pai_tenant", value: TENANT_B.id, domain: "127.0.0.1", path: "/" }]);
    await page.reload();
    await expect(page.getByTestId("active-tenant")).toContainText(TENANT_A.name);
    await expect(page.getByText(TENANT_B.name)).toHaveCount(0);
  });

  test("logout encerra a sessão", async ({ page }) => {
    await login(page, USERS.adminA);
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("mentor não vê a área administrativa", async ({ page }) => {
    await login(page, USERS.mentorA);
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "Início" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Administração" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Configurar a igreja" })).toHaveCount(0);

    const res = await page.goto("/admin");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  });

  test("admin vê a área administrativa", async ({ page }) => {
    await login(page, USERS.adminA);
    await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Administração" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Administração" })).toBeVisible();
  });

  test("axe: login e shell sem violações sérias/críticas", async ({ page }) => {
    await page.goto("/login");
    await expectNoSeriousA11yViolations(page);
    await login(page, USERS.multi);
    await expectNoSeriousA11yViolations(page);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Administração" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});
