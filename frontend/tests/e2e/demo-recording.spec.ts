import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const CAPTION_ID = "incentive-auditor-demo-caption";

async function subtitle(page: Page, text: string, duration = 1100) {
  await page.evaluate(
    ({ id, message }) => {
      let caption = document.getElementById(id);
      if (!caption) {
        caption = document.createElement("div");
        caption.id = id;
        Object.assign(caption.style, {
          position: "fixed",
          left: "50%",
          bottom: "18px",
          top: "auto",
          transform: "translateX(-50%)",
          width: "min(1260px, calc(100vw - 420px))",
          minHeight: "42px",
          zIndex: "2147483647",
          padding: "9px 22px",
          border: "1px solid rgba(148, 163, 184, .30)",
          borderRadius: "10px",
          background: "rgba(8, 15, 29, .90)",
          color: "#ffffff",
          fontFamily: "Manrope, Inter, Arial, sans-serif",
          fontSize: "20px",
          fontWeight: "650",
          lineHeight: "1.25",
          letterSpacing: ".005em",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0, 0, 0, .24)",
          backdropFilter: "blur(8px)",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        });
        document.body.appendChild(caption);
      }

      const chatOpen = Boolean(document.querySelector(".chatbot-window"));
      const toastVisible = Boolean(document.querySelector(".download-toast"));
      if (chatOpen || toastVisible) {
        caption.style.top = "14px";
        caption.style.bottom = "auto";
      } else {
        caption.style.top = "auto";
        caption.style.bottom = "18px";
      }

      caption.textContent = message;
    },
    { id: CAPTION_ID, message: text },
  );
  await pause(duration);
}

async function typeHuman(locator: Locator, value: string, delay = 70) {
  await locator.focus();
  await locator.pressSequentially(value, { delay });
}

async function replaceHuman(locator: Locator, value: string, delay = 65) {
  await locator.focus();
  await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await pause(180);
  await locator.pressSequentially(value, { delay });
}

async function spotlight(page: Page, locator: Locator, hold = 650) {
  if (!(await locator.isVisible().catch(() => false))) return;
  await locator.evaluate((element) => {
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    const target = element as HTMLElement;
    target.dataset.demoOriginalOutline = target.style.outline;
    target.dataset.demoOriginalOutlineOffset = target.style.outlineOffset;
    target.style.outline = "3px solid rgba(37, 99, 235, .72)";
    target.style.outlineOffset = "6px";
  });
  await pause(hold);
}

async function clearSpotlight(locator: Locator) {
  if (!(await locator.isVisible().catch(() => false))) return;
  await locator.evaluate((element) => {
    const target = element as HTMLElement;
    target.style.outline = target.dataset.demoOriginalOutline ?? "";
    target.style.outlineOffset = target.dataset.demoOriginalOutlineOffset ?? "";
    delete target.dataset.demoOriginalOutline;
    delete target.dataset.demoOriginalOutlineOffset;
  });
}

async function focusSection(page: Page, target: Locator, text: string, duration = 1100) {
  if (!(await target.isVisible().catch(() => false))) return false;
  await target.scrollIntoViewIfNeeded();
  await pause(300);
  await subtitle(page, text, duration);
  return true;
}

async function tourCharts(page: Page, root: Locator, sectionLabel: string) {
  const charts = root.locator(".signal-chart, .recharts-wrapper");
  const count = await charts.count();

  for (let index = 0; index < count; index += 1) {
    const chart = charts.nth(index);
    if (!(await chart.isVisible().catch(() => false))) continue;

    await chart.scrollIntoViewIfNeeded();
    await pause(350);
    const box = await chart.boundingBox();
    if (!box || box.width < 40 || box.height < 40) continue;

    await subtitle(page, `${sectionLabel}: inspecting chart ${index + 1} of ${count} and revealing its interactive tooltip.`, 500);

    for (const [xRatio, yRatio] of [[0.40, 0.48], [0.58, 0.40], [0.70, 0.56]] as const) {
      await page.mouse.move(box.x + box.width * xRatio, box.y + box.height * yRatio, { steps: 10 });
      await pause(500);
    }

    await page.mouse.click(box.x + box.width * 0.58, box.y + box.height * 0.46);
    await pause(650);
  }
}

async function waitForDatabaseReady(page: Page) {
  const table = page.locator(".database-table-container").first();
  await expect(table).toBeVisible({ timeout: 45_000 });
  await expect(table).not.toHaveClass(/is-loading/, { timeout: 45_000 });
  return table;
}

async function askCopilot(page: Page, question: string, caption: string) {
  const chatWindow = page.locator(".chatbot-window");
  const input = page.locator(".chatbot-input input");
  await expect(input).toBeVisible({ timeout: 20_000 });
  await spotlight(page, chatWindow, 500);
  const repliesBefore = await page.locator(".chat-agent-message").count();

  await subtitle(page, caption, 650);
  await typeHuman(input, question, 45);
  await pause(450);
  await page.locator(".chatbot-input").getByRole("button", { name: "Send" }).click();

  await expect.poll(() => page.locator(".chat-agent-message").count(), { timeout: 90_000 }).toBeGreaterThan(repliesBefore);
  await expect(page.locator(".assistant-thinking")).toHaveCount(0, { timeout: 90_000 });
  await pause(1200);
  await clearSpotlight(chatWindow);
}

function resolveRepresentativeCsv() {
  const candidates = [
    path.resolve(process.cwd(), "../backend/app/synthetic/output/representatives.csv"),
    path.resolve(process.cwd(), "backend/app/synthetic/output/representatives.csv"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`Could not find representatives.csv. Checked: ${candidates.join(", ")}`);
  return found;
}

test.setTimeout(900_000);

test("record complete Incentive Auditor hackathon demo in 1080p", async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1920, height: 1080 },
    screen: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    acceptDownloads: true,
    recordVideo: {
      dir: testInfo.outputPath("raw-video"),
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();
  const video = page.video();
  let testFailure: unknown;

  try {
    // 1. Login / isolated workspace
    await page.goto("/");
    const username = page.getByLabel("Enter your name");
    await expect(username).toBeVisible({ timeout: 30_000 });
    await subtitle(page, "Incentive Auditor — AI-powered anomaly detection and incentive payout validation for Life Sciences field representatives.", 1600);
    await subtitle(page, "Opening Arvind's isolated PostgreSQL workspace and governed dataset.", 850);
    await typeHuman(username, "arvind", 120);
    await pause(500);
    await page.getByRole("button", { name: "Open my workspace" }).click();

    await expect(page.locator("main.dashboard")).toBeVisible({ timeout: 60_000 });
    await subtitle(page, "The Analysis workspace combines deterministic anomaly analytics with a live multi-agent investigation workflow.", 1300);

    // 2. Select representative and run investigation
    const representativeSelect = page.locator("select.form-input");
    await expect(representativeSelect).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => representativeSelect.locator("option").count(), { timeout: 30_000 }).toBeGreaterThan(1);
    const firstRepresentative = await representativeSelect.locator("option").nth(1).getAttribute("value");
    if (firstRepresentative) await representativeSelect.selectOption(firstRepresentative);

    await subtitle(page, "Selecting a field representative and the July 2026 investigation period before launching the audit.", 950);
    await page.getByRole("button", { name: "Run Investigation" }).click();
    await subtitle(page, "The agentic workflow is planning the investigation and evaluating Sales/Rx, Doctor/Territory, Payout, Risk, Summary and Peer evidence.", 1600);

    const workflow = page.getByText("Starting investigation...", { exact: false }).first();
    if (await workflow.isVisible().catch(() => false)) await workflow.scrollIntoViewIfNeeded();
    await pause(2400);

    await expect(page.getByText("Investigation completed.", { exact: true })).toBeVisible({ timeout: 180_000 });
    await subtitle(page, "Investigation complete — the final risk synthesis is reconciled with the underlying analytical evidence.", 1250);

    // 3. Top dashboard sections and visible charts
    const dashboardSections = [
      ["Overall Risk", "Reviewing the overall risk score and severity produced by the investigation."],
      ["Sales / Prescription", "Reviewing sales and prescription alignment for suspicious divergence."],
      ["Doctor", "Reviewing doctor and territory concentration signals."],
      ["Payout Analysis", "Reviewing expected versus recorded incentive payout evidence."],
      ["Investigation Summary", "Reviewing the synthesized investigation summary and recommended actions."],
    ] as const;

    for (const [label, caption] of dashboardSections) {
      const target = page.getByText(label, { exact: false }).first();
      if (await focusSection(page, target, caption, 850)) {
        const nearest = target.locator("xpath=ancestor::*[self::article or self::section][1]");
        if ((await nearest.count()) > 0) await tourCharts(page, nearest, label);
      }
    }

    // 4. Every Investigation Evidence tab and chart tooltip
    const workspace = page.locator(".analysis-workspace");
    await expect(workspace).toBeVisible({ timeout: 30_000 });
    await workspace.scrollIntoViewIfNeeded();
    await subtitle(page, "Investigation Evidence provides drill-down views across products, peers, doctor/territory behaviour and historical trends.", 1100);

    const evidenceTabs = [
      ["Sales & Products", "Sales & Products — comparing current sales, prescription movement and expected versus actual payouts."],
      ["Peer Benchmark", "Peer Benchmark — comparing the selected representative against a statistically relevant peer group."],
      ["Doctor & Territory", "Doctor & Territory — examining doctor concentration and cross-territory activity."],
      ["Trend History", "Trend History — reviewing temporal patterns and historical deviations."],
    ] as const;

    for (const [tabName, caption] of evidenceTabs) {
      const tab = workspace.getByRole("button", { name: tabName, exact: true });
      await expect(tab).toBeVisible();
      await tab.click();
      await pause(650);
      await subtitle(page, caption, 800);
      await tourCharts(page, workspace.locator(".analysis-workspace-content"), tabName);
    }

    await workspace.getByRole("button", { name: "Sales & Products", exact: true }).click();
    await pause(500);

    // 5. AI Copilot
    await page.getByLabel("Open AI investigation assistant").click();
    const chatWindow = page.locator(".chatbot-window");
    await expect(chatWindow).toBeVisible({ timeout: 20_000 });
    await spotlight(page, chatWindow, 650);
    await subtitle(page, "Opening Investigation Copilot with the current investigation context and governed read-only data access.", 1000);
    await clearSpotlight(chatWindow);

    await askCopilot(page, "Explain the current finding and tell me why this payout is risky.", "Typing a contextual question for Copilot about the current payout anomaly.");
    await askCopilot(page, "Show active representatives", "Typing a governed read-only data question for Copilot.");

    const explainSuggestion = page.getByRole("button", { name: "Explain these results" });
    if (await explainSuggestion.isVisible().catch(() => false)) {
      await spotlight(page, chatWindow, 400);
      await subtitle(page, "Following Copilot's suggested action to explain the returned governed data.", 600);
      await explainSuggestion.click();
      await pause(1400);
      await clearSpotlight(chatWindow);
    }
    await page.getByLabel("Open AI investigation assistant").click();
    await pause(500);

    // 6. Data Control / Database Management
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pause(500);
    await page.getByRole("button", { name: "Data control" }).click();
    await expect(page.locator(".database-page")).toBeVisible({ timeout: 30_000 });
    await subtitle(page, "Data Control centralizes governed database management, synthetic data generation and document ingestion.", 1100);

    const databaseCard = page.locator(".database-card").first();
    for (const sectionName of [
      "Representatives", "Doctors", "Assignments", "Territories", "Products",
      "Prescriptions", "Sales", "Incentive Programs", "Program Tiers", "Incentive Payouts",
    ] as const) {
      const sectionButton = databaseCard.getByRole("button", { name: sectionName, exact: true });
      if (!(await sectionButton.isVisible().catch(() => false))) continue;
      await sectionButton.click();
      const table = await waitForDatabaseReady(page);
      await table.scrollIntoViewIfNeeded();
      await subtitle(page, `Database Manager — browsing ${sectionName} with paginated, selectable and editable governed records.`, 600);
    }

    // 7. Edit a database record with human-like typing
    await databaseCard.getByRole("button", { name: "Representatives", exact: true }).click();
    await waitForDatabaseReady(page);
    const editButton = page.locator(".database-edit-button").first();
    await expect(editButton).toBeVisible({ timeout: 30_000 });
    await editButton.scrollIntoViewIfNeeded();
    await subtitle(page, "Opening a representative record for editing.", 700);
    await editButton.click();

    const editModal = page.getByRole("dialog", { name: "Edit Record" });
    await expect(editModal).toBeVisible({ timeout: 20_000 });
    await spotlight(page, editModal, 700);
    await subtitle(page, "The edit modal protects primary keys while allowing governed fields to be changed.", 800);

    const editableText = editModal.locator('input:not([disabled]):not([type="date"])').first();
    if (await editableText.isVisible().catch(() => false)) {
      const currentValue = await editableText.inputValue();
      const nextValue = currentValue.endsWith(" Demo") ? currentValue : `${currentValue} Demo`;
      await subtitle(page, "Updating the field with human-like keystrokes rather than instantly filling it.", 550);
      await replaceHuman(editableText, nextValue, 80);
      await pause(500);
    }

    await subtitle(page, "Saving the edited record back to Arvind's workspace.", 600);
    await editModal.getByRole("button", { name: "Save Changes" }).click();
    await expect(editModal).toBeHidden({ timeout: 30_000 });
    await waitForDatabaseReady(page);
    await subtitle(page, "The database table refreshes immediately after the successful update.", 800);

    // 8. Generate synthetic test data
    const syntheticButton = page.getByRole("button", { name: "Generate Test Data" });
    await expect(syntheticButton).toBeVisible({ timeout: 20_000 });
    await syntheticButton.scrollIntoViewIfNeeded();
    await subtitle(page, "Generating a downloadable synthetic Life Sciences dataset for representatives, doctors, products, sales, prescriptions and payouts.", 950);
    await syntheticButton.click();

    const generationToast = page.locator(".download-toast");
    await expect(generationToast).toBeVisible({ timeout: 20_000 });
    await spotlight(page, generationToast, 650);
    await subtitle(page, "Synthetic data generation is streaming progress while the downloadable dataset is built.", 1200);
    await expect(syntheticButton).toHaveText(/Generate Test Data/, { timeout: 360_000 });
    if (await generationToast.isVisible().catch(() => false)) {
      await subtitle(page, "Synthetic dataset generation completed and the ZIP package was downloaded.", 800);
      await clearSpotlight(generationToast);
    }

    // 9. Import generated records and inspect duplicate conflicts
    const documentCard = page.getByLabel("Document Processing");
    await expect(documentCard).toBeVisible({ timeout: 30_000 });
    await spotlight(page, documentCard, 600);
    await subtitle(page, "Document Processing classifies, maps, validates and checks generated records before any database write.", 950);

    const generatedRepresentativeCsv = resolveRepresentativeCsv();
    const demoImportDirectory = testInfo.outputPath("synthetic-import-folder");
    await mkdir(demoImportDirectory, { recursive: true });
    await copyFile(generatedRepresentativeCsv, path.join(demoImportDirectory, "representatives.csv"));

    const fileInput = documentCard.locator('input[type="file"]');
    await subtitle(page, "Uploading the generated representative records back into the workspace to demonstrate duplicate detection.", 800);
    await fileInput.setInputFiles(demoImportDirectory);
    await expect(documentCard.locator(".document-results")).toBeVisible({ timeout: 120_000 });
    await spotlight(page, documentCard.locator(".document-results"), 650);
    await subtitle(page, "The incoming records are validated and duplicate keys are identified before confirmation.", 950);

    const viewDuplicates = documentCard.getByRole("button", { name: "View Duplicates" }).first();
    await expect(viewDuplicates).toBeVisible({ timeout: 30_000 });
    await subtitle(page, "Opening the duplicate-review window for record-by-record resolution.", 650);
    await viewDuplicates.click();

    const duplicatePanel = documentCard.locator(".document-duplicate-inline").first();
    await expect(duplicatePanel).toBeVisible({ timeout: 20_000 });
    await spotlight(page, duplicatePanel, 900);
    await subtitle(page, "Each duplicate defaults to Keep Existing. We will replace only a few selected records.", 950);

    const rowResolutions = duplicatePanel.locator(".duplicate-table .duplicate-resolution");
    const availableRows = await rowResolutions.count();
    const rowsToReplace = Math.min(3, availableRows);
    expect(rowsToReplace).toBeGreaterThan(0);

    for (let index = 0; index < rowsToReplace; index += 1) {
      const resolution = rowResolutions.nth(index);
      await resolution.scrollIntoViewIfNeeded();
      await spotlight(page, resolution, 350);
      await subtitle(page, `Duplicate record ${index + 1}: changing resolution from Keep Existing to Replace Existing.`, 650);
      await resolution.selectOption("replace");
      await pause(550);
      await clearSpotlight(resolution);
    }

    await subtitle(page, `${rowsToReplace} selected duplicate records are marked for replacement; the remaining duplicates stay unchanged.`, 850);
    await clearSpotlight(duplicatePanel);

    const confirmActions = documentCard.getByRole("button", { name: "Confirm Actions" });
    await expect(confirmActions).toBeVisible({ timeout: 20_000 });
    await spotlight(page, confirmActions, 750);
    await subtitle(page, "Confirm Actions is the explicit commit point for the selected duplicate resolutions.", 850);
    await confirmActions.click();

    const applyingActions = documentCard.getByText("Applying confirmed actions...", { exact: false });
    await expect(applyingActions).toBeVisible({ timeout: 20_000 });
    await spotlight(page, documentCard, 500);
    await subtitle(page, "Applying the confirmed replacements and preserving all records left as Keep Existing.", 900);
    await expect(applyingActions).toBeHidden({ timeout: 120_000 });
    await subtitle(page, "The confirmed duplicate resolutions were applied and Database Manager was refreshed.", 850);

    // 10. Verify imported data
    await databaseCard.getByRole("button", { name: "Representatives", exact: true }).click();
    const refreshedTable = await waitForDatabaseReady(page);
    await spotlight(page, refreshedTable, 600);
    await subtitle(page, "Returning to Representatives verifies the post-import workspace state after selective duplicate replacement.", 900);
    await clearSpotlight(refreshedTable);

    // 11. Finish on analysis dashboard
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pause(400);
    await page.getByRole("button", { name: "Analysis" }).click();
    await expect(page.locator("main.dashboard")).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await subtitle(page, "Incentive Auditor brings anomaly detection, explainable evidence, agentic investigation, governed data operations and AI assistance into one audit workflow.", 1800);
  } catch (error) {
    testFailure = error;
  } finally {
    await context.close();

    if (video) {
      const finalVideo = testInfo.outputPath("Incentive-Auditor-Demo-1920x1080.webm");
      await video.saveAs(finalVideo);
      await testInfo.attach("Incentive Auditor Demo 1920x1080", {
        path: finalVideo,
        contentType: "video/webm",
      });
    }
  }

  if (testFailure) throw testFailure;
});