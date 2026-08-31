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
          bottom: "22px",
          transform: "translateX(-50%)",
          width: "min(1500px, calc(100vw - 260px))",
          zIndex: "2147483647",
          padding: "15px 26px",
          border: "1px solid rgba(148, 163, 184, .35)",
          borderRadius: "14px",
          background: "rgba(8, 15, 29, .91)",
          color: "#ffffff",
          fontFamily: "Manrope, Inter, Arial, sans-serif",
          fontSize: "24px",
          fontWeight: "650",
          lineHeight: "1.35",
          letterSpacing: ".01em",
          textAlign: "center",
          boxShadow: "0 16px 44px rgba(0, 0, 0, .28)",
          backdropFilter: "blur(10px)",
          pointerEvents: "none",
        });
        document.body.appendChild(caption);
      }
      caption.textContent = message;
    },
    { id: CAPTION_ID, message: text },
  );
  await pause(duration);
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

    await subtitle(
      page,
      `${sectionLabel}: inspecting chart ${index + 1} of ${count} and revealing its interactive tooltip.`,
      500,
    );

    for (const [xRatio, yRatio] of [[0.40, 0.48], [0.58, 0.40], [0.70, 0.56]] as const) {
      await page.mouse.move(box.x + box.width * xRatio, box.y + box.height * yRatio, { steps: 8 });
      await pause(450);
    }

    await page.mouse.click(box.x + box.width * 0.58, box.y + box.height * 0.46);
    await pause(600);
  }
}

async function waitForDatabaseReady(page: Page) {
  const table = page.locator(".database-table-container").first();
  await expect(table).toBeVisible({ timeout: 45_000 });
  await expect(table).not.toHaveClass(/is-loading/, { timeout: 45_000 });
  return table;
}

async function askCopilot(page: Page, question: string, caption: string) {
  const input = page.locator(".chatbot-input input");
  await expect(input).toBeVisible({ timeout: 20_000 });
  const repliesBefore = await page.locator(".chat-agent-message").count();

  await subtitle(page, caption, 700);
  await input.fill(question);
  await pause(500);
  await page.locator(".chatbot-input").getByRole("button", { name: "Send" }).click();

  await expect.poll(() => page.locator(".chat-agent-message").count(), { timeout: 90_000 })
    .toBeGreaterThan(repliesBefore);
  await expect(page.locator(".assistant-thinking")).toHaveCount(0, { timeout: 90_000 });
  await pause(1200);
}

function resolveRepresentativeCsv() {
  const candidates = [
    path.resolve(process.cwd(), "../backend/app/synthetic/output/representatives.csv"),
    path.resolve(process.cwd(), "backend/app/synthetic/output/representatives.csv"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`Could not find representatives.csv. Checked: ${candidates.join(", ")}`);
  }
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
    await expect(page.getByLabel("Enter your name")).toBeVisible({ timeout: 30_000 });
    await subtitle(page, "Incentive Auditor — AI-powered anomaly detection and incentive payout validation for Life Sciences field representatives.", 1700);
    await subtitle(page, "Opening an isolated PostgreSQL workspace for the demo user. Existing users return to their own governed dataset.", 900);
    await page.getByLabel("Enter your name").fill("Performance Tester");
    await pause(550);
    await page.getByRole("button", { name: "Open my workspace" }).click();

    await expect(page.locator("main.dashboard")).toBeVisible({ timeout: 60_000 });
    await subtitle(page, "The Analysis workspace combines deterministic anomaly analytics with a live multi-agent investigation workflow.", 1400);

    // 2. Select representative and run investigation
    const representativeSelect = page.locator("select.form-input");
    await expect(representativeSelect).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => representativeSelect.locator("option").count(), { timeout: 30_000 }).toBeGreaterThan(1);
    const firstRepresentative = await representativeSelect.locator("option").nth(1).getAttribute("value");
    if (firstRepresentative) await representativeSelect.selectOption(firstRepresentative);

    await subtitle(page, "Selecting a field representative and the July 2026 investigation period before launching the audit.", 1000);
    await page.getByRole("button", { name: "Run Investigation" }).click();
    await subtitle(page, "The agentic workflow is now planning the investigation and evaluating Sales/Rx, Doctor/Territory, Payout, Risk, Summary and Peer evidence.", 1700);

    const workflow = page.getByText("Starting investigation...", { exact: false }).first();
    if (await workflow.isVisible().catch(() => false)) await workflow.scrollIntoViewIfNeeded();
    await pause(2400);

    await expect(page.getByText("Investigation completed.", { exact: true })).toBeVisible({ timeout: 180_000 });
    await subtitle(page, "Investigation complete — the final risk synthesis is reconciled with the underlying analytical evidence.", 1300);

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
      if (await focusSection(page, target, caption, 900)) {
        const nearest = target.locator("xpath=ancestor::*[self::article or self::section][1]");
        if ((await nearest.count()) > 0) await tourCharts(page, nearest, label);
      }
    }

    // 4. Every Investigation Evidence tab and chart tooltip
    const workspace = page.locator(".analysis-workspace");
    await expect(workspace).toBeVisible({ timeout: 30_000 });
    await workspace.scrollIntoViewIfNeeded();
    await subtitle(page, "Investigation Evidence provides drill-down views across products, peers, doctor/territory behaviour and historical trends.", 1200);

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
      await subtitle(page, caption, 850);
      await tourCharts(page, workspace.locator(".analysis-workspace-content"), tabName);
    }

    await workspace.getByRole("button", { name: "Sales & Products", exact: true }).click();
    await pause(500);

    // 5. AI Copilot
    await page.getByLabel("Open AI investigation assistant").click();
    await expect(page.locator(".chatbot-window")).toBeVisible({ timeout: 20_000 });
    await subtitle(page, "Opening Investigation Copilot. It receives the current investigation context and keeps database access read-only.", 1100);

    await askCopilot(page, "Explain the current finding and tell me why this payout is risky.", "Asking Copilot to explain the current anomaly using the selected representative's investigation evidence.");
    await askCopilot(page, "Show active representatives", "Using Copilot's governed read-only query path to retrieve active representative records.");

    const explainSuggestion = page.getByRole("button", { name: "Explain these results" });
    if (await explainSuggestion.isVisible().catch(() => false)) {
      await subtitle(page, "Following a Copilot suggestion to explain the returned governed data.", 650);
      await explainSuggestion.click();
      await pause(1500);
    }
    await page.getByLabel("Open AI investigation assistant").click();
    await pause(500);

    // 6. Data Control / Database Management
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pause(500);
    await page.getByRole("button", { name: "Data control" }).click();
    await expect(page.locator(".database-page")).toBeVisible({ timeout: 30_000 });
    await subtitle(page, "Data Control centralizes governed database management, synthetic data generation and document ingestion.", 1200);

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
      await subtitle(page, `Database Manager — browsing ${sectionName} with paginated, selectable, editable governed records.`, 650);
    }

    // 7. Edit a database record
    await databaseCard.getByRole("button", { name: "Representatives", exact: true }).click();
    await waitForDatabaseReady(page);
    const editButton = page.locator(".database-edit-button").first();
    await expect(editButton).toBeVisible({ timeout: 30_000 });
    await editButton.scrollIntoViewIfNeeded();
    await subtitle(page, "Editing a representative record. The edit form opens as a true modal and blocks interaction with the background.", 950);
    await editButton.click();

    const editModal = page.getByRole("dialog", { name: "Edit Record" });
    await expect(editModal).toBeVisible({ timeout: 20_000 });
    await subtitle(page, "Primary keys remain protected while editable fields and governed status values can be changed.", 850);

    const editableText = editModal.locator('input:not([disabled]):not([type="date"])').first();
    if (await editableText.isVisible().catch(() => false)) {
      const currentValue = await editableText.inputValue();
      await editableText.fill(currentValue.endsWith(" Demo") ? currentValue : `${currentValue} Demo`);
      await pause(550);
    }

    await subtitle(page, "Saving the edited record back to the active workspace.", 600);
    await editModal.getByRole("button", { name: "Save Changes" }).click();
    await expect(editModal).toBeHidden({ timeout: 30_000 });
    await waitForDatabaseReady(page);
    await subtitle(page, "The database table refreshes immediately after the successful update.", 850);

    // 8. Generate synthetic test data
    const syntheticButton = page.getByRole("button", { name: "Generate Test Data" });
    await expect(syntheticButton).toBeVisible({ timeout: 20_000 });
    await syntheticButton.scrollIntoViewIfNeeded();
    await subtitle(page, "Generating a downloadable synthetic Life Sciences dataset for representatives, doctors, products, sales, prescriptions and payouts.", 1000);
    await syntheticButton.click();

    const generationToast = page.locator(".download-toast");
    await expect(generationToast).toBeVisible({ timeout: 20_000 });
    await subtitle(page, "The generator streams progress while creating structured CSV, JSON, XLSX and DOCX test datasets.", 1300);
    await expect(syntheticButton).toHaveText(/Generate Test Data/, { timeout: 360_000 });
    await subtitle(page, "Synthetic dataset generation completed and the ZIP package was downloaded.", 900);

    // 9. Import generated data, inspect duplicates, replace and confirm
    const documentCard = page.getByLabel("Document Processing");
    await expect(documentCard).toBeVisible({ timeout: 30_000 });
    await documentCard.scrollIntoViewIfNeeded();
    await subtitle(page, "Document Processing accepts CSV, JSON, XLSX and DOCX and automatically classifies, maps and validates incoming data.", 1000);

    // The UI intentionally uses webkitdirectory, so Playwright must receive a directory.
    // Create a focused temporary import folder containing only representatives.csv.
    const generatedRepresentativeCsv = resolveRepresentativeCsv();
    const demoImportDirectory = testInfo.outputPath("synthetic-import-folder");
    await mkdir(demoImportDirectory, { recursive: true });
    await copyFile(generatedRepresentativeCsv, path.join(demoImportDirectory, "representatives.csv"));

    const fileInput = documentCard.locator('input[type="file"]');
    await subtitle(page, "Importing a generated representatives dataset folder into the same workspace to demonstrate duplicate-key detection.", 750);
    await fileInput.setInputFiles(demoImportDirectory);

    await expect(documentCard.locator(".document-results")).toBeVisible({ timeout: 120_000 });
    await subtitle(page, "The ingestion pipeline has classified the document, mapped its columns, validated records and detected duplicates before any database write.", 1200);

    const viewDuplicates = documentCard.getByRole("button", { name: "View Duplicates" }).first();
    await expect(viewDuplicates).toBeVisible({ timeout: 30_000 });
    await subtitle(page, "Opening duplicate review to compare uploaded records with existing workspace records.", 750);
    await viewDuplicates.click();

    const duplicatePanel = documentCard.locator(".document-duplicate-inline").first();
    await expect(duplicatePanel).toBeVisible({ timeout: 20_000 });
    await duplicatePanel.scrollIntoViewIfNeeded();
    await subtitle(page, "Duplicate records are reviewed before commit; each conflict can keep the existing row or replace it with the uploaded version.", 1100);

    const bulkResolution = duplicatePanel.locator(".duplicate-bulk-resolution");
    await bulkResolution.selectOption("replace");
    await subtitle(page, "Applying Replace Existing to the detected duplicate records for this demonstration.", 900);

    const confirmActions = documentCard.getByRole("button", { name: "Confirm Actions" });
    await expect(confirmActions).toBeVisible({ timeout: 20_000 });
    await subtitle(page, "Confirming the governed duplicate-resolution actions. No replacement occurs until this explicit confirmation.", 850);
    await confirmActions.click();

    const applyingActions = documentCard.getByText("Applying confirmed actions...", { exact: false });
    await expect(applyingActions).toBeVisible({ timeout: 20_000 });
    await expect(applyingActions).toBeHidden({ timeout: 120_000 });
    await subtitle(page, "Confirmed replacements were applied and Database Manager was refreshed with the imported data.", 1000);

    // 10. Verify imported data
    await databaseCard.getByRole("button", { name: "Representatives", exact: true }).click();
    const refreshedTable = await waitForDatabaseReady(page);
    await refreshedTable.scrollIntoViewIfNeeded();
    await subtitle(page, "Returning to Representatives verifies the post-import workspace state after duplicate resolution.", 950);

    // 11. Finish on analysis dashboard
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pause(400);
    await page.getByRole("button", { name: "Analysis" }).click();
    await expect(page.locator("main.dashboard")).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await subtitle(page, "Incentive Auditor brings anomaly detection, explainable evidence, agentic investigation, governed data operations and AI assistance into one audit workflow.", 1900);
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
