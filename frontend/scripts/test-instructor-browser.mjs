// Disposable local environment only: scripts/instructor-qa.sh must be running.
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:18082";
const output = resolve(process.argv[2] || "../docs/qa/cycle-2/screenshots");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
});
const evidence = [];
async function login(page, email) {
    await page.goto(base + "/sign-in");
    await page.getByPlaceholder("Email", { exact: true }).fill(email);
    await page.getByPlaceholder("Password", { exact: true }).fill(
        "Synthetic-test-only-42!",
    );
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(base + "/");
    await page.getByRole("link", { name: "Instructor View", exact: true })
        .click();
    await page.getByRole("heading", { name: "Home", exact: true }).waitFor();
}
try {
    for (
        const [name, viewport] of [["desktop", { width: 1440, height: 1000 }], [
            "mobile",
            { width: 390, height: 844 },
        ]]
    ) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        await login(page, "instructor-a@example.invalid");
        await page.getByRole("button", { name: /Fall 2026/ }).first().waitFor();
        assert.equal(
            await page.getByRole("combobox", { name: "Session", exact: true })
                .count(),
            0,
        );
        assert.equal(
            await page.evaluate(() =>
                document.documentElement.scrollWidth <= innerWidth
            ),
            true,
        );
        await page.screenshot({
            path: resolve(output, `${name}-home.png`),
            fullPage: true,
        });
        await page.getByRole("button", { name: /Fall 2026/ }).first().click();
        await page.getByRole("link", { name: /Plan Swimmer 1/ }).waitFor();
        assert.equal(
            await page.getByText("Other instructor private class", {
                exact: true,
            })
                .count(),
            0,
        );
        await page.screenshot({
            path: resolve(output, `${name}-my-classes.png`),
            fullPage: true,
        });
        const firstClass = await page.getByRole("link", {
            name: /Plan Swimmer 1/,
        })
            .getAttribute("href");
        await page.getByRole("link", { name: "Home", exact: true }).click();
        await page.getByRole("button", { name: /Fall 2026/ }).nth(1).click();
        await page.getByRole("link", { name: /Plan Swimmer 1/ }).waitFor();
        const secondClass = await page.getByRole("link", {
            name: /Plan Swimmer 1/,
        })
            .getAttribute("href");
        assert.notEqual(firstClass, secondClass);
        await page.reload();
        await page.getByRole("link", { name: /Plan Swimmer 1/ }).waitFor();
        assert.equal(
            await page.evaluate(() =>
                new URLSearchParams(location.search).get("session")
            ),
            "20000000-0000-0000-0000-000000000005",
        );
        await page.getByRole("link", { name: "Home", exact: true }).click();
        await page.getByRole("button", { name: /Fall 2026/ }).first().click();
        await page.getByRole("link", { name: /Plan Swimmer 1/ }).click();
        await page.getByRole("button", { name: "Add activity", exact: true })
            .waitFor();
        const old = await page.getByLabel("Skill 1", { exact: true }).count();
        if (!old) {
            await page.getByRole("button", {
                name: "Add activity",
                exact: true,
            })
                .click();
        }
        if (
            await page.getByLabel("Curriculum level", { exact: true }).count()
        ) {
            await page.getByLabel("Curriculum level", { exact: true })
                .selectOption(
                    "Splash1",
                );
        }
        await page.getByLabel("Skill 1", { exact: true }).selectOption(
            "Float on front and back (5 sec. each)",
        );
        await page.getByLabel("Activity / drill 1", { exact: true }).fill(
            `Practice supported floats with clear cues and feedback. ${name} ${Date.now()}`,
        );
        await page.route("**/plans/*", async (route) => {
            if (route.request().method() === "PUT") {
                await route.abort();
                await page.unroute("**/plans/*");
            } else await route.continue();
        });
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await page.getByRole("alert").filter({
            hasText: "Your draft is retained",
        })
            .waitFor();
        assert.equal(
            await page.getByLabel("Skill 1", { exact: true }).inputValue(),
            "Float on front and back (5 sec. each)",
        );
        page.once("dialog", (d) => d.dismiss());
        await page.getByRole("link", { name: "Attendance", exact: true })
            .click();
        assert.equal(
            await page.getByLabel("Skill 1", { exact: true }).inputValue(),
            "Float on front and back (5 sec. each)",
        );
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await page.getByText("Lesson plan saved.", { exact: true }).waitFor();
        await page.reload();
        await page.getByLabel("Skill 1", { exact: true }).waitFor();
        assert.equal(
            await page.getByLabel("Skill 1", { exact: true }).inputValue(),
            "Float on front and back (5 sec. each)",
        );
        await page.screenshot({
            path: resolve(output, `${name}-saved-plan.png`),
            fullPage: true,
        });
        await page.getByLabel("Week", { exact: true }).selectOption(
            "2026-10-12",
        );
        await page.getByText(/No lesson plan saved for this week/).waitFor();
        assert.equal(
            await page.getByLabel("Skill 1", { exact: true }).count(),
            0,
        );
        await page.getByRole("link", { name: "Print", exact: true }).click();
        await page.getByRole("button", { name: "Preview PDF", exact: true })
            .waitFor();
        await page.screenshot({
            path: resolve(output, `${name}-print.png`),
            fullPage: true,
        });
        if (name === "desktop") {
            const newPage = context.waitForEvent("page");
            await page.getByRole("button", { name: "Preview PDF", exact: true })
                .click();
            const preview = await newPage;
            await preview.getByText("Weekly lesson plan", { exact: true })
                .waitFor({
                    timeout: 20000,
                });
            await preview.screenshot({
                path: resolve(output, "desktop-pdf-preview.png"),
                fullPage: true,
            });
            await preview.close();
        }
        await page.getByRole("link", { name: "Attendance", exact: true })
            .click();
        await page.getByText(/Attendance is coming later/).waitFor();
        await page.getByRole("button", { name: "Logout", exact: true }).click();
        await page.waitForURL(base + "/sign-in");
        await page.goto(base + "/instructor");
        await page.getByText("Sign in to Instructor View", { exact: true })
            .waitFor();
        const denied = await context.request.get(
            base + "/api/instructor/sessions",
        );
        assert.equal(denied.status(), 401);
        evidence.push({
            viewport: name,
            sameWeekdaySessionsDistinct: true,
            reloadPreservesSelection: true,
            saveFailurePreservesDraft: true,
            unsavedNavigationCancelled: true,
            saveReloadPersisted: true,
            untouchedWeekNull: true,
            guestApiStatus: denied.status(),
        });
        await context.close();
    }
    const unlinked = await browser.newContext({
        viewport: { width: 390, height: 844 },
    });
    const page = await unlinked.newPage();
    await login(page, "unlinked@example.invalid");
    await page.getByText(/No sessions are linked/).waitFor();
    await page.screenshot({
        path: resolve(output, "mobile-unlinked.png"),
        fullPage: true,
    });
    await unlinked.close();
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await login(otherPage, "instructor-b@example.invalid");
    await otherPage.getByRole("button", { name: /Fall 2026/ }).first().click();
    await otherPage.getByRole("link", {
        name: /Other instructor private class/,
    })
        .waitFor();
    assert.equal(
        await otherPage.getByRole("link", { name: /Plan Swimmer 1/ }).count(),
        0,
    );
    const response = await other.request.get(
        base +
            "/api/instructor/sessions/20000000-0000-0000-0000-000000000004/classes",
    );
    const classes = (await response.json()).classes;
    const a = await browser.newContext();
    const aPage = await a.newPage();
    await login(aPage, "instructor-a@example.invalid");
    const denied = await a.request.get(
        base +
            `/api/instructor/sessions/20000000-0000-0000-0000-000000000004/classes/${
                classes[0].id
            }/plans/2026-10-05`,
    );
    assert.equal(denied.status(), 403);
    await aPage.goto(
        base +
            `/api/instructor/sessions/20000000-0000-0000-0000-000000000004/classes/${
                classes[0].id
            }/plans/2026-10-05`,
    );
    await aPage.screenshot({
        path: resolve(output, "cross-account-denied.png"),
    });
    evidence.push({
        crossAccountPlanStatus: denied.status(),
        duplicateNamesIsolated: true,
        unlinkedEmpty: true,
    });
    await a.close();
    await other.close();
    await writeFile(
        resolve(output, "results.json"),
        JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify(evidence, null, 2));
} finally {
    await browser.close();
}
