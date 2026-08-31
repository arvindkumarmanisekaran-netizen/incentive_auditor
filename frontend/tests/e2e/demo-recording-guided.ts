import { existsSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const CAPTION_ID = "incentive-auditor-demo-caption";
const CURSOR_ID = "incentive-auditor-demo-cursor";
const cursorPositions = new WeakMap<Page, { x: number; y: number }>();
const demoStartTime = Date.now();
let forceCaptionTop = false;

function elapsed() {
  return `${((Date.now() - demoStartTime) / 1000).toFixed(1)}s`;
}

function status(message: string) {
  console.log(`[DEMO ${elapsed()}] ${message}`);
}

async function withHeartbeat<T>(label: string, work: () => Promise<T>, everyMs = 10_000) {
  const startedAt = Date.now();
  status(`${label}...`);
  const timer = setInterval(() => {
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    console.log(`[DEMO ${elapsed()}]   ↳ ${label} — still working (${seconds}s)`);
  }, everyMs);
  try {
    const result = await work();
    status(`✓ ${label} complete`);
    return result;
  } finally {
    clearInterval(timer);
  }
}

function randomIndex(length: number, avoid = -1) {
  if (length <= 1) return 0;
  let index = Math.floor(Math.random() * length);
  if (index === avoid) index = (index + 1) % length;
  return index;
}

function randomUniqueIndices(length: number, count: number) {
  const values = Array.from({ length }, (_, index) => index);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [values[index], values[swap]] = [values[swap], values[index]];
  }
  return values.slice(0, Math.min(count, length));
}

async function installCursor(page: Page) {
  await page.evaluate((id) => {
    if (document.getElementById(id)) return;
    const cursor = document.createElement("div");
    cursor.id = id;
    cursor.innerHTML = `<svg width="29" height="37" viewBox="0 0 30 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 2.5V29.2L10.2 22.5L15.1 35L20.2 32.9L15.3 20.7H25.5L3 2.5Z" fill="white" stroke="#111827" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
    Object.assign(cursor.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "29px",
      height: "37px",
      zIndex: "2147483647",
      pointerEvents: "none",
      filter: "drop-shadow(0 2px 3px rgba(0,0,0,.32))",
      transform: "translate3d(72px,72px,0)",
      transformOrigin: "3px 3px",
      transition: "scale 90ms ease",
    });
    document.body.appendChild(cursor);
    window.addEventListener("mousemove", (event) => {
      cursor.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`;
    }, { capture: true });
    window.addEventListener("mousedown", () => { cursor.style.scale = "0.9"; }, { capture: true });
    window.addEventListener("mouseup", () => { cursor.style.scale = "1"; }, { capture: true });
  }, CURSOR_ID);
  cursorPositions.set(page, { x: 72, y: 72 });
  await page.mouse.move(72, 72);
}

async function smoothMove(page: Page, x: number, y: number, hover = 180) {
  const current = cursorPositions.get(page) ?? { x: 72, y: 72 };
  const distance = Math.hypot(x - current.x, y - current.y);
  const steps = Math.max(34, Math.min(76, Math.round(distance / 16)));
  const controlX = current.x + (x - current.x) * 0.48;
  const controlY = current.y + (y - current.y) * 0.48 - Math.min(14, distance * 0.012);
  await page.mouse.move(controlX, controlY, { steps: Math.max(16, Math.floor(steps * 0.48)) });
  await page.mouse.move(x, y, { steps: Math.max(18, Math.ceil(steps * 0.52)) });
  cursorPositions.set(page, { x, y });
  await pause(hover);
}

async function moveTo(page: Page, locator: Locator, hover = 180) {
  await locator.scrollIntoViewIfNeeded();
  await pause(180);
  const box = await locator.boundingBox();
  if (!box) return false;
  await smoothMove(page, box.x + box.width * 0.52, box.y + box.height * 0.5, hover);
  return true;
}

async function clickHuman(page: Page, locator: Locator, hover = 180) {
  if (!(await locator.isVisible().catch(() => false))) return;
  if (!(await moveTo(page, locator, hover))) {
    await locator.click();
    return;
  }
  await page.mouse.down();
  await pause(90);
  await page.mouse.up();
  await pause(280);
}

async function subtitle(page: Page, text: string, duration = 950) {
  status(text);
  await page.evaluate(
    ({ id, message, forcedTop }) => {
      let caption = document.getElementById(id);
      if (!caption) {
        caption = document.createElement("div");
        caption.id = id;
        Object.assign(caption.style, {
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(1500px, calc(100vw - 420px))",
          maxWidth: "1500px",
          minHeight: "42px",
          height: "auto",
          boxSizing: "border-box",
          zIndex: "2147483646",
          padding: "10px 22px",
          border: "1px solid rgba(148,163,184,.30)",
          borderRadius: "10px",
          background: "rgba(8,15,29,.90)",
          color: "white",
          fontFamily: "Manrope, Inter, Arial, sans-serif",
          fontSize: "19px",
          fontWeight: "650",
          lineHeight: "1.28",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,.24)",
          backdropFilter: "blur(8px)",
          pointerEvents: "none",
          whiteSpace: "normal",
          overflow: "visible",
          overflowWrap: "break-word",
        });
        document.body.appendChild(caption);
      }
      const chatOpen = Boolean(document.querySelector(".chatbot-window"));
      const generationToast = Boolean(document.querySelector(".download-toast"));
      if (forcedTop || chatOpen || generationToast) {
        caption.style.top = "14px";
        caption.style.bottom = "auto";
      } else {
        caption.style.top = "auto";
        caption.style.bottom = "18px";
      }
      caption.textContent = message;
    },
    { id: CAPTION_ID, message: text, forcedTop: forceCaptionTop },
  );
  await pause(duration);
}

async function spotlight(locator: Locator, hold = 450) {
  if (!(await locator.isVisible().catch(() => false))) return;
  await locator.evaluate((element) => {
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    const target = element as HTMLElement;
    target.dataset.demoOutline = target.style.outline;
    target.dataset.demoOutlineOffset = target.style.outlineOffset;
    target.style.outline = "3px solid rgba(37,99,235,.72)";
    target.style.outlineOffset = "6px";
  });
  await pause(hold);
}

async function clearSpotlight(locator: Locator) {
  if (!(await locator.isVisible().catch(() => false))) return;
  await locator.evaluate((element) => {
    const target = element as HTMLElement;
    target.style.outline = target.dataset.demoOutline ?? "";
    target.style.outlineOffset = target.dataset.demoOutlineOffset ?? "";
    delete target.dataset.demoOutline;
    delete target.dataset.demoOutlineOffset;
  });
}

async function typeHuman(page: Page, locator: Locator, value: string, delay = 65) {
  await clickHuman(page, locator, 160);
  await locator.pressSequentially(value, { delay });
}

async function replaceHuman(page: Page, locator: Locator, value: string, delay = 70) {
  await clickHuman(page, locator, 160);
  await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await pause(180);
  await locator.pressSequentially(value, { delay });
}

async function chooseRandomOption(page: Page, select: Locator, skipPlaceholder = true) {
  await expect(select).toBeVisible();
  const options = select.locator("option");
  const count = await options.count();
  const start = skipPlaceholder && count > 1 && !(await options.nth(0).getAttribute("value")) ? 1 : 0;
  if (count <= start) return null;
  const currentValue = await select.inputValue();
  const candidates: Array<{ value: string; label: string }> = [];
  for (let index = start; index < count; index += 1) {
    const value = (await options.nth(index).getAttribute("value")) ?? "";
    if (!value || value === currentValue) continue;
    candidates.push({ value, label: (await options.nth(index).innerText()).trim() });
  }
  if (candidates.length === 0) return null;
  const choice = candidates[randomIndex(candidates.length)];
  await clickHuman(page, select, 260);
  await pause(280);
  await select.selectOption(choice.value);
  await pause(650);
  return choice;
}

function chartCommentary(title: string, description: string) {
  const key = title.toLowerCase();
  if (key.includes("sales performance")) return `${title} compares current sales with the historical baseline, making unusual movement easy to spot.`;
  if (key.includes("sales / prescription alignment") || key.includes("sales and prescription")) return `${title} compares sales movement with prescription movement to surface divergence between commercial activity and demand.`;
  if (key.includes("payout comparison")) return `${title} compares reconstructed expected incentive with the recorded payout and highlights any financial gap.`;
  if (key.includes("sales vs peer average")) return `${title} places the representative's sales beside peer averages across the analyzed products.`;
  if (key.includes("representative vs peer index")) return `${title} normalizes peer performance to 100 so the representative's relative sales, prescription and payout position can be read at a glance.`;
  if (key.includes("peer distribution")) return `${title} shows where the representative sits among comparable peers using sales and payout together.`;
  if (key.includes("doctor")) return `${title} summarizes concentration around doctors and helps identify unusually concentrated prescription activity.`;
  if (key.includes("territory")) return `${title} summarizes territory behaviour and highlights activity that extends beyond the expected selling area.`;
  if (key.includes("risk")) return `${title} consolidates the strongest investigation signals into an overall risk view.`;
  if (key.includes("payout")) return `${title} summarizes incentive payout evidence and the size of any discrepancy detected during validation.`;
  if (description) return `${title} — ${description}`;
  return `${title} summarizes the evidence currently being reviewed.`;
}

async function chartMetadata(chart: Locator) {
  return chart.evaluate((element) => {
    let node: Element | null = element;
    while (node && node !== document.body) {
      const title = node.querySelector(".chart-heading h3, .chart-heading h4, :scope > h3, :scope > h4")?.textContent?.trim();
      if (title) {
        const description = node.querySelector(".chart-heading p, :scope > p")?.textContent?.trim() ?? "";
        return { title, description };
      }
      node = node.parentElement;
    }
    return {
      title: element.getAttribute("aria-label") ?? "Investigation chart",
      description: "",
    };
  });
}

async function tourCharts(page: Page, root: Locator) {
  const charts = root.locator(".signal-chart, .recharts-wrapper");
  const count = await charts.count();
  for (let index = 0; index < count; index += 1) {
    const chart = charts.nth(index);
    if (!(await chart.isVisible().catch(() => false))) continue;
    await chart.scrollIntoViewIfNeeded();
    await pause(360);
    const box = await chart.boundingBox();
    if (!box || box.width < 40 || box.height < 40) continue;
    const metadata = await chartMetadata(chart);
    await subtitle(page, chartCommentary(metadata.title, metadata.description), 820);
    for (const ratio of [0.36, 0.52, 0.68]) {
      await smoothMove(page, box.x + box.width * ratio, box.y + box.height * 0.48, 360);
    }
    await pause(420);
  }
}

async function waitDatabase(page: Page) {
  const table = page.locator(".database-table-container").first();
  await expect(table).toBeVisible({ timeout: 45_000 });
  await expect(table).not.toHaveClass(/is-loading/, { timeout: 45_000 });
  return table;
}

async function askCopilot(page: Page, question: string, commentary: string) {
  const chat = page.locator(".chatbot-window");
  const input = page.locator(".chatbot-input input");
  await spotlight(chat, 420);
  await subtitle(page, commentary, 700);
  const before = await page.locator(".chat-agent-message").count();
  await typeHuman(page, input, question, 46);
  await clickHuman(page, page.locator(".chatbot-input").getByRole("button", { name: "Send" }), 220);
  await withHeartbeat("Waiting for Copilot response", async () => {
    await expect.poll(() => page.locator(".chat-agent-message").count(), { timeout: 90_000 }).toBeGreaterThan(before);
    await expect(page.locator(".assistant-thinking")).toHaveCount(0, { timeout: 90_000 });
  });
  await pause(1200);
  await clearSpotlight(chat);
}

function resolveSyntheticOutputDirectory() {
  const candidates = [
    path.resolve(process.cwd(), "../backend/app/synthetic/output"),
    path.resolve(process.cwd(), "backend/app/synthetic/output"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`Synthetic output folder not found. Checked: ${candidates.join(", ")}`);
  return found;
}

const firstNames = ["Meera", "Vikram", "Nisha", "Rahul", "Ananya", "Kiran", "Deepa", "Sanjay"];
const lastNames = ["Rao", "Iyer", "Sharma", "Menon", "Kapoor", "Nair", "Patel", "Gupta"];

test.setTimeout(900_000);

test("record complete Incentive Auditor hackathon demo in 1080p", async ({ browser }, testInfo) => {
  status("Starting 1920x1080 guided demo recording");
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1920, height: 1080 },
    screen: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    acceptDownloads: true,
    recordVideo: { dir: testInfo.outputPath("raw-video"), size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  const video = page.video();
  let failure: unknown;

  try {
    status("STEP 1/11 — Login");
    await page.goto("/");
    await installCursor(page);
    const username = page.getByLabel("Enter your name");
    await expect(username).toBeVisible({ timeout: 30_000 });
    await subtitle(page, "Incentive Auditor brings anomaly detection and incentive payout validation into a single Life Sciences audit workflow.", 1400);
    await typeHuman(page, username, "arvind", 115);
    await clickHuman(page, page.getByRole("button", { name: "Open my workspace" }), 260);
    await expect(page.locator("main.dashboard")).toBeVisible({ timeout: 60_000 });

    status("STEP 2/11 — Select a representative and investigate");
    const representativeSelect = page.locator("select.form-input");
    await expect.poll(() => representativeSelect.locator("option").count(), { timeout: 30_000 }).toBeGreaterThan(1);
    await subtitle(page, "We begin by choosing a field representative and the July 2026 investigation period.", 850);
    const chosenRepresentative = await chooseRandomOption(page, representativeSelect);
    if (chosenRepresentative) await subtitle(page, `${chosenRepresentative.label} is selected for this investigation.`, 700);
    await clickHuman(page, page.getByRole("button", { name: "Run Investigation" }), 260);
    await subtitle(page, "The investigation agents now evaluate sales and prescriptions, doctor and territory behaviour, payout reconstruction, peer context and overall risk.", 1400);
    await withHeartbeat("Running multi-agent investigation", async () => {
      await expect(page.getByText("Investigation completed.", { exact: true })).toBeVisible({ timeout: 180_000 });
    });
    await subtitle(page, "The investigation has completed and the analytical evidence is ready for review.", 900);

    status("STEP 3/11 — Investigation Evidence");
    const workspace = page.locator(".analysis-workspace");
    await expect(workspace).toBeVisible({ timeout: 30_000 });
    await workspace.scrollIntoViewIfNeeded();
    await subtitle(page, "Investigation Evidence provides product, peer, doctor and territory, and historical views of the same case.", 1000);

    const evidenceTabs = ["Sales & Products", "Peer Benchmark", "Doctor & Territory", "Trend History"] as const;
    for (const tabName of evidenceTabs) {
      const tab = workspace.getByRole("button", { name: tabName, exact: true });
      await clickHuman(page, tab, 240);
      await pause(600);

      if (tabName === "Sales & Products") {
        const productSelect = workspace.locator(".product-analysis-selector select");
        if (await productSelect.isVisible().catch(() => false)) {
          const product = await chooseRandomOption(page, productSelect, false);
          if (product) await subtitle(page, `Product Analysis is switched to ${product.label}, updating the sales, prescription and payout evidence for that product.`, 900);
        }
      }

      if (tabName === "Peer Benchmark") {
        const peerSection = workspace.locator(".peer-analysis-section");
        const peerSelect = peerSection.locator(".analysis-product-selector select");
        if (await peerSelect.isVisible().catch(() => false)) {
          const product = await chooseRandomOption(page, peerSelect, false);
          if (product) await subtitle(page, `Peer Benchmark is now focused on ${product.label}, recalculating the representative's position against comparable peers.`, 900);
        }
        await tourCharts(page, peerSection);
        const indicators = peerSection.locator(".peer-indicator-card .product-status-card");
        const indicatorCount = await indicators.count();
        if (indicatorCount > 1) {
          const activeIndex = await indicators.evaluateAll((items) => items.findIndex((item) => item.classList.contains("active")));
          const index = randomIndex(indicatorCount, activeIndex);
          const indicator = indicators.nth(index);
          const productName = (await indicator.locator(".product-title").innerText()).trim();
          await subtitle(page, `Selecting ${productName} from Peer Indicators refreshes the relative index and peer distribution for that product.`, 900);
          await clickHuman(page, indicator, 260);
          await pause(1200);
          const changedCharts = peerSection.locator(".chart-card").filter({ has: peerSection.locator(".signal-chart") });
          await moveTo(page, changedCharts.nth(Math.min(1, Math.max(0, (await changedCharts.count()) - 1))), 220).catch(() => false);
        }
        continue;
      }

      await subtitle(page,
        tabName === "Sales & Products" ? "Sales & Products connects commercial movement, prescription demand and reconstructed incentive payout for the selected product." :
        tabName === "Doctor & Territory" ? "Doctor & Territory highlights concentration patterns and activity outside the representative's expected territory." :
        "Trend History places the current investigation period in historical context so persistent and emerging deviations can be distinguished.",
        850,
      );
      await tourCharts(page, workspace.locator(".analysis-workspace-content"));
    }

    status("STEP 4/11 — Investigation Insights");
    const insights = page.locator("section.insights-section");
    await expect(insights).toBeVisible({ timeout: 30_000 });
    await insights.scrollIntoViewIfNeeded();
    await subtitle(page, "Investigation Insights brings the strongest cross-product signals together into a concise visual summary of the case.", 950);
    await tourCharts(page, insights);

    status("STEP 5/11 — Investigation Copilot");
    const assistantButton = page.getByLabel("Open AI investigation assistant");
    await clickHuman(page, assistantButton, 300);
    await expect(page.locator(".chatbot-window")).toBeVisible({ timeout: 20_000 });
    await askCopilot(page, "Explain the current finding and tell me why this payout is risky.", "The Investigation Copilot explains the case using the current representative's evidence and read-only governed data access.");
    await askCopilot(page, "Show active representatives", "The Copilot can also answer governed data questions without giving the assistant write access to the database.");
    await clickHuman(page, assistantButton, 240);

    status("STEP 6/11 — Data Control and three database views");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pause(500);
    await clickHuman(page, page.getByRole("button", { name: "Data control" }), 280);
    await expect(page.locator(".database-page")).toBeVisible({ timeout: 30_000 });
    const databaseCard = page.locator(".database-card").first();
    const optionalSections = ["Doctors", "Assignments", "Territories", "Products", "Prescriptions", "Sales", "Incentive Programs", "Program Tiers", "Incentive Payouts"];
    const twoRandom = randomUniqueIndices(optionalSections.length, 2).map((index) => optionalSections[index]);
    const threeSections = ["Representatives", ...twoRandom];
    for (const sectionName of threeSections) {
      const button = databaseCard.getByRole("button", { name: sectionName, exact: true });
      if (!(await button.isVisible().catch(() => false))) continue;
      await clickHuman(page, button, 210);
      const table = await waitDatabase(page);
      await moveTo(page, table, 180);
      await subtitle(page, `${sectionName} shows a governed, paginated view of the workspace records with selection and edit controls available to authorized users.`, 700);
    }

    status("STEP 7/11 — Edit a random representative record");
    await clickHuman(page, databaseCard.getByRole("button", { name: "Representatives", exact: true }), 220);
    await waitDatabase(page);
    const editButtons = page.locator(".database-edit-button");
    const editCount = await editButtons.count();
    expect(editCount).toBeGreaterThan(0);
    const editIndex = randomIndex(editCount);
    await subtitle(page, `A representative is selected from the visible records for a controlled update.`, 700);
    await clickHuman(page, editButtons.nth(editIndex), 260);
    const editModal = page.getByRole("dialog", { name: "Edit Record" });
    await expect(editModal).toBeVisible({ timeout: 20_000 });
    await spotlight(editModal, 500);
    const firstName = firstNames[randomIndex(firstNames.length)];
    const lastName = lastNames[randomIndex(lastNames.length)];
    const firstNameField = editModal.locator("label.database-edit-field").filter({ hasText: /First Name/i }).locator("input");
    const lastNameField = editModal.locator("label.database-edit-field").filter({ hasText: /Last Name/i }).locator("input");
    if (await firstNameField.isVisible().catch(() => false)) {
      await subtitle(page, `The representative's first and last name are updated while the primary key remains locked.`, 700);
      await replaceHuman(page, firstNameField, firstName, 80);
    }
    if (await lastNameField.isVisible().catch(() => false)) await replaceHuman(page, lastNameField, lastName, 80);
    await subtitle(page, `The record will be saved as ${firstName} ${lastName}.`, 650);
    await clickHuman(page, editModal.getByRole("button", { name: "Save Changes" }), 280);
    await expect(editModal).toBeHidden({ timeout: 30_000 });
    await waitDatabase(page);

    status("STEP 8/11 — Generate synthetic dataset");
    const syntheticButton = page.getByRole("button", { name: "Generate Test Data" });
    await expect(syntheticButton).toBeVisible({ timeout: 20_000 });
    await syntheticButton.scrollIntoViewIfNeeded();
    await subtitle(page, "Synthetic data generation creates a complete Life Sciences test dataset covering representatives, doctors, products, assignments, sales, prescriptions and payouts.", 950);
    await clickHuman(page, syntheticButton, 300);
    forceCaptionTop = true;
    const generationToast = page.locator(".download-toast");
    await expect(generationToast).toBeVisible({ timeout: 20_000 });
    await spotlight(generationToast, 450);
    await subtitle(page, "The generator is building the downloadable package and reporting progress as each dataset is created.", 900);
    await withHeartbeat("Generating synthetic dataset", async () => {
      await expect(syntheticButton).toHaveText(/Generate Test Data/, { timeout: 360_000 });
    });
    await subtitle(page, "The ZIP package has finished downloading. Next, the generated output folder is selected as a complete document batch for import.", 1000);
    await clearSpotlight(generationToast);

    status("STEP 9/11 — Import the full generated folder");
    const documentCard = page.getByLabel("Document Processing");
    await expect(documentCard).toBeVisible({ timeout: 30_000 });
    await spotlight(documentCard, 550);
    const selectFolderButton = documentCard.getByRole("button", { name: "Select Document Folder" });
    await subtitle(page, "Document Processing will ingest the full generated folder, classify each supported file, validate its records and identify duplicate keys before any database write.", 1000);
    const chooserPromise = page.waitForEvent("filechooser");
    await clickHuman(page, selectFolderButton, 320);
    const chooser = await chooserPromise;
    await chooser.setFiles(resolveSyntheticOutputDirectory());
    const processingDocuments = documentCard.getByText("Processing documents...", { exact: false });
    await processingDocuments.waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
    await subtitle(page, "The complete folder is now being processed as a multi-document batch.", 850);
    await withHeartbeat("Processing generated document folder", async () => {
      await expect(documentCard.locator(".document-results")).toBeVisible({ timeout: 180_000 });
    });
    await subtitle(page, "The batch summary separates processed files, duplicate-bearing files and any validation failures so each document can be reviewed before confirmation.", 950);

    status("STEP 10/11 — Review a random duplicate table and confirm");
    const duplicateButtons = documentCard.getByRole("button", { name: "View Duplicates" });
    const duplicateFileCount = await duplicateButtons.count();
    expect(duplicateFileCount).toBeGreaterThan(0);
    const duplicateButton = duplicateButtons.nth(randomIndex(duplicateFileCount));
    const resultRow = duplicateButton.locator("xpath=ancestor::*[contains(@class,'document-result-row')][1]");
    const fileName = (await resultRow.locator(".document-result-file strong").innerText().catch(() => "selected document")).trim();
    await subtitle(page, `${fileName} is selected for duplicate review so individual record conflicts can be resolved before import.`, 900);
    await clickHuman(page, duplicateButton, 280);
    const duplicatePanel = resultRow.locator(".document-duplicate-inline");
    await expect(duplicatePanel).toBeVisible({ timeout: 20_000 });
    await spotlight(duplicatePanel, 650);
    const resolutions = duplicatePanel.locator(".duplicate-table .duplicate-resolution");
    const resolutionCount = await resolutions.count();
    expect(resolutionCount).toBeGreaterThan(0);
    const chosenRows = randomUniqueIndices(resolutionCount, 3);
    for (const rowIndex of chosenRows) {
      const resolution = resolutions.nth(rowIndex);
      await moveTo(page, resolution, 240);
      await subtitle(page, `This duplicate is changed from Keep Existing to Replace Existing, while the remaining conflicts keep their current resolution.`, 650);
      await clickHuman(page, resolution, 160);
      await resolution.selectOption("replace");
      await pause(600);
    }
    await clearSpotlight(duplicatePanel);
    const confirmButton = documentCard.getByRole("button", { name: "Confirm Actions" });
    await spotlight(documentCard, 500);
    await subtitle(page, "Confirm Actions is the final governed commit point for the reviewed document batch and the selected duplicate replacements.", 900);
    await clickHuman(page, confirmButton, 320);
    const applying = documentCard.getByText("Applying confirmed actions...", { exact: false });
    await applying.waitFor({ state: "visible", timeout: 2500 }).catch(() => undefined);
    await subtitle(page, "The reviewed actions are being applied while Document Processing remains in focus.", 850);
    const successBanner = documentCard.locator(".import-success-banner");
    await withHeartbeat("Applying confirmed import actions", async () => {
      await expect(successBanner).toBeVisible({ timeout: 180_000 });
    });
    await spotlight(successBanner, 700);
    await subtitle(page, "Import Successful confirms that the document batch and the selected duplicate resolutions have been committed to the workspace.", 1100);
    await clearSpotlight(successBanner);
    await clearSpotlight(documentCard);
    forceCaptionTop = false;

    status("STEP 11/11 — Finish on Analysis");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await pause(500);
    await clickHuman(page, page.getByRole("button", { name: "Analysis" }), 280);
    await expect(page.locator("main.dashboard")).toBeVisible();
    await subtitle(page, "Incentive Auditor combines explainable anomaly evidence, agentic investigation, governed data operations and AI assistance into one auditable workflow.", 1700);
    status("✓ Guided demo completed successfully");
  } catch (error) {
    failure = error;
    console.error(`[DEMO ${elapsed()}] ✗ Demo failed`, error);
  } finally {
    status("Saving 1920x1080 video");
    await context.close();
    if (video) {
      const finalVideo = testInfo.outputPath("Incentive-Auditor-Demo-1920x1080.webm");
      await video.saveAs(finalVideo);
      await testInfo.attach("Incentive Auditor Demo 1920x1080", { path: finalVideo, contentType: "video/webm" });
      status(`✓ Video saved: ${finalVideo}`);
    }
  }

  if (failure) throw failure;
});
