import { beforeEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { setExtractedClassesForSession } from "../../lib/extractedClassesStorage";
import { setStudentsForDay } from "../../lib/storage";
import { setStorageScope } from "../../lib/storageScope";
import { fetchRosterEdits, fetchSchematic } from "../../lib/serverApi";
import { loadExportCourses } from "./loadExportCourses";
import { classes, session, students } from "./fixtures";
vi.mock(
    "../../lib/serverApi",
    () => ({ fetchRosterEdits: vi.fn(), fetchSchematic: vi.fn() }),
);
beforeEach(() => {
    vi.stubGlobal("crypto", webcrypto);
    window.sessionStorage.clear();
    setStorageScope("export-test");
    setExtractedClassesForSession(session.id, classes);
    setStudentsForDay("Fr", students);
    vi.mocked(fetchSchematic).mockReset().mockResolvedValue(
        {
            schematic: {
                data: {
                    codes: ["004201,004202", "004203"],
                    instructors: ["Lee", "Sam"],
                },
            },
        } as Awaited<ReturnType<typeof fetchSchematic>>,
    );
    vi.mocked(fetchRosterEdits).mockReset().mockResolvedValue({
        rosterEdits: [{ code: "004201", level: "Splash2A" }],
        studentEdits: [],
    });
});
it("uses loaded classes, current saved assignments and edited swimmer levels", async () => {
    const result = await loadExportCourses(session, false);
    expect(result[0].instructor).toBe("Lee");
    expect(result[0].students.every((student) => student.level === "Splash2A"))
        .toBe(true);
    expect(result[0].students).toHaveLength(2);
    expect(fetchSchematic).toHaveBeenCalledWith(session.id);
});
it("never falls back to stale assignments when the server request fails", async () => {
    vi.mocked(fetchSchematic).mockRejectedValue(new Error("offline"));
    await expect(loadExportCourses(session, false)).rejects.toThrow("offline");
});
it("exports the guest loaded session without a network dependency", async () => {
    expect(await loadExportCourses(session, true)).toHaveLength(3);
    expect(fetchSchematic).not.toHaveBeenCalled();
    expect(fetchRosterEdits).not.toHaveBeenCalled();
});
it("does not export other loaded classes on the same day", async () => {
    setStudentsForDay("Fr", [...students, {
        ...students[0],
        code: "other-session-class",
        name: "Excluded",
    }]);
    const result = await loadExportCourses(session, true);
    expect(
        result.flatMap((course) => course.students).some((student) =>
            student.name === "Excluded"
        ),
    ).toBe(false);
});

it("rejects rows loaded for a different session on the same weekday", async () => {
    const { setLoadedRosterSession } = await import(
        "../../lib/loadedRosterSession"
    );
    setLoadedRosterSession("Fr", "another-session");
    await expect(loadExportCourses(session, true)).rejects.toThrow(
        "another session",
    );
});
