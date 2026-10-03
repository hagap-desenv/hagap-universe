import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations, INSTANCE_A, INSTANCE_B, login, TENANT_A, TENANT_B, USERS } from "./fixtures";

test.describe("Disparador — app (login, isolamento, fila, QR, chave)", () => {
  test("rota protegida redireciona para o login", async ({ page }) => {
    await page.goto("/contatos");
    await expect(page).toHaveURL(/\/login\?next=%2Fcontatos$/);
  });

  test("admin da igreja A não vê instâncias da B", async ({ page }) => {
    await login(page, USERS.adminA);
    const table = page.getByTestId("instances-table");
    await expect(table.getByRole("link", { name: INSTANCE_A.name })).toBeVisible();
    await expect(page.getByText(INSTANCE_B.name)).toHaveCount(0);
    // Painel de fila: 2 mensagens fictícias enfileiradas pelo motor na A; uso hoje vs cap
    const row = table.getByRole("row", { name: new RegExp(INSTANCE_A.name) });
    await expect(row).toContainText("0 de 30");
    await expect(row.getByRole("cell").nth(3)).toHaveText("2");

    const res = await page.goto(`/instancias/${INSTANCE_B.id}`);
    expect(res?.status()).toBe(404);
  });

  test("admin da igreja B só vê a instância da B", async ({ page }) => {
    await login(page, USERS.adminB);
    await expect(page.getByTestId("active-tenant")).toContainText(TENANT_B.name);
    await expect(page.getByTestId("instances-table").getByRole("link", { name: INSTANCE_B.name })).toBeVisible();
    await expect(page.getByText(INSTANCE_A.name)).toHaveCount(0);
  });

  test("cookie de tenant forjado é rejeitado", async ({ page, context }) => {
    await login(page, USERS.adminA);
    await context.addCookies([{ name: "disparador_tenant", value: TENANT_B.id, domain: "127.0.0.1", path: "/" }]);
    await page.reload();
    await expect(page.getByTestId("active-tenant")).toContainText(TENANT_A.name);
    await expect(page.getByText(INSTANCE_B.name)).toHaveCount(0);
  });

  test("admin gera a chave do webhook (mostrada uma vez) e liga por QR (FakeProvider)", async ({ page }) => {
    await login(page, USERS.adminA);
    await page.getByTestId("instances-table").getByRole("link", { name: INSTANCE_A.name }).click();
    await expect(page.getByRole("heading", { level: 1, name: `Instância ${INSTANCE_A.name}` })).toBeVisible();

    await page.getByRole("button", { name: /Gerar chave|Rotacionar chave/ }).click();
    await expect(page.getByTestId("webhook-key")).toHaveText(/^dk_[0-9a-f]{64}$/);
    await page.reload();
    await expect(page.getByTestId("webhook-key")).toHaveCount(0);

    await page.getByRole("button", { name: "Ligar por QR" }).click();
    await expect(page.getByTestId("connect-result")).toContainText("Conectada");
  });

  test("mentor só consulta: sem criar instância nem ligar", async ({ page }) => {
    await login(page, USERS.mentorA);
    await expect(page.getByRole("link", { name: "Nova instância" })).toHaveCount(0);
    const res = await page.goto("/instancias/nova");
    expect(res?.status()).toBe(404);
    await page.goto(`/instancias/${INSTANCE_A.id}`);
    await expect(page.getByRole("button", { name: "Ligar por QR" })).toHaveCount(0);
  });

  test("grupo de variações exige 3 variações com {nome}", async ({ page }) => {
    const group = `lembrete-e2e-${Date.now()}`;
    await login(page, USERS.coordA);
    await page.goto("/variacoes");
    await page.getByLabel("Nome do grupo").fill(group);
    await page.getByLabel("Variação 1 (obrigatória)").fill("Olá {nome}, lembrete do encontro.");
    await page.getByLabel("Variação 2 (obrigatória)").fill("Oi {nome}! Não esqueça do encontro.");
    await page.getByLabel("Variação 3 (obrigatória)").fill("Bom dia! Encontro hoje.");
    await page.getByRole("button", { name: "Criar grupo" }).click();
    await expect(page.locator(".hg-alert--error")).toContainText("{nome}");
    // O que foi digitado é preservado após o erro
    await expect(page.getByLabel("Nome do grupo")).toHaveValue(group);
    await expect(page.getByLabel("Variação 1 (obrigatória)")).toHaveValue("Olá {nome}, lembrete do encontro.");

    await page.getByLabel("Variação 3 (obrigatória)").fill("{nome}, te esperamos no encontro!");
    await page.getByRole("button", { name: "Criar grupo" }).click();
    await expect(page.getByRole("heading", { level: 2, name: group })).toBeVisible();
  });

  test("axe: shell, instância e contatos sem violações sérias/críticas", async ({ page }) => {
    await page.goto("/login");
    await expectNoSeriousA11yViolations(page);
    await login(page, USERS.multi);
    await expectNoSeriousA11yViolations(page);
    await page.goto("/contatos");
    await expectNoSeriousA11yViolations(page);
  });
});
