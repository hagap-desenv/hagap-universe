import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations, GROUP_A, GROUP_B, INSTANCE_A, login, USERS } from "./fixtures";

const suffix = () => String(Date.now()).slice(-8);

test.describe("Disparador — grupos de contatos (popup e envio)", () => {
  test("mentor só lê: vê os celulares do grupo da própria igreja, sem editar nem enviar", async ({ page }) => {
    await login(page, USERS.mentorA);
    await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Grupos" }).click();
    const table = page.getByTestId("groups-table");
    await expect(table.getByRole("rowheader", { name: new RegExp(GROUP_A.name.replace(/[()]/g, "\\$&")) })).toBeVisible();
    await expect(page.getByText(GROUP_B.name)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Criar grupo de contatos" })).toHaveCount(0);

    await page.getByRole("button", { name: `Ver celulares do grupo ${GROUP_A.name}` }).click();
    const dialog = page.getByRole("dialog", { name: `Celulares do grupo ${GROUP_A.name}` });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("rowheader", { name: "Ana Fictícia" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Adicionar ao grupo" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await expect(page.getByRole("link", { name: `Ver envios do grupo ${GROUP_A.name}` })).toBeVisible();
    const res = await page.goto(`/grupos/${GROUP_B.id}`);
    expect(res?.status()).toBe(404);
  });

  test("coordenador cria, renomeia e exclui um grupo", async ({ page }) => {
    const name = `e2e-grupo-${suffix()}`;
    await login(page, USERS.coordA);
    await page.goto("/grupos");
    await page.getByLabel("Nome do grupo").fill(name);
    await page.getByRole("button", { name: "Criar grupo de contatos" }).click();
    const row = page.getByTestId(`group-row-${name}`);
    await expect(row.getByTestId("group-member-count")).toHaveText("0");

    await row.getByRole("button", { name: `Renomear o grupo ${name}` }).click();
    await page.getByLabel(`Novo nome do grupo ${name}`).fill(`${name}-novo`);
    await page.getByRole("button", { name: "Salvar nome" }).click();
    const renamed = page.getByTestId(`group-row-${name}-novo`);
    await expect(renamed).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await renamed.getByRole("button", { name: `Excluir o grupo ${name}-novo` }).click();
    await expect(renamed).toHaveCount(0);
  });

  test("popup Ver celulares: abrir, adicionar, vincular existente, editar, remover e fechar com Esc", async ({ page }) => {
    const s = suffix();
    const name = `e2e-popup-${s}`;
    const phone = `+55119${s}`;
    await login(page, USERS.coordA);
    await page.goto("/grupos");
    await page.getByLabel("Nome do grupo").fill(name);
    await page.getByRole("button", { name: "Criar grupo de contatos" }).click();
    await expect(page.getByTestId(`group-row-${name}`)).toBeVisible();

    const opener = page.getByRole("button", { name: `Ver celulares do grupo ${name}` });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: `Celulares do grupo ${name}` });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Fechar" })).toBeFocused();

    // Adicionar número novo (com opt-in)
    await dialog.getByLabel("Nome").fill("Gil Fictício");
    await dialog.getByLabel("Celular (formato internacional)").fill(phone);
    await dialog.getByLabel(/autorizou receber mensagens/).check();
    await dialog.getByRole("button", { name: "Adicionar ao grupo" }).click();
    const gil = dialog.getByRole("row").filter({ hasText: phone });
    await expect(gil).toContainText("Gil Fictício");
    await expect(gil).toContainText("Opt-in");
    await expect(dialog).toBeVisible();

    // Número que já existe na igreja: só vincula (dados do contato mantidos)
    await dialog.getByLabel("Nome").fill("Nome Qualquer");
    await dialog.getByLabel("Celular (formato internacional)").fill("+5511990001001");
    await dialog.getByRole("button", { name: "Adicionar ao grupo" }).click();
    await expect(dialog.getByRole("status")).toContainText("já estava cadastrado");
    await expect(dialog.getByRole("rowheader", { name: "Ana Fictícia" })).toBeVisible();

    // Editar nome e opt-in
    await gil.getByRole("button", { name: "Editar Gil Fictício" }).click();
    await gil.getByLabel("Nome", { exact: true }).fill("Gil Editado");
    await gil.getByLabel(/opt-in/).uncheck();
    await gil.getByRole("button", { name: "Salvar" }).click();
    await expect(gil).toContainText("Gil Editado");
    await expect(gil).toContainText("Sem opt-in");

    // Remover do grupo
    await dialog.getByRole("button", { name: "Remover do grupo Ana Fictícia" }).click();
    await expect(dialog.getByRole("rowheader", { name: "Ana Fictícia" })).toHaveCount(0);

    // Esc fecha e o foco volta ao botão que abriu
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(page.getByTestId(`group-row-${name}`).getByTestId("group-member-count")).toHaveText("1");
  });

  test("enviar notificação para o grupo: individual, só opt-in, com acompanhamento (FakeProvider)", async ({ page }) => {
    await login(page, USERS.adminA);
    // Instância conectada (FakeProvider)
    await page.goto(`/instancias/${INSTANCE_A.id}`);
    await page.getByRole("button", { name: "Ligar por QR" }).click();
    await expect(page.getByTestId("connect-result")).toContainText("Conectada");

    await page.goto("/grupos");
    await page.getByRole("link", { name: `Enviar notificação do grupo ${GROUP_A.name}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: `Grupo ${GROUP_A.name}` })).toBeVisible();
    await expect(page.getByText("até 30 mensagens por dia por número")).toBeVisible();

    await page.getByLabel("Instância conectada").selectOption(INSTANCE_A.id);
    await page.getByLabel(/Grupo de variações/).selectOption({ label: "boas-vindas" });
    await page.getByRole("button", { name: "Enviar notificação para o grupo" }).click();

    const summary = page.getByTestId("group-send-summary");
    await expect(summary).toContainText("1 mensagem(ns) na fila");
    await expect(summary).toContainText("1 sem opt-in");
    await expect(summary).toContainText("0 com opt-out");

    const campaigns = page.getByTestId("group-campaigns");
    const first = campaigns.getByRole("row").nth(1);
    await expect(first.getByRole("cell").nth(0)).toHaveText(/^[1-9]/);
    await expect(first).toContainText("sem opt-in: 1");
  });

  test("axe: grupos, popup aberto e página de envio sem violações sérias/críticas", async ({ page }) => {
    await login(page, USERS.coordA);
    await page.goto("/grupos");
    await expectNoSeriousA11yViolations(page);
    await page.getByRole("button", { name: `Ver celulares do grupo ${GROUP_A.name}` }).click();
    await expect(page.getByRole("dialog", { name: `Celulares do grupo ${GROUP_A.name}` })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await page.keyboard.press("Escape");
    await page.goto(`/grupos/${GROUP_A.id}`);
    await expectNoSeriousA11yViolations(page);
  });
});
