#!/usr/bin/env node
// Real route, loaded browser data, native browser downloads, and ID restore.
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";
import { transform } from "esbuild";
import { chromium } from "playwright-core";
const root = resolve(import.meta.dirname, "..");
const output = resolve(
    process.env.REC_TABLET_EXPORT_FIXTURES || `${root}/tmp/device-export-check`,
);
await mkdir(output, { recursive: true });
const fixtureJS = await transform(
    await readFile(
        resolve(root, "src/features/decksupervisor/DeviceExport/fixtures.ts"),
        "utf8",
    ),
    { loader: "ts", format: "esm" },
);
const fixtures = await import(
    `data:text/javascript;base64,${
        Buffer.from(fixtureJS.code).toString("base64")
    }`
);
const { session, students, classes } = fixtures;
const port = process.env.DEVICE_EXPORT_TEST_PORT || "5193";
const server = spawn(process.execPath, [
    resolve(root, "node_modules/vite/bin/vite.js"),
    "--host",
    "127.0.0.1",
    "--port",
    port,
    "--strictPort",
], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
server.stdout.on("data", (value) => {
    serverOutput += value;
});
server.stderr.on("data", (value) => {
    serverOutput += value;
});
let browser;
try {
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
        if (server.exitCode !== null) {
            throw new Error(`Vite exited: ${serverOutput}`);
        }
        try {
            if ((await fetch(base)).ok) {
                ready = true;
                break;
            }
        } catch {}
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    }
    assert(ready, "Vite did not start");
    browser = await chromium.launch({
        executablePath: process.env.CHROME_PATH || "/usr/bin/chromium",
        headless: true,
    });
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1100 },
        acceptDownloads: true,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route(
        "**/api/**",
        (route) => route.fulfill({ json: { session: null } }),
    );
    await page.addInitScript(({ session, classes, students }) => {
        if (sessionStorage.getItem("device-export-seeded")) return;
        sessionStorage.setItem("device-export-seeded", "true");
        sessionStorage.setItem("cob:storageScope", "guest");
        sessionStorage.setItem("cob:guest:currentSessionId", session.id);
        sessionStorage.setItem("cob:guest:selectedDay", session.session_day);
        sessionStorage.setItem(
            "cob:guest:sessions",
            JSON.stringify([{
                id: session.id,
                sessionDay: session.session_day,
                sessionSeason: session.session_season,
                sessionYear: session.session_year,
                startDate: session.start_date,
                endDate: session.end_date,
                location: session.location,
                sourceLocations: session.source_locations,
                instructors: session.instructors,
            }]),
        );
        sessionStorage.setItem(
            "cob:guest:extractedClassesBySession",
            JSON.stringify({ [session.id]: classes }),
        );
        sessionStorage.setItem(
            "cob:guest:studentsByDay",
            JSON.stringify({ [session.session_day]: students }),
        );
    }, { session, students, classes });
    await page.goto(`${base}/device-exports`);
    await page.getByRole("option", { name: "Alex", exact: true }).waitFor({
        state: "attached",
    });
    assert(
        await page.getByRole("link", { name: "Device Exports", exact: true })
            .count() > 0,
    );
    const exportButton = page.getByRole("button", {
        name: "Download instructor classes",
    });
    assert(await exportButton.isDisabled());
    const download = async (filename) => {
        await page.getByRole("combobox").selectOption("Alex");
        const pending = page.waitForEvent("download");
        await exportButton.click();
        const file = await pending;
        await file.saveAs(resolve(output, filename));
        return JSON.parse(await readFile(resolve(output, filename), "utf8"));
    };
    const initial = await download("initial.json");
    assert.equal(initial.courses.length, 2);
    assert.equal(initial.instructor, "Alex");
    assert(!JSON.stringify(initial).match(/phone|email|Waiting|Morgan|555-/));
    await page.locator("details").first().locator("summary").click();
    await page.screenshot({
        path: resolve(output, "device-exports.png"),
        fullPage: true,
    });
    const backupPending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download ID backup" }).click();
    await (await backupPending).saveAs(resolve(output, "ids.json"));
    await page.evaluate(() => localStorage.clear());
    await page.getByLabel("Restore ID backup").setInputFiles(
        resolve(output, "ids.json"),
    );
    await page.getByText("Export IDs restored for this session.").waitFor();
    assert.deepEqual(await download("restored.json"), initial);
    const updated = students.filter((student) => student.name !== "Johnny")
        .reverse().map((student, i) => ({
            ...student,
            id: `changed-${i}`,
            level: student.name === "Harrold" ? "Splash2A" : student.level,
        }));
    const updateRoster = async (rows) => {
        await page.evaluate((rows) => {
            sessionStorage.setItem(
                "cob:guest:studentsByDay",
                JSON.stringify({ Fr: rows }),
            );
            window.dispatchEvent(
                new CustomEvent("cob:guest:students-updated", {
                    detail: { day: "Fr" },
                }),
            );
        }, rows);
        await page.getByText("Loading classes and saved assignments…").waitFor({
            state: "hidden",
        });
    };
    await updateRoster(updated);
    const second = await download("updated.json");
    assert.equal(second.courses[0].swimmers.length, 1);
    assert.equal(
        second.courses[0].swimmers[0].sourceId,
        initial.courses[0].swimmers.find((student) =>
            student.name === "Harrold"
        )
            .sourceId,
    );
    await updateRoster(students);
    assert.deepEqual(await download("returned.json"), initial);
    await page.reload();
    await page.getByRole("option", { name: "Alex", exact: true }).waitFor({
        state: "attached",
    });
    assert.deepEqual(await download("reloaded.json"), initial);
    await page.evaluate(() => {
        sessionStorage.setItem(
            "cob:guest:currentSessionId",
            "unloaded-session",
        );
        window.dispatchEvent(
            new CustomEvent("cob:current-session-changed", {
                detail: { id: "unloaded-session" },
            }),
        );
    });
    await page.getByText(
        "Select a session and load its class data to export instructor lessons.",
    ).waitFor();
    assert.equal(await exportButton.count(), 0);
    assert.deepEqual(errors, []);
    console.log(
        `Browser route, downloads, reload, ID restore, roster updates and session switching passed. Artifacts: ${output}`,
    );
} finally {
    await browser?.close();
    server.kill("SIGTERM");
}
