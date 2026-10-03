import { test, expect, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
const art = fileURLToPath(
  new URL("../../public/designs/estudio-norte.png", import.meta.url),
);
async function menu(page: Page) {
  const button = page.getByRole("button", {
    name: "Abrir navegación",
    exact: true,
  });
  if (await button.isVisible()) await button.click();
}
async function nav(page: Page, name: string) {
  await menu(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
async function role(page: Page, value: string) {
  await menu(page);
  await page.getByLabel("Cambiar rol", { exact: true }).selectOption(value);
}
async function admin(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Administración", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "La mesa de trabajo" }),
  ).toBeVisible();
}
function dialogs(page: Page) {
  page.on("dialog", (d) =>
    d.accept(d.type() === "prompt" ? "Motivo ficticio de prueba" : undefined),
  );
}
const main = (page: Page) => page.locator("main");
test("recorrido completo: cotización, cliente, diseño, anticipo, producción y entrega", async ({
  page,
}) => {
  dialogs(page);
  await admin(page);
  await main(page)
    .getByRole("button", { name: "Nueva cotización", exact: true })
    .click();
  await page.getByLabel("Cantidad partida 1").fill("200");
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "COT-1011", exact: true }),
  ).toBeVisible();
  const quotePath = page.url().split("#")[1];
  await page
    .getByRole("button", { name: "Emitir · envío simulado", exact: true })
    .click();
  await expect(page.locator(".page-heading .badge")).toHaveText(
    "Pendiente de respuesta",
  );
  await page
    .getByRole("button", { name: "Ver como cliente", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Aceptar cotización", exact: true })
    .click();
  await expect(
    page.getByText("Propuesta aceptada. El equipo puede preparar tu pedido."),
  ).toBeVisible();
  await role(page, "admin");
  await page.goto(`/#${quotePath}`);
  await page
    .getByRole("button", { name: "Convertir en pedido", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "PED-1048", exact: true }),
  ).toBeVisible();
  const orderPath = page.url().split("#")[1];
  await expect(
    page.getByRole("button", { name: "Iniciar producción", exact: true }),
  ).toBeDisabled();
  await main(page).getByRole("button", { name: "Pagos", exact: true }).click();
  const amount = page.getByLabel("Importe del pago");
  const total = Number(await amount.getAttribute("max"));
  await amount.fill((Math.ceil((total * 100) / 2) / 100).toFixed(2));
  await page
    .getByRole("button", { name: "Registrar pago ficticio", exact: true })
    .click();
  await expect(amount).toHaveValue("");
  await main(page)
    .getByRole("button", { name: "Diseños", exact: true })
    .click();
  await page.getByLabel("Subir diseño de Tarjetas").setInputFiles(art);
  await page
    .locator(".upload-form textarea")
    .fill("Diseño original para esta propuesta.");
  await page
    .getByRole("button", { name: "Guardar nueva versión", exact: true })
    .click();
  await expect(page.locator(".design-caption")).toContainText("Versión 1");
  await page.reload();
  await main(page)
    .getByRole("button", { name: "Diseños", exact: true })
    .click();
  await expect(page.locator(".large-preview img")).toBeVisible();
  await page
    .getByRole("button", { name: "Ver como cliente", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Aprobar esta versión", exact: true })
    .click();
  await expect(page.locator(".client-design .badge")).toHaveText("Aprobado");
  await role(page, "production");
  await page.goto(`/#${orderPath}`);
  await page
    .getByRole("button", { name: "Iniciar producción", exact: true })
    .click();
  await expect(page.locator(".page-heading .badge")).toHaveText(
    "En producción",
  );
  await page
    .getByRole("button", { name: "Marcar terminado", exact: true })
    .click();
  await expect(page.locator(".page-heading .badge")).toHaveText("Terminado");
  await expect(
    page.getByRole("button", { name: "Registrar entrega", exact: true }),
  ).toHaveCount(0);
  await role(page, "admin");
  await page.goto(`/#${orderPath}?tab=payments`);
  await page
    .getByRole("button", { name: "Usar saldo completo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Registrar pago ficticio", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Registrar entrega", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Registrar entrega", exact: true })
    .click();
  await expect(page.locator(".page-heading .badge")).toHaveText("Entregado");
  await page.goto(`/#${quotePath}`);
  await page.getByRole("button", { name: "Abrir pedido", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "PED-1048", exact: true }),
  ).toBeVisible();
});
test("cotiza superficie correctamente y exporta el documento comercial", async ({
  page,
}) => {
  await admin(page);
  await main(page)
    .getByRole("button", { name: "Nueva cotización", exact: true })
    .click();
  await page.getByLabel("Producto", { exact: true }).selectOption("banners");
  await page.getByLabel("Cantidad partida 1").fill("2");
  await page.getByLabel("Acabado compatible").selectOption("eyelets");
  await page.getByLabel("Descuento (%)", { exact: true }).fill("10");
  await expect(page.locator(".grand-total strong")).toHaveText("$730.80");
  await expect(page.locator(".internal-breakdown")).toContainText("$420.00");
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  const popupPromise = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Imprimir / PDF", exact: true })
    .click();
  const popup = await popupPromise;
  await expect(
    popup.getByRole("heading", { name: /Cotización COT-/ }),
  ).toBeVisible();
  await expect(popup.locator("body")).not.toContainText("Costo interno");
  await expect(popup.locator("body")).not.toContainText("Margen sobre venta");
  await expect(popup.locator("body")).toContainText(
    "DOCUMENTO DE DEMOSTRACIÓN",
  );
  await popup.close();
});
test("clientes persisten y restablecer elimina cambios con confirmación", async ({
  page,
}) => {
  dialogs(page);
  await admin(page);
  await nav(page, "Clientes");
  await page
    .getByRole("button", { name: "Nuevo cliente", exact: true })
    .click();
  await page.getByLabel("Nombre o negocio").fill("Cliente de prueba");
  await page
    .getByLabel("Correo ficticio", { exact: true })
    .fill("nuevo@example.test");
  await page
    .getByRole("button", { name: "Guardar cliente", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cliente de prueba", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Cliente de prueba", exact: true }),
  ).toBeVisible();
  await nav(page, "Configuración");
  await page
    .getByRole("button", { name: "Restablecer demo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "La mesa de trabajo" }),
  ).toBeVisible();
  await nav(page, "Clientes");
  await expect(
    page.getByRole("heading", { name: "Cliente de prueba", exact: true }),
  ).toHaveCount(0);
});
test("el portal protege versiones anteriores y el catálogo conserva acuerdos emitidos", async ({
  page,
}) => {
  dialogs(page);
  await admin(page);
  await nav(page, "Cotizaciones");
  const row = page
    .locator("tbody tr")
    .filter({ has: page.locator(".badge.sent") })
    .first();
  await row.getByRole("button").click();
  await page
    .getByRole("button", { name: "Crear nueva versión", exact: true })
    .click();
  await page
    .getByLabel("Notas visibles para el cliente")
    .fill("Versión corregida de demostración");
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Emitir · envío simulado", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ver como cliente", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Aceptar cotización", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Historial comercial")
    .selectOption({ label: "Versión 1 · historial" });
  await expect(
    page.getByRole("button", { name: "Aceptar cotización", exact: true }),
  ).toHaveCount(0);
  await expect(main(page)).not.toContainText("Costo interno");
  await expect(main(page)).not.toContainText("Margen sobre venta");
  await expect(main(page)).not.toContainText("Nota interna de ejemplo");
});
test("producción no modifica precios ni registra pagos", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Producción", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tablero de producción", exact: true }),
  ).toBeVisible();
  await menu(page);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Catálogo", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Pagos ficticios", exact: true }),
  ).toHaveCount(0);
  if (
    await page
      .getByRole("button", { name: "Cerrar navegación", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Cerrar navegación", exact: true })
      .click();
  await page.locator(".order-card").first().click();
  await expect(
    main(page).getByRole("button", { name: "Pagos", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Registrar pago ficticio", exact: true }),
  ).toHaveCount(0);
});
test("exporta CSV y revisa páginas adaptables con muestras visibles", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Entra a tu taller" }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-acceso.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Administración", exact: true })
    .click();
  await expect(page.locator(".design-spotlight img")).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-panel.png`,
    fullPage: true,
  });
  for (const name of [
    "Cotizaciones",
    "Pedidos",
    "Producción",
    "Calendario",
    "Clientes",
    "Catálogo",
    "Pagos ficticios",
    "Configuración",
  ]) {
    await nav(page, name);
    await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      name,
    ).toBe(true);
  }
  await nav(page, "Cotizaciones");
  const downloadPromise = page.waitForEvent("download");
  await main(page).getByRole("button", { name: "CSV", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("tinta-demo-quotes.csv");
  await nav(page, "Pedidos");
  await page.locator("tbody tr").first().getByRole("button").first().click();
  await main(page)
    .getByRole("button", { name: "Diseños", exact: true })
    .click();
  await expect(page.locator(".large-preview img")).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-diseno.png`,
    fullPage: true,
  });
});
test("el almacenamiento no disponible muestra un error explícito", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { get: () => undefined });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "No se pudo abrir la demo" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toBeVisible();
});
test("accesibilidad: etiquetas, contraste y navegación de las vistas principales", async ({
  page,
}) => {
  await page.goto("/");
  const issues: string[] = [];
  const scan = async (name: string) => {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    for (const violation of result.violations)
      for (const node of violation.nodes)
        issues.push(
          `${name} | ${violation.id} | ${node.target.join(" ")} | ${node.failureSummary}`,
        );
  };
  await scan("Acceso");
  await page
    .getByRole("button", { name: "Administración", exact: true })
    .click();
  for (const name of [
    "Panel general",
    "Cotizaciones",
    "Pedidos",
    "Producción",
    "Calendario",
    "Clientes",
    "Catálogo",
    "Pagos ficticios",
    "Configuración",
  ]) {
    await nav(page, name);
    await scan(name);
  }
  await page
    .getByRole("button", { name: "Portal del cliente", exact: true })
    .click();
  await scan("Portal");
  expect(issues.join("\n")).toBe("");
});
