// Disposable local environment only: scripts/instructor-qa.sh must be running.
import { chromium } from "playwright-core";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:18082",
    sid = "20000000-0000-0000-0000-000000000004";
const out = resolve(process.env.QA_OUTPUT_DIR || "docs/qa/cycle-2/screenshots");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
});
async function loginAPI(context, email) {
    const response = await context.request.post(base + "/api/auth/sign-in", {
        data: { email, password: "Synthetic-test-only-42!" },
    });
    assert.equal(response.status(), 200);
}
async function classes(context) {
    return (await (await context.request.get(
        base + `/api/instructor/sessions/${sid}/classes`,
    )).json()).classes;
}
async function changeAndSave(page, action) {
    await Promise.all([
        page.waitForResponse((r) =>
            r.url() === base + `/api/sessions/${sid}` &&
            r.request().method() === "PATCH" && r.status() === 200
        ),
        action(),
    ]);
    await page.getByRole("status").filter({ hasText: /^Saved$/ }).waitFor();
}
const result = {};
try {
    const supervisor = await browser.newContext({
            viewport: { width: 1440, height: 1000 },
        }),
        page = await supervisor.newPage();
    await page.goto(base + "/sign-in");
    await page.getByPlaceholder("Email", { exact: true }).fill(
        "supervisor@example.invalid",
    );
    await page.getByPlaceholder("Password", { exact: true }).fill(
        "Synthetic-test-only-42!",
    );
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(base + "/");
    await page.getByRole("button", {
        name: "Select Existing Session",
        exact: true,
    }).click();
    await page.getByRole("button").filter({ hasText: "Synthetic Pool A" })
        .click();
    const a = await browser.newContext(), b = await browser.newContext();
    await loginAPI(a, "instructor-a@example.invalid");
    await loginAPI(b, "instructor-b@example.invalid");
    const original = (await classes(a)).find((c) => c.code === "A");
    assert.ok(original);
    const seed = await a.request.put(
        base +
            `/api/instructor/sessions/${sid}/classes/${original.id}/plans/2026-10-05`,
        {
            data: {
                curriculum_level: "Splash1",
                rows: [{
                    skill: "mobile floating practice",
                    activity: "Practice floating",
                    location: "Shallow end",
                    duration: 10,
                }],
            },
        },
    );
    assert.equal(seed.status(), 200);
    const oldRoster = (await (await supervisor.request.get(
        base + `/api/sessions/${sid}/instructors`,
    )).json()).instructors;
    const allClasses = [...await classes(a), ...await classes(b)];
    const assignments = oldRoster.map((row) => ({
        id: row.id,
        instructor_id: row.id,
        name: row.name,
        classes: allClasses.filter((c) => c.assignment_id === row.id).map((
            c,
        ) => ({
            code: c.code,
            level: c.level,
            start_time: c.start_time,
            end_time: c.end_time,
        })),
    }));
    const saveSchematic = await supervisor.request.put(
        base + `/api/schematics/${sid}`,
        {
            data: {
                data: {
                    assignmentIds: assignments.map((row) => row.id),
                    instructorIds: assignments.map((row) => row.instructor_id),
                    instructors: assignments.map((row) => row.name),
                    codes: assignments.map((row) =>
                        row.classes.map((c) => c.code).join(",")
                    ),
                    assignments,
                },
            },
        },
    );
    assert.equal(saveSchematic.status(), 200);
    await page.goto(base + "/manage-sessions");
    const panel = page.getByRole("region", { name: "Session Instructors" });
    await panel.getByLabel("Number of instructors").waitFor();
    assert.equal(
        await panel.getByLabel("Number of instructors").inputValue(),
        "2",
    );
    assert.equal(
        await page.getByRole("button", { name: "Save Changes", exact: true })
            .count(),
        1,
    );
    assert.equal(
        await page.getByRole("button", { name: "Save link", exact: true })
            .count(),
        0,
    );
    await changeAndSave(
        page,
        () => panel.getByLabel("Instructor 1 name").fill("Renamed Alex"),
    );
    await page.reload();
    await panel.getByLabel("Instructor 1 name").waitFor();
    assert.equal(
        await panel.getByLabel("Instructor 1 name").inputValue(),
        "Renamed Alex",
    );
    result.nameAutosave = true;
    const first = panel.getByRole("group", {
        name: "Instructor 1",
        exact: true,
    });
    await changeAndSave(
        page,
        () =>
            first.getByRole("button", { name: "Unlink", exact: true }).click(),
    );
    assert.equal((await classes(a)).length, 0);
    result.unlinkHidesClasses = true;
    await first.getByLabel("Optional account for instructor 1").fill(
        "instructor-b@example.invalid",
    );
    await first.getByRole("button", { name: "Search", exact: true }).click();
    await changeAndSave(
        page,
        () =>
            first.getByRole("button", { name: "Select account", exact: true })
                .click(),
    );
    const transferred = (await classes(b)).find((c) => c.code === "A");
    assert.equal(transferred.id, original.id);
    const plan = await b.request.get(
        base +
            `/api/instructor/sessions/${sid}/classes/${transferred.id}/plans/2026-10-05`,
    );
    assert.equal(plan.status(), 200);
    assert.equal(
        (await plan.json()).plan.rows[0].skill,
        "mobile floating practice",
    );
    result.reassignmentRetainsSavedPlan = true;
    await first.scrollIntoViewIfNeeded();
    await page.screenshot({
        path: resolve(out, "combined-session-instructors.png"),
        fullPage: true,
    });
    const count = panel.getByLabel("Number of instructors");
    await changeAndSave(page, async () => {
        await count.fill("3");
        await count.press("Enter");
    });
    const third = panel.getByRole("group", {
        name: "Instructor 3",
        exact: true,
    });
    assert.equal(await third.getByLabel("Instructor 3 name").inputValue(), "");
    await third.getByLabel("Optional account for instructor 3").fill(
        "instructor-a@example.invalid",
    );
    await third.getByRole("button", { name: "Search", exact: true }).click();
    await changeAndSave(
        page,
        () =>
            third.getByRole("button", { name: "Select account", exact: true })
                .click(),
    );
    const expanded = (await (await supervisor.request.get(
        base + `/api/sessions/${sid}/instructors`,
    )).json()).instructors;
    assert.equal(expanded.length, 3);
    assert.ok(expanded[2].account_id.endsWith("07"));
    assert.equal(expanded[2].class_count, 0);
    result.blankRowsAndLinksBeforeScheduling = true;
    await page.route(`**/api/sessions/${sid}`, (route) => route.abort(), {
        times: 1,
    });
    await panel.getByLabel("Instructor 1 name").fill("Retained after failure");
    await page.getByRole("status").filter({ hasText: /retry/ }).waitFor();
    assert.equal(
        await panel.getByLabel("Instructor 1 name").inputValue(),
        "Retained after failure",
    );
    await changeAndSave(
        page,
        () =>
            page.getByRole("button", { name: "Save Changes", exact: true })
                .click(),
    );
    result.failedAutosaveRetainsDraftAndRetries = true;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Collapse sidebar", exact: true })
        .click();
    await panel.scrollIntoViewIfNeeded();
    await panel.screenshot({
        path: resolve(out, "mobile-session-instructors.png"),
    });
    // Inspect the panel itself; the existing app shell has a separate scroll container.
    assert.ok(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth));
    result.instructorRowsFitNarrowScreen = true;
    page.once("dialog", (dialog) => dialog.accept());
    await changeAndSave(page, async () => {
        await count.fill("0");
        await count.press("Enter");
    });
    assert.equal((await classes(b)).length, 0);
    const retained =
        (await (await supervisor.request.get(base + `/api/schematics/${sid}`))
            .json()).schematic.data;
    assert.equal(retained.codes[0], "A,B");
    assert.equal(retained.instructors[0], "");
    assert.equal(retained.instructorIds[0], null);
    const old = await b.request.get(
        base +
            `/api/instructor/sessions/${sid}/classes/${transferred.id}/plans/2026-10-05`,
    );
    assert.equal(old.status(), 403);
    result.removalPreservesPositionsAndRevokesAccess = true;
    // Restore the rows with fresh identities and reuse the same class IDs and saved plans.
    const restored = oldRoster.map((row, index) => ({
        id: `70000000-0000-0000-0000-00000000000${index + 1}`,
        name: row.name,
        account_id: row.account_id,
    }));
    assert.equal(
        (await supervisor.request.patch(base + `/api/sessions/${sid}`, {
            data: { instructor_roster: restored },
        })).status(),
        200,
    );
    assignments.forEach((row, index) => {
        row.instructor_id = restored[index].id;
    });
    assert.equal(
        (await supervisor.request.put(base + `/api/schematics/${sid}`, {
            data: {
                data: {
                    ...retained,
                    instructorIds: restored.map((row) => row.id),
                    assignments,
                },
            },
        })).status(),
        200,
    );
    assert.equal(
        (await a.request.get(
            base +
                `/api/instructor/sessions/${sid}/classes/${original.id}/plans/2026-10-05`,
        )).status(),
        200,
    );
    result.removedInstructorPlanSurvivesReassignment = true;
    await writeFile(
        resolve(out, "link-results.json"),
        JSON.stringify(result, null, 2),
    );
    console.log(result);
    await supervisor.close();
    await a.close();
    await b.close();
} finally {
    await browser.close();
}
