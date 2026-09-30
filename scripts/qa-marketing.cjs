/* Isolated local-preview regression checks; never uses the user's browser profile. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.OMS_PLAYWRIGHT_MODULE || "playwright");

const base = process.env.OMS_QA_URL || "http://localhost:3001";
const out = path.resolve("qa-results");
fs.mkdirSync(out, { recursive: true });
const results = [];
const errors = [];
const categories = [
  ["poster", "Posters"],
  ["video", "Videos"],
  ["ai_video", "Videos"],
  ["lead_campaign", "Lead Campaigns"],
  ["google_ads", "Google Ads"],
  ["broadcast", "Broadcasts"],
  ["blog", "Blogs"],
  ["brochure", "Brochures"],
  ["seo", "SEO"],
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["linkedin", "LinkedIn"],
  ["followers", "Followers & Community"],
  ["workshop", "Workshops"],
  ["other", "Other"],
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    reducedMotion: "reduce",
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  const check = async (name, fn) => {
    try {
      await fn();
      results.push({ name, passed: true });
      console.log("PASS", name);
    } catch (error) {
      results.push({ name, passed: false, error: error.message });
      console.error("FAIL", name, error.message);
      await page
        .screenshot({
          path: path.join(out, `failure-${results.length}.png`),
          fullPage: true,
        })
        .catch(() => {});
      throw error;
    }
  };
  const waitHeading = (text) =>
    page.getByRole("heading", { name: text, exact: true }).waitFor();
  const noOverflow = async () =>
    assert.equal(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1,
      ),
      false,
      "page-level horizontal overflow",
    );
  const savedTasks = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("oms-marketing-demo-data")).tasks,
    );
  try {
    await check(
      "Login rejects wrong password and accepts the testing account",
      async () => {
        await page.goto(`${base}/login`);
        await page.getByLabel("Email address").fill("saqib@electrobtech.in");
        await page.getByLabel("Password", { exact: true }).fill("incorrect");
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .click();
        await page
          .getByRole("alert")
          .filter({ hasText: "Invalid email or password" })
          .waitFor();
        await page
          .getByLabel("Password", { exact: true })
          .fill("Electrobtech@123");
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .click();
        await waitHeading("Digital Marketing Dashboard");
        await page.waitForFunction(
          () => !!localStorage.getItem("oms-marketing-demo-data"),
        );
        assert.equal(
          await page.evaluate(() =>
            localStorage.getItem("oms-marketing-demo-session"),
          ),
          "1",
        );
      },
    );
    await check(
      "Dashboard totals distinguish approved and published output",
      async () => {
        const lifecycle = page.locator(".dashboard-panel-secondary");
        assert.match(await lifecycle.innerText(), /50%/);
        assert.match(await lifecycle.innerText(), /5 of 10 published/);
        assert.match(await lifecycle.innerText(), /Approved/);
        assert.equal(
          await page
            .getByRole("button", { name: "New task", exact: true })
            .count(),
          1,
        );
        await noOverflow();
        await page.screenshot({
          path: path.join(out, "dashboard-desktop.png"),
          fullPage: true,
        });
      },
    );
    await check(
      "All category links use SPA navigation with matching headings",
      async () => {
        for (const [key, label] of categories.filter(
          ([key]) => key !== "ai_video",
        )) {
          await page
            .locator("aside")
            .getByRole("link", { name: label, exact: true })
            .click();
          await waitHeading(label);
          await page.waitForURL(
            (url) => url.searchParams.get("category") === key,
          );
          assert.equal(
            await page.locator(".recharts-wrapper").count(),
            0,
            `charts on ${key}`,
          );
          assert.equal(
            await page
              .getByRole("button", { name: "New task", exact: true })
              .count(),
            0,
          );
          await noOverflow();
        }
        await page.goto(
          `${base}/marketing-preview?view=work&category=ai_video`,
        );
        await waitHeading("Videos");
        assert.match(await page.locator("tbody").innerText(), /AI testimonial/);
        await page
          .locator("aside")
          .getByRole("link", { name: "Dashboard", exact: true })
          .click();
        await waitHeading("Digital Marketing Dashboard");
        await page
          .getByRole("button", { name: "Videos 2", exact: true })
          .click();
        await waitHeading("Videos");
      },
    );
    await check(
      "Modal validation, Escape and keyboard focus containment",
      async () => {
        await page
          .locator("aside")
          .getByRole("link", { name: "Dashboard", exact: true })
          .click();
        await page
          .getByRole("button", { name: "New task", exact: true })
          .click();
        const dialog = page.getByRole("dialog", { name: "Add new task" });
        await dialog
          .getByRole("button", { name: "Add task", exact: true })
          .click();
        await dialog
          .getByRole("alert")
          .filter({ hasText: "Title and due date are required" })
          .waitFor();
        for (let i = 0; i < 18; i++) {
          await page.keyboard.press("Tab");
          assert.equal(
            await page.evaluate(() =>
              document.querySelector("dialog").contains(document.activeElement),
            ),
            true,
            `focus left dialog on Tab ${i + 1}: ${await page.evaluate(() => document.activeElement.outerHTML.slice(0, 300))}`,
          );
        }
        await page.keyboard.press("Escape");
        assert.equal(await page.getByRole("dialog").count(), 0);
        assert.equal(
          await page
            .getByRole("button", { name: "New task", exact: true })
            .evaluate((el) => el === document.activeElement),
          true,
          "New task focus restored after Escape",
        );
      },
    );
    await check(
      "Create every task type including AI video and community tasks",
      async () => {
        for (const [key] of categories) {
          await page
            .getByRole("button", { name: "New task", exact: true })
            .click();
          const dialog = page.getByRole("dialog", { name: "Add new task" });
          await dialog.getByLabel("Title *", { exact: true }).fill(`QA ${key}`);
          await dialog
            .getByLabel("Due date *", { exact: true })
            .fill("2026-09-30");
          await dialog.getByLabel("Activity type").selectOption(key);
          await dialog
            .getByRole("combobox", { name: /^Platform/ })
            .selectOption(
              key === "facebook"
                ? "Facebook"
                : key === "linkedin"
                  ? "LinkedIn"
                  : "Instagram",
            );
          if (key === "poster") {
            await dialog.getByLabel("Expected deliverables").fill("1.5");
            await dialog
              .getByRole("button", { name: "Add task", exact: true })
              .click();
            await dialog
              .getByRole("alert")
              .filter({ hasText: "whole number" })
              .waitFor();
          }
          await dialog.getByLabel("Expected deliverables").fill("2");
          await dialog
            .getByRole("button", { name: "Add task", exact: true })
            .click();
          await dialog.waitFor({ state: "hidden" });
        }
        await page.reload();
        await page.waitForFunction(
          () =>
            JSON.parse(
              localStorage.getItem("oms-marketing-demo-data"),
            ).tasks.filter((t) => t.title.startsWith("QA ")).length === 15,
        );
        assert.equal(
          (await savedTasks()).filter((t) => t.title.startsWith("QA ")).length,
          15,
        );
      },
    );
    await check(
      "Every task type can start and submit with proof or valid links",
      async () => {
        await page
          .locator("aside")
          .getByRole("link", { name: "Tasks", exact: true })
          .click();
        for (const [key] of categories) {
          await page.getByLabel("Search marketing tasks").fill(`QA ${key}`);
          await page
            .getByRole("button", { name: `QA ${key}`, exact: true })
            .click();
          await page
            .getByRole("dialog")
            .getByRole("button", { name: "Start work", exact: true })
            .click();
          await page
            .getByRole("button", { name: `QA ${key}`, exact: true })
            .click();
          const dialog = page.getByRole("dialog");
          if (key === "poster") {
            await dialog
              .getByRole("button", { name: "Submit for approval" })
              .click();
            await dialog
              .getByRole("alert")
              .filter({ hasText: "Add a proof file or work link" })
              .waitFor();
            await dialog
              .getByLabel("Published/work link")
              .fill("javascript:alert(1)");
            await dialog
              .getByRole("button", { name: "Submit for approval" })
              .click();
            await dialog
              .getByRole("alert")
              .filter({ hasText: "valid work link" })
              .waitFor();
            await dialog.getByLabel("Published/work link").fill("");
            await dialog
              .locator("input[type=file]")
              .setInputFiles({
                name: "too-large.txt",
                mimeType: "text/plain",
                buffer: Buffer.alloc(1_500_001),
              });
            await dialog
              .getByRole("alert")
              .filter({ hasText: "under 1.5 MB" })
              .waitFor();
            await dialog
              .locator("input[type=file]")
              .setInputFiles({
                name: "qa-proof.txt",
                mimeType: "text/plain",
                buffer: Buffer.from("QA proof only"),
              });
            await dialog
              .getByRole("button", { name: "qa-proof.txt", exact: true })
              .waitFor();
            const downloadEvent = page.waitForEvent("download");
            await dialog
              .getByRole("button", { name: "qa-proof.txt", exact: true })
              .click();
            const download = await downloadEvent;
            assert.equal(download.suggestedFilename(), "qa-proof.txt");
            assert.equal(
              fs.readFileSync(await download.path(), "utf8"),
              "QA proof only",
            );
          } else {
            await dialog
              .getByLabel("Published/work link")
              .fill(`https://example.com/qa/${key}`);
          }
          await dialog
            .getByLabel("Notes", { exact: true })
            .fill("Isolated QA record");
          await dialog
            .getByRole("button", { name: "Submit for approval" })
            .click();
          await dialog.waitFor({ state: "hidden" });
        }
        await page.reload();
        await page.waitForFunction(
          () =>
            JSON.parse(
              localStorage.getItem("oms-marketing-demo-data"),
            ).tasks.filter(
              (t) =>
                t.title.startsWith("QA ") && t.marketing_status === "submitted",
            ).length === 15,
        );
        const tasks = await savedTasks();
        assert.equal(
          tasks.filter(
            (t) =>
              t.title.startsWith("QA ") && t.marketing_status === "submitted",
          ).length,
          15,
        );
        assert.equal(
          await page
            .getByRole("button", { name: "Approve", exact: true })
            .count(),
          0,
          "employee cannot approve",
        );
        assert.equal(
          await page
            .getByRole("button", { name: "Publish", exact: true })
            .count(),
          0,
          "employee cannot publish",
        );
      },
    );
    await check(
      "Search, status, platform, date and reset filters",
      async () => {
        await page.getByLabel("Search marketing tasks").fill("QA facebook");
        assert.equal(await page.locator("tbody tr").count(), 1);
        await page.getByLabel("Status filter").selectOption("assigned");
        await page
          .getByText("No tasks match these filters.", { exact: true })
          .waitFor();
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await page.getByLabel("Platform filter").selectOption("Facebook");
        assert.equal(await page.locator("tbody tr").count(), 1);
        await page.getByLabel("From date", { exact: true }).fill("2026-10-01");
        await page
          .getByText("No tasks match these filters.", { exact: true })
          .waitFor();
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        assert.equal(await page.locator("tbody tr").count(), 22);
      },
    );
    await check(
      "Task deletion removes its attachment and activity without affecting other tasks",
      async () => {
        await page
          .getByRole("button", { name: "QA poster", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Delete task", exact: true })
          .click();
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        await page.waitForFunction(
          () =>
            !JSON.parse(
              localStorage.getItem("oms-marketing-demo-data"),
            ).tasks.some((t) => t.title === "QA poster"),
        );
        const data = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("oms-marketing-demo-data")),
        );
        assert.equal(data.tasks.length, 21);
        assert.equal(data.files.length, 0);
      },
    );
    await check(
      "Social month comparison, daily replacement, validation and persistence",
      async () => {
        await page
          .locator("aside")
          .getByRole("link", { name: "Followers & Community", exact: true })
          .click();
        await waitHeading("Followers & Community");
        await page
          .getByRole("heading", { name: "Social media daily tracker" })
          .waitFor();
        assert.equal(
          await page
            .getByRole("button", { name: "QA followers", exact: true })
            .count(),
          1,
          "community task remains accessible",
        );
        for (const platform of ["Instagram", "Facebook", "LinkedIn"]) {
          await page
            .getByRole("button", { name: platform, exact: true })
            .click();
          for (const [date, followers, posts] of [
            ["2026-08-31", "1000", "2"],
            ["2026-09-01", "1050", "3"],
            ["2026-09-24", "1100", "4"],
          ]) {
            await page.getByLabel("Update date", { exact: true }).fill(date);
            await page
              .getByLabel("Current followers", { exact: true })
              .fill(followers);
            await page
              .getByLabel("Content posted today", { exact: true })
              .fill(posts);
            await page
              .getByRole("button", { name: "Save daily update" })
              .click();
          }
        }
        await page
          .getByLabel("Current followers", { exact: true })
          .fill("1120");
        await page.getByRole("button", { name: "Save daily update" }).click();
        const rows = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("oms-marketing-social-updates-v1")),
        );
        assert.equal(rows.length, 9, "same date is upserted");
        const cards = await page.locator("article").allInnerTexts();
        assert.match(cards[0], /\+100/);
        assert.match(cards[1], /\+100/);
        assert.match(cards[2], /\+120/);
        for (const text of cards) assert.match(text, /Content this month\s+7/);
        await page.getByLabel("Current followers", { exact: true }).fill("1.5");
        await page.getByRole("button", { name: "Save daily update" }).click();
        await page
          .getByRole("alert")
          .filter({ hasText: "whole numbers" })
          .waitFor();
        await page
          .getByLabel("Reporting month", { exact: true })
          .fill("2026-08");
        for (const text of await page.locator("article").allInnerTexts()) {
          assert.match(text, /No baseline/);
          assert.match(text, /Content this month\s+2/);
        }
        await page.reload();
        await page
          .getByRole("heading", { name: "Social media daily tracker" })
          .waitFor();
        await page.waitForFunction(() =>
          document.querySelector("article")?.textContent.includes("1,100"),
        );
        assert.match(await page.locator("article").nth(2).innerText(), /1,120/);
        await page
          .getByRole("button", {
            name: "Edit Instagram update for 24 Sept 2026",
          })
          .click();
        assert.equal(
          await page
            .getByLabel("Content posted today", { exact: true })
            .inputValue(),
          "4",
        );
        await page
          .getByRole("button", {
            name: "Delete Instagram update for 24 Sept 2026",
          })
          .click();
        assert.match(await page.locator("article").first().innerText(), /\+50/);
        await page.screenshot({
          path: path.join(out, "social-desktop.png"),
          fullPage: true,
        });
      },
    );
    await check(
      "Responsive dashboard, dialogs, task list and social pages",
      async () => {
        for (const width of [375, 768, 1280, 1920]) {
          await page.setViewportSize({
            width,
            height: width < 768 ? 844 : 1080,
          });
          for (const [key, url] of [
            ["dashboard", "/marketing-preview"],
            ["tasks", "/marketing-preview?view=work"],
            ["social", "/marketing-preview?view=work&category=followers"],
          ]) {
            await page.goto(base + url);
            await page.locator("main h1").waitFor();
            await page.waitForTimeout(250);
            await noOverflow();
            await page.screenshot({
              path: path.join(out, `${key}-${width}.png`),
              fullPage: true,
            });
          }
          if (width < 768) {
            await page
              .getByRole("combobox", { name: /^Task category/ })
              .selectOption("video");
            await waitHeading("Videos");
          }
          await page.goto(`${base}/marketing-preview`);
          await page
            .getByRole("button", { name: "New task", exact: true })
            .click();
          await page.getByRole("dialog", { name: "Add new task" }).waitFor();
          const bounds = await page.getByRole("dialog").boundingBox();
          assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
          await page
            .getByRole("button", { name: "Add task", exact: true })
            .scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(out, `modal-${width}.png`) });
          await page.keyboard.press("Escape");
        }
      },
    );
    await check(
      "Profile keyboard/outside dismissal, logout and saved-data retention",
      async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        const trigger = page.getByRole("button", {
          name: "Saqib profile menu",
          exact: true,
        });
        await trigger.focus();
        await page.keyboard.press("ArrowDown");
        assert.equal(
          await page
            .getByRole("menuitem", { name: "Logout", exact: true })
            .evaluate((el) => el === document.activeElement),
          true,
        );
        await noOverflow();
        await page.keyboard.press("Escape");
        assert.equal(await page.getByRole("menu").count(), 0);
        assert.equal(
          await trigger.evaluate((el) => el === document.activeElement),
          true,
        );
        await trigger.click();
        await page
          .getByRole("heading", { name: "Digital Marketing Dashboard" })
          .click();
        assert.equal(await page.getByRole("menu").count(), 0);
        const before = await page.evaluate(() => [
          localStorage.getItem("oms-marketing-demo-data"),
          localStorage.getItem("oms-marketing-social-updates-v1"),
        ]);
        await trigger.click();
        await page
          .getByRole("menuitem", { name: "Logout", exact: true })
          .click();
        await page.waitForURL("**/login");
        assert.equal(
          await page.evaluate(() =>
            localStorage.getItem("oms-marketing-demo-session"),
          ),
          null,
        );
        assert.deepEqual(
          await page.evaluate(() => [
            localStorage.getItem("oms-marketing-demo-data"),
            localStorage.getItem("oms-marketing-social-updates-v1"),
          ]),
          before,
        );
      },
    );
    await check(
      "No uncaught browser errors during the tested workflow",
      async () => assert.deepEqual(errors, []),
    );
  } catch (error) {
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(
      path.join(out, "marketing-qa.json"),
      JSON.stringify(
        { results, errors, checkedAt: new Date().toISOString() },
        null,
        2,
      ),
    );
    await browser.close();
  }
})();
