import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const CAPTION_ID = "incentive-auditor-demo-caption";
const CURSOR_ID = "incentive-auditor-demo-cursor";
const cursorPositions = new WeakMap<Page, { x: number; y: number }>();

async function installDemoCursor(page: Page) {
  await page.evaluate((id) => {
    if (document.getElementById(id)) return;

    const cursor = document.createElement("div");
    cursor.id = id;
    cursor.innerHTML = `
      <svg width="30" height="38" viewBox="0 0 30 38" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 2.5V29.2L10.2 22.5L15.1 35L20.2 32.9L15.3 20.7H25.5L3 2.5Z" fill="white" stroke="#111827" stroke-width="2.2" stroke-linejoin="round"/>
      </svg>`;
    Object.assign(cursor.style, {
      position: "fixed",
      left: "0px",
      top: "0px",
      width: "30px",
      height: "38px",
      zIndex: "2147483647",
      pointerEvents: "none",
      filter: "drop-shadow(0 2px 3px rgba(0,0,0,.32))",
      transform: "translate3d(70px, 70px, 0)",
      transformOrigin: "3px 3px",
      transition: "scale 90ms ease",
    });
    document.body.appendChild(cursor);

    window.addEventListener("mousemove", (event) => {
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    }, { capture: true });

    window.addEventListener("mousedown", () => {
      cursor.style.scale = "0.88";
    }, { capture: true });

    window.addEventListener("mouseup", () => {
      cursor.style.scale = "1";
    }, { capture: true });
  }, CURSOR_ID);

  cursorPositions.set(page, { x: 70, y: 70 });
  await page.mouse.move(70, 70);
}

async function moveMouseToPointHuman(page: Page, targetX: number, targetY: number, hover = 180) {
  const current = cursorPositions.get(page) ?? { x: 70, y: 70 };
  const distance = Math.hypot(targetX - current.x, targetY - current.y);
  const steps = Math.max(18, Math.min(42, Math.round(distance / 32)));
  const arc = Math.min(28, Math.max(8, distance * 0.035));

  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    const eased = 0.5 - Math.cos(Math.PI * progress) / 2;
    const x = current.x + (targetX - current.x) * eased;
    const y = current.y + (targetY - current.y) * eased - Math.sin(Math.PI * progress) * arc;
    await page.mouse.move(x, y);
    await pause(14 + (index % 4) * 3);
  }

  cursorPositions.set(page, { x: targetX, y: targetY });
  await pause(hover);
}

async function moveMouseHuman(page: Page, locator: Locator, hover = 180) {
  await locator.scrollIntoViewIfNeeded();
  await pause(180);
  const box = await locator.boundingBox();
  if (!box) return false;

  const targetX = box.x + box.width * 0.52;
  const targetY = box.y + box.height * 0.50;
  await moveMouseToPointHuman(page, targetX, targetY, hover);
  return true;
}

async function humanClick(page: Page, locator: Locator, hover = 180) {
  if (!(await locator.isVisible().catch(() => false))) return;
  const moved = await moveMouseHuman(page, locator, hover);
  if (!moved) {
    await locator.click();
    return;
  }

  await page.mouse.down();
  await pause(85);
  await page.mouse.up();
  await pause(260);
}

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
          width: "min(1500px, calc(100vw - 420px))",
          maxWidth: "1500px",
          minHeight: "42px",
          height: "auto",
          maxHeight: "none",
          boxSizing: "border-box",
          zIndex: "2147483646",
          padding: "10px 22px",
          border: "1px solid rgba(148, 163, 184, .30)",
          borderRadius: "10px",
          background: "rgba(8, 15, 29, .90)",
          color: "#ffffff",
          fontFamily: "Manrope, Inter, Arial, sans-serif",
          fontSize: "19px",
          fontWeight: "650",
          lineHeight: "1.28",
          letterSpacing: ".005em",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0, 0, 0, .24)",
          backdropFilter: "blur(8px)",
          pointerEvents: "none",
          whiteSpace: "normal",
          overflow: "visible",
          textOverflow: "clip",
          overflowWrap: "break-word",
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

async function typeHuman(page: Page, locator: Locator, value: string, delay = 70) {
  await moveMouseHuman(page, locator, 220);
  await humanClick(page, locator, 100);
  await locator.pressSequentially(value, { delay });
}

async function replaceHuman(page: Page, locator: Locator, value: string, delay = 65) {
  await moveMouseHuman(page, locator, 220);
  await humanClick(page, locator, 100);
  await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await pause(220);
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
  await pause(350);
  await moveMouseHuman(page, target, 220);
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
    await pause(450);
    const box = await chart.boundingBox();
    if (!box || box.width < 40 || box.height < 40) continue;

    await subtitle(page, `${sectionLabel}: inspecting chart ${index + 1} of ${count} and revealing its interactive tooltip.`, 500);

    for (const [xRatio, yRatio] of [[0.34, 0.50], [0.48, 0.40], [0.62, 0.48], [0.72, 0.56]] as const) {
      await moveMouseToPointHuman(
        page,
        box.x + box.width * xRatio,
        box.y + box.height * yRatio,
        420,
      );
    }

    await page.mouse.down();
    await pause(80);
    await page.mouse.up();
    await pause(700);
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
  await typeHuman(page, input, question, 48);
  await pause(500);
  await humanClick(page, page.locator(".chatbot-input").getByRole("button", { name: "Send" }), 220);

  await expect.poll(() => page.locator(".chat-agent-message").count(), { timeout: 90_000 }).toBeGreaterThan(repliesBefore);
  await expect(page.locator(".assistant-thinking")).toHaveCount(0, { timeout: 90_000 });
  await pause(1300);
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
    await installDemoCursor(page);
    const username = page.getByLabel("Enter your name");
    await expect(username).toBeVisible({ timeout: 30_000 });
    await subtitle(page, "Incentive Auditor — AI-powered anomaly detection and incentive payout validation for Life Sciences field representatives.", 1600);
    await subtitle(page, "Opening Arvind's isolated PostgreSQL workspace and governed dataset.", 850);
    await typeHuman(page, username, "arvind", 120);
    await pause(600);
    await humanClick(page, page.getByRole("button", { name: "Open my workspace" }), 260);

    await expect(page.locator("main.dashboard")).toBeVisible({ timeout: 60_000 });
    await subtitle(page, "The Analysis workspace combines deterministic anomaly analytics with a live multi-agent investigation workflow.", 1300);

    // 2. Select representative and run investigation
    const representativeSelect = page.locator("select.form-input");
    await expect(representativeSelect).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => representativeSelect.locator("option").count(), { timeout: 30_000 }).toBeGreaterThan(1);
    const firstRepresentative = await representativeSelect.locator("option").nth(1).getAttribute("value");
    if (firstRepresentative) {
      await moveMouseHuman(page, representativeSelect, 260);
      await representativeSelect.selectOption(firstRepresentative);
      await pause(500);
    }

    await subtitle(page, "Selecting a field representative and the July 2026 investigation period before launching the audit.", 950);
    await humanClick(page, page.getByRole("button", { name: "Run Investigation" }), 260);
    await subtitle(page, "The agentic workflow is planning the investigation and evaluating Sales/Rx, Doctor/Territory, Payout, Risk, Summary and Peer evidence.", 1600);

    const workflow = page.getByText("Starting investigation...", { exact: false }).first();
    if (await workflow.isVisible().catch(() => false)) {
      await workflow.scrollIntoViewIfNeeded();
      await moveMouseHuman(page, workflow, 220);
    }
    await pause(2600);

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
      await humanClick(page, tab, 260);
      await pause(700);
      await subtitle(page, caption, 800);
      await tourCharts(page, workspace.locator(".analysis-workspace-content"), tabName);
    }

    await humanClick(page, workspace.getByRole("button", { name: "Sales & Products", exact: true }), 220);
    await pause(550);

    // 5. AI Copilot
    const assistantButton = page.getByLabel("Open AI investigation assistant");
    await humanClick(page, assistantButton, 320);
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
      await humanClick(page, explainSuggestion, 260);
      await pause(1500);
      await clearSpotlight(chatWindow);
    }
    await humanClick(page, assistantButton, 260);
    await pause(550);

    // 6. Data Control / Database Management
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pause(600);
    await humanClick(page, page.getByRole("button", { name: "Data control" }), 300);
    await expect(page.locator(".database-page")).toBeVisible({ timeout: 30_000 });
    await subtitle(page, "Data Control centralizes governed database management, synthetic data generation and document ingestion.", 1100);

    const databaseCard = page.locator(".database-card").first();
    for (const sectionName of [
      "Representatives", "Doctors", "Assignments", "Territories", "Products",
      "Prescriptions", "Sales", "Incentive Programs", "Program Tiers", "Incentive Payouts",
    ] as const) {
      const sectionButton = databaseCard.getByRole("button", { name: sectionName, exact: true });
      if (!(await sectionButton.isVisible().catch(() => false))) continue;
      await humanClick(page, sectionButton, 180);
      const table = await waitForDatabaseReady(page);
      await table.scrollIntoViewIfNeeded();
      await moveMouseHuman(page, table, 180);
      await subtitle(page, `Database Manager — browsing ${sectionName} with paginated, selectable and editable governed records.`, 600);
    }

    // 7. Edit a database record with human-like typing
    await humanClick(page, databaseCard.getByRole("button", { name: "Representatives", exact: true }), 220);
    await waitForDatabaseReady(page);
    const editButton = page.locator(".database-edit-button").first();
    await expect(editButton).toBeVisible({ timeout: 30_000 });
    await editButton.scrollIntoViewIfNeeded();
    await subtitle(page, "Opening a representative record for editing.", 700);
    await humanClick(page, editButton, 260);

    const editModal = page.getByRole("dialog", { name: "Edit Record" });
    await expect(editModal).toBeVisible({ timeout: 20_000 });
    await spotlight(page, editModal, 700);
    await moveMouseHuman(page, editModal, 220);
    await subtitle(page, "The edit modal protects primary keys while allowing governed fields to be changed.", 800);

    const editableText = editModal.locator('input:not([disabled]):not([type="date"])').first();
    if (await editableText.isVisible().catch(() => false)) {
      const currentValue = await editableText.inputValue();
      const nextValue = currentValue.endsWith(" Demo") ? currentValue : `${currentValue} Demo`;
      await subtitle(page, "Updating the field with human-like keystrokes rather than instantly filling it.", 550);
      await replaceHuman(page, editableText, nextValue, 82);
      await pause(600);
    }

    await subtitle(page, "Saving the edited record back to Arvind's workspace.", 600);
    await humanClick(page, editModal.getByRole("button", { name: "Save Changes" }), 280);
    await expect(editModal).toBeHidden({ timeout: 30_000 });
    await waitForDatabaseReady(page);
    await subtitle(page, "The database table refreshes immediately after the successful update.", 800);

    // 8. Generate synthetic test data
    const syntheticButton = page.getByRole("button", { name: "Generate Test Data" });
    await expect(syntheticButton).toBeVisible({ timeout: 20_000 });
    await syntheticButton.scrollIntoViewIfNeeded();
    await subtitle(page, "Generating a downloadable synthetic Life Sciences dataset for representatives, doctors, products, sales, prescriptions and payouts.", 950);
    await humanClick(page, syntheticButton, 300);

    const generationToast = page.locator(".download-toast");
    await expect(generationToast).toBeVisible({ timeout: 20_000 });
    await spotlight(page, generationToast, 650);
    await moveMouseHuman(page, generationToast, 220);
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
    await moveMouseHuman(page, documentCard, 220);
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
    await humanClick(page, viewDuplicates, 300);

    const duplicatePanel = documentCard.locator(".document-duplicate-inline").first();
    await expect(duplicatePanel).toBeVisible({ timeout: 20_000 });
    await spotlight(page, duplicatePanel, 900);
    await moveMouseHuman(page, duplicatePanel, 220);
    await subtitle(page, "Each duplicate defaults to Keep Existing. We will replace only a few selected records.", 950);

    const rowResolutions = duplicatePanel.locator(".duplicate-table .duplicate-resolution");
    const availableRows = await rowResolutions.count();
    const rowsToReplace = Math.min(3, availableRows);
    expect(rowsToReplace).toBeGreaterThan(0);

    for (let index = 0; index < rowsToReplace; index += 1) {
      const resolution = rowResolutions.nth(index);
      await resolution.scrollIntoViewIfNeeded();
      await spotlight(page, resolution, 350);
      await moveMouseHuman(page, resolution, 260);
      await subtitle(page, `Duplicate record ${index + 1}: changing resolution from Keep Existing to Replace Existing.`, 650);
      await resolution.selectOption("replace");
      await pause(700);
      await clearSpotlight(resolution);
    }

    await subtitle(page, `${rowsToReplace} selected duplicate records are marked for replacement; the remaining duplicates stay unchanged.`, 850);
    await clearSpotlight(duplicatePanel);

    const confirmActions = documentCard.getByRole("button", { name: "Confirm Actions" });
    await expect(confirmActions).toBeVisible({ timeout: 20_000 });
    await spotlight(page, confirmActions, 750);
    await subtitle(page, "Confirm Actions is the explicit commit point for the selected duplicate resolutions.", 850);
    await humanClick(page, confirmActions, 340);

    const applyingActions = documentCard.getByText("Applying confirmed actions...", { exact: false });
    await expect(applyingActions).toBeVisible({ timeout: 20_000 });
    await spotlight(page, documentCard, 500);
    await subtitle(page, "Applying the confirmed replacements and preserving all records left as Keep Existing.", 900);
    await expect(applyingActions).toBeHidden({ timeout: 120_000 });
    await subtitle(page, "The confirmed duplicate resolutions were applied and Database Manager was refreshed.", 850);

    // 10. Verify imported data
    await humanClick(page, databaseCard.getByRole("button", { name: "Representatives", exact: true }), 220);
    const refreshedTable = await waitForDatabaseReady(page);
    await spotlight(page, refreshedTable, 600);
    await moveMouseHuman(page, refreshedTable, 220);
    await subtitle(page, "Returning to Representatives verifies the post-import workspace state after selective duplicate replacement.", 900);
    await clearSpotlight(refreshedTable);

    // 11. Finish on analysis dashboard
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pause(500);
    await humanClick(page, page.getByRole("button", { name: "Analysis" }), 300);
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