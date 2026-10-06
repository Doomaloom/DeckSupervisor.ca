// Isolated visual/integration checks: real components, synthetic API and account.
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const output = resolve(process.argv[2] || "/tmp/activity-library-qa");
const fixture = "/__activity-library-fixture.tsx";
const session = {
    id: "qa-session",
    session_day: "Monday",
    session_season: "Fall",
    session_year: 2026,
    location: "QA pool",
    start_date: "2026-10-05",
    end_date: "2026-10-26",
    weeks: ["2026-10-05"],
};
const course = {
    id: "qa-class",
    session_id: session.id,
    assignment_id: "qa",
    instructor: "Synthetic Instructor",
    code: "QA",
    level: "Splash Private",
    start_time: "09:00:00",
    end_time: "09:30:00",
};
const server = await createServer({
    root,
    server: { host: "127.0.0.1", port: 0 },
    appType: "custom",
    plugins: [{
        name: "activity-library-fixture",
        enforce: "pre",
        resolveId(id) {
            if (id === fixture) return fixture;
        },
        load(id) {
            if (
                id.endsWith("/src/app/AuthContext.tsx")
            ) {
                return `export const useAuth=()=>({user:{id:'qa-only'},loading:false,workflowCapabilities:{instructor:true,supervisor:false},signOut:async()=>{}})`;
            }
            if (id.endsWith("/src/lib/serverApi.ts")) {
                return `
      let plan=null;
      export const fetchInstructorSessions=async()=>({sessions:[${
                    JSON.stringify(session)
                }]});
      export const fetchInstructorClasses=async()=>({classes:[${
                    JSON.stringify(course)
                }]});
      export const fetchLessonPlan=async()=>({plan});
      export const saveLessonPlan=async(_s,_c,week,rows,curriculum_level)=>{plan={week,rows:structuredClone(rows),curriculum_level};return {plan}};
    `;
            }
            if (id === fixture) {
                return `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {createBrowserRouter,RouterProvider,Outlet} from 'react-router-dom';
      import InstructorLayout from '/src/features/instructor/InstructorLayout';
      import ActivityLibrary from '/src/features/activity-library/ActivityLibrary';
      import LessonPlans from '/src/features/instructor/LessonPlans';
      import '/src/styles/index.css';
      createRoot(document.getElementById('root')).render(<React.StrictMode><RouterProvider router={createBrowserRouter([
        {element:<InstructorLayout><Outlet/></InstructorLayout>,children:[
          {path:'/instructor/activity-library',element:<ActivityLibrary/>},
          {path:'/instructor/lesson-plans',element:<LessonPlans/>}
        ]}
      ])}/></React.StrictMode>);
    `;
            }
        },
        configureServer(vite) {
            return () =>
                vite.middlewares.use(async (request, response, next) => {
                    if (!request.url?.startsWith("/instructor/")) {
                        return next();
                    }
                    response.setHeader("Content-Type", "text/html");
                    response.end(
                        await vite.transformIndexHtml(
                            request.url,
                            `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body><div id="root"></div><script type="module" src="${fixture}"></script></body></html>`,
                        ),
                    );
                });
        },
    }],
});
let browser;
try {
    await mkdir(output, { recursive: true });
    await server.listen();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
        headless: true,
        args: ["--no-sandbox"],
    });
    const evidence = [];
    for (
        const [name, viewport] of [["desktop", { width: 1440, height: 1000 }], [
            "mobile",
            { width: 390, height: 844 },
        ]]
    ) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(base + "/instructor/activity-library");
        await page.getByRole("heading", {
            name: "Activity Library",
            exact: true,
        })
            .waitFor();
        await page.getByText("No session selected", { exact: true }).waitFor();
        assert.equal(
            await page.getByRole("link", { name: "Choose a session" }).count(),
            0,
        );
        assert.equal(
            await page.getByRole("status").textContent(),
            "121 activities",
        );
        assert.equal(
            await page.evaluate(() =>
                document.documentElement.scrollWidth <= innerWidth
            ),
            true,
        );
        await page.screenshot({
            path: resolve(output, `${name}-library.png`),
            fullPage: true,
        });
        await page.getByRole("button", { name: "Workouts", exact: true })
            .click();
        await page.getByText("13-18 years: Interval workout 2", { exact: true })
            .click();
        await page.screenshot({
            path: resolve(output, `${name}-workouts.png`),
            fullPage: true,
        });
        await page.goto(
            base + "/instructor/lesson-plans?session=qa-session&class=qa-class",
        );
        await page.getByLabel("Curriculum level").selectOption("Splash1");
        await page.getByRole("button", { name: "Add activity", exact: true })
            .click();
        await page.getByLabel("Skill 1", { exact: true }).selectOption({
            label: "Submerge & exhale ×5",
        });
        await page.getByLabel("Activity / drill 1", { exact: true }).fill(
            "Existing draft",
        );
        await page.getByLabel("Duration (minutes) 1", { exact: true }).fill(
            "12",
        );
        const trigger = page.getByRole("button", {
            name: "Browse library for row 1",
        });
        await trigger.click();
        let dialog = page.getByRole("dialog", { name: "Activity Library" });
        await dialog.waitFor();
        // Native dialog makes the background inert, traps focus, and supports Escape.
        assert.equal(
            await page.evaluate(() =>
                document.querySelector("dialog").matches(":modal")
            ),
            true,
        );
        assert.equal(
            await page.evaluate(() =>
                document.activeElement?.getAttribute("aria-label")
            ),
            "Close activity library",
        );
        await page.keyboard.press("Shift+Tab");
        assert.equal(
            await page.evaluate(() =>
                document.querySelector("dialog").contains(
                    document.activeElement,
                )
            ),
            true,
        );
        await page.keyboard.press("Tab");
        assert.equal(
            await page.evaluate(() =>
                document.querySelector("dialog").contains(
                    document.activeElement,
                )
            ),
            true,
        );
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "detached" });
        assert.equal(
            await page.evaluate(() =>
                document.activeElement?.getAttribute("aria-label")
            ),
            "Browse library for row 1",
        );
        assert.equal(
            await page.getByLabel("Activity / drill 1", { exact: true })
                .inputValue(),
            "Existing draft",
        );
        await trigger.click();
        dialog = page.getByRole("dialog", { name: "Activity Library" });
        await dialog.getByRole("checkbox", {
            name: "Only activities for Submerge & exhale ×5",
        }).check();
        await dialog.getByRole("searchbox").fill("Five Little Ducks");
        await dialog.getByText("Five Little Ducks", { exact: true }).click();
        await page.screenshot({
            path: resolve(output, `${name}-picker.png`),
            fullPage: false,
        });
        assert.equal(
            await page.evaluate(() =>
                document.documentElement.scrollWidth <= innerWidth
            ),
            true,
        );
        assert.equal(
            await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
            true,
        );
        assert.equal(
            await dialog.evaluate((el) =>
                el.getBoundingClientRect().width <= innerWidth &&
                el.getBoundingClientRect().height <= innerHeight
            ),
            true,
        );
        page.once("dialog", (prompt) => prompt.dismiss());
        await dialog.getByRole("button", { name: "Use Five Little Ducks" })
            .click();
        assert.equal(
            await page.getByLabel("Activity / drill 1", { exact: true })
                .inputValue(),
            "Existing draft",
        );
        page.once("dialog", (prompt) => prompt.accept());
        await dialog.getByRole("button", { name: "Use Five Little Ducks" })
            .click();
        await dialog.waitFor({ state: "detached" });
        const inserted = await page.getByLabel("Activity / drill 1", {
            exact: true,
        }).inputValue();
        assert.match(inserted, /Five Little Ducks/);
        assert.match(inserted, /blow bubbles/);
        assert.equal(
            await page.getByLabel("Duration (minutes) 1", { exact: true })
                .inputValue(),
            "12",
        );
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await page.getByText("Lesson plan saved.", { exact: true }).waitFor();
        await page.getByRole("link", { name: "Activity Library", exact: true })
            .click();
        await page.getByRole("link", { name: "Lesson Plans", exact: true })
            .click();
        await page.getByLabel("Activity / drill 1", { exact: true }).waitFor();
        assert.equal(
            await page.getByLabel("Activity / drill 1", { exact: true })
                .inputValue(),
            inserted,
        );
        assert.equal(
            await page.getByRole("button", { name: "Build workout for row 1" })
                .count(),
            0,
        );
        await page.getByLabel("Curriculum level").selectOption("SplashFitness");
        await page.getByLabel("Skill 1", { exact: true }).selectOption({
            label: "Workout 300m",
        });
        await page.getByRole("button", { name: "Build workout for row 1" })
            .click();
        const workoutDialog = page.getByRole("dialog", {
            name: "Workout builder",
        });
        await workoutDialog.waitFor();
        assert.equal(
            await workoutDialog.evaluate((el) => el.matches(":modal")),
            true,
        );
        await workoutDialog.getByLabel("Choose warm-up preset").selectOption(
            "young-1-warm",
        );
        await workoutDialog.getByLabel("Choose main set preset").selectOption(
            "young-1-main",
        );
        await workoutDialog.getByLabel("Choose cool-down preset").selectOption(
            "young-1-cool",
        );
        await workoutDialog.getByLabel("Main set 1 repetitions", {
            exact: true,
        })
            .fill("3");
        await workoutDialog.getByLabel("Main set 1 timing", { exact: true })
            .selectOption("rest");
        await workoutDialog.getByLabel("Main set 1 timing seconds", {
            exact: true,
        })
            .fill("15");
        await workoutDialog.getByLabel("Workout title").fill(
            "Edited PDF workout",
        );
        await workoutDialog.evaluate((el) => {
            el.scrollTop = 0;
        });
        await page.screenshot({
            path: resolve(output, `${name}-workout-builder.png`),
            fullPage: false,
        });
        assert.equal(
            await workoutDialog.evaluate((el) =>
                el.scrollWidth <= el.clientWidth
            ),
            true,
        );
        assert.equal(
            await workoutDialog.evaluate((el) =>
                el.getBoundingClientRect().width <= innerWidth &&
                el.getBoundingClientRect().height <= innerHeight
            ),
            true,
        );
        page.once("dialog", (prompt) => prompt.dismiss());
        await page.keyboard.press("Escape");
        assert.equal(await workoutDialog.count(), 1);
        page.once("dialog", (prompt) => prompt.dismiss());
        await workoutDialog.getByRole("button", {
            name: "Use workout",
            exact: true,
        }).click();
        assert.equal(
            await page.getByLabel("Activity / drill 1", { exact: true })
                .inputValue(),
            inserted,
        );
        page.once("dialog", (prompt) => prompt.accept());
        await workoutDialog.getByRole("button", {
            name: "Use workout",
            exact: true,
        }).click();
        await workoutDialog.waitFor({ state: "detached" });
        const workoutSummary = await page.getByLabel("Workout summary 1")
            .textContent();
        assert.match(workoutSummary, /Edited PDF workout/);
        assert.match(workoutSummary, /rest 15 seconds/);
        assert.match(workoutSummary, /Total distance: 525 m/);
        assert.equal(
            await page.getByLabel("Duration (minutes) 1", { exact: true })
                .inputValue(),
            "12",
        );
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await page.getByText("Lesson plan saved.", { exact: true }).waitFor();
        await page.getByRole("link", { name: "Activity Library", exact: true })
            .click();
        await page.getByRole("link", { name: "Lesson Plans", exact: true })
            .click();
        await page.getByRole("button", { name: "Edit workout for row 1" })
            .click();
        await workoutDialog.waitFor();
        assert.equal(
            await workoutDialog.getByLabel("Main set 1 repetitions", {
                exact: true,
            })
                .inputValue(),
            "3",
        );
        assert.equal(
            await workoutDialog.getByLabel("Main set 1 timing", { exact: true })
                .inputValue(),
            "rest",
        );
        await page.keyboard.press("Escape");
        await workoutDialog.waitFor({ state: "detached" });
        assert.equal(
            await page.evaluate(() =>
                document.activeElement?.getAttribute("aria-label")
            ),
            "Edit workout for row 1",
        );
        page.once("dialog", (prompt) => prompt.accept());
        await page.getByRole("button", {
            name: "Convert workout in row 1 to text",
        })
            .click();
        assert.equal(
            await page.getByLabel("Activity / drill 1", { exact: true })
                .inputValue(),
            workoutSummary,
        );
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await page.getByText("Lesson plan saved.", { exact: true }).waitFor();
        assert.deepEqual(errors, []);
        evidence.push({
            viewport: name,
            noSessionLibrary: true,
            modalFocusAndEscape: true,
            replacementConfirmed: true,
            savedTextReloaded: true,
            structuredWorkoutReloaded: true,
            workoutConversion: true,
            noOverflow: true,
            browserErrors: errors,
        });
        await context.close();
    }
    await writeFile(
        resolve(output, "results.json"),
        JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify(evidence, null, 2));
} finally {
    await browser?.close();
    await server.close();
}
