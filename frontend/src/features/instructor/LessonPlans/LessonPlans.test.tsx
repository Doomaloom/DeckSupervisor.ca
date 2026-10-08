import { act, cleanup, fireEvent, render, screen, waitFor, within, } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { LessonEditor } from "./LessonPlans.component";
import { curriculumLevels, defaultWorkoutText } from "./lessonSkills";
const api = vi.hoisted(() => ({
    fetchLessonPlan: vi.fn(),
    saveLessonPlan: vi.fn(),
}));
vi.mock("../../../lib/serverApi", () => api);
beforeEach(() => {
    api.fetchLessonPlan.mockReset().mockResolvedValue({ plan: null });
    api.saveLessonPlan.mockReset().mockImplementation(
        async (_s, _c, _w, rows, curriculumLevel) => ({
            plan: { rows, curriculum_level: curriculumLevel },
        }),
    );
});
function setup(level = "Splash 1") {
    return render(
        <RouterProvider
            router={createMemoryRouter([{
                path: "/",
                element: (
                    <LessonEditor
                        sessionId="s"
                        classId="c"
                        week="2026-10-05"
                        level={level}
                        lessonDuration={30}
                    />
                ),
            }])}
        />,
    );
}
it("saves changed content once after 100 ms idle, without saving on load or repeating server responses", async () => {
    api.fetchLessonPlan.mockResolvedValue({
        plan: { rows: [{ skill: "", activity: "Practice", location: "Lane", duration: 5 }] },
    });
    api.saveLessonPlan.mockImplementation(async (_s, _c, _w, rows) => ({
        plan: {
            rows: rows.map((row: Record<string, unknown>) =>
                Object.fromEntries(Object.entries(row).reverse()))
        },
    }));
    setup();
    const activity = await screen.findByLabelText("Activity / drill 1");
    vi.useFakeTimers();
    try {
        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        expect(api.saveLessonPlan).not.toHaveBeenCalled();
        fireEvent.change(activity, { target: { value: "First edit" } });
        await act(async () => { await vi.advanceTimersByTimeAsync(99); });
        expect(api.saveLessonPlan).not.toHaveBeenCalled();
        fireEvent.change(activity, { target: { value: "Final edit" } });
        await act(async () => { await vi.advanceTimersByTimeAsync(99); });
        expect(api.saveLessonPlan).not.toHaveBeenCalled();
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        expect(api.saveLessonPlan).toHaveBeenCalledTimes(1);
        expect(api.saveLessonPlan.mock.lastCall?.[3][0].activity).toBe("Final edit");
        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        fireEvent.change(activity, { target: { value: "Final edit" } });
        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        expect(api.saveLessonPlan).toHaveBeenCalledTimes(1);
    } finally {
        cleanup();
        vi.useRealTimers();
    }
});
it("compares the total activity duration with the lesson length as rows change", async () => {
    api.fetchLessonPlan.mockResolvedValue({
        plan: {
            rows: [
                { skill: "", activity: "First", location: "Lane", duration: 12 },
                { skill: "", activity: "Second", location: "Lane", duration: 10 },
            ]
        }
    });
    const user = userEvent.setup();
    setup();
    expect(await screen.findByText("22 / 30 min planned")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Duration (minutes) 1"), { target: { value: "20" } });
    expect(screen.getByText("30 / 30 min planned")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Increase duration by 5 minutes for row 2" }));
    expect(screen.getByText("35 / 30 min planned")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Delete row 1" }));
    expect(screen.getByText("15 / 30 min planned")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add activity" }));
    expect(screen.getByText("20 / 30 min planned")).toBeVisible();
});
it("skips untouched rows and retries autosave after a new edit", async () => {
    const user = userEvent.setup();
    setup();
    const emptyPlan = await screen.findByText(/No lesson plan saved/);
    expect(emptyPlan.closest("tbody")).toBeInTheDocument();
    expect(emptyPlan.closest("td")).toHaveAttribute("colspan", "6");
    expect(emptyPlan.tagName).toBe("TD");
    expect(api.saveLessonPlan).not.toHaveBeenCalled();
    const addActivity = screen.getByRole("button", { name: "Add activity" });
    expect(addActivity.closest("tr")).toBe(addActivity.closest("tbody")?.lastElementChild);
    await user.click(addActivity);
    expect(screen.queryByText(/No lesson plan saved/)).not.toBeInTheDocument();
    expect(addActivity.closest("tr")).toBe(addActivity.closest("tbody")?.lastElementChild);
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(api.saveLessonPlan).not.toHaveBeenCalled();
    api.saveLessonPlan.mockRejectedValueOnce(new Error("Offline"));
    await user.selectOptions(
        screen.getByLabelText("Skill 1"),
        "Enter and Exit Shallow Water",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
        "Your draft is retained",
    );
    expect(screen.getByLabelText("Skill 1")).toHaveValue(
        "Enter and Exit Shallow Water",
    );
    await user.click(screen.getByRole("button", { name: "Custom activity for row 1" }));
    await user.type(screen.getByLabelText("Activity / drill 1"), "Practice");
    await waitFor(() => expect(api.saveLessonPlan.mock.lastCall?.[3][0].activity).toBe("Practice"));
    expect(screen.queryByText("All changes saved.")).not.toBeInTheDocument();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
});
it("selects pool location with tiles and saves the choice", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText(/No lesson plan saved/);
    await user.click(screen.getByRole("button", { name: "Add activity" }));
    const location = screen.getByRole("group", { name: "Pool location 1" });
    expect(within(location).getByRole("button", { name: "Lane" }))
        .toHaveAttribute("aria-pressed", "true");
    await user.click(within(location).getByRole("button", { name: "Deep end" }));
    expect(within(location).getByRole("button", { name: "Deep end" }))
        .toHaveAttribute("aria-pressed", "true");
    expect(within(location).getByRole("button", { name: "Lane" }))
        .toHaveAttribute("aria-pressed", "false");
    await waitFor(() => expect(api.saveLessonPlan.mock.lastCall?.[3][0].location)
        .toBe("Deep end"));
});
it("autosaves edited rows without newly added untouched rows", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText(/No lesson plan saved/);
    await user.click(screen.getByRole("button", { name: "Add activity" }));
    await user.click(screen.getByRole("button", { name: "Add activity" }));
    await user.click(screen.getByRole("button", { name: "Custom activity for row 2" }));
    await user.type(screen.getByLabelText("Activity / drill 2"), "Practice floats");
    await waitFor(() => expect(api.saveLessonPlan).toHaveBeenCalledWith(
        "s", "c", "2026-10-05",
        [{ skill: "", activity: "Practice floats", activities: [{ kind: "custom", text: "Practice floats" }], location: "Lane", duration: 5 }],
        null,
    ));
});
it("adds, saves, and removes multiple custom activities in one row", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText(/No lesson plan saved/);
    await user.click(screen.getByRole("button", { name: "Add activity" }));
    const browse = screen.getByRole("button", { name: "Browse library for row 1" });
    const custom = screen.getByRole("button", { name: "Custom activity for row 1" });
    expect(browse.parentElement).toBe(custom.parentElement);
    expect(screen.queryByLabelText("Activity / drill 1")).not.toBeInTheDocument();
    await user.click(custom);
    await user.type(screen.getByLabelText("Activity / drill 1"), "First drill");
    await user.click(custom);
    await user.type(
        screen.getByLabelText("Activity / drill 1, activity 2"),
        "Second drill",
    );
    await waitFor(() => expect(api.saveLessonPlan).toHaveBeenCalledWith(
        "s", "c", "2026-10-05",
        [{
            skill: "",
            activity: "First drill\n\nSecond drill",
            activities: [
                { kind: "custom", text: "First drill" },
                { kind: "custom", text: "Second drill" },
            ],
            location: "Lane",
            duration: 5,
        }],
        null,
    ));
    await user.click(screen.getByRole("button", {
        name: "Remove activity 1 from row 1",
    }));
    expect(screen.getByLabelText("Activity / drill 1")).toHaveValue("Second drill");
    await waitFor(() => expect(api.saveLessonPlan.mock.lastCall?.[3][0].activity)
        .toBe("Second drill"));
});
it("saves edits made while an earlier autosave is still running", async () => {
    let finishFirst!: (value: unknown) => void;
    api.saveLessonPlan.mockImplementationOnce(() => new Promise((resolve) => {
        finishFirst = resolve;
    }));
    const user = userEvent.setup();
    setup();
    await screen.findByText(/No lesson plan saved/);
    await user.click(screen.getByRole("button", { name: "Add activity" }));
    await user.click(screen.getByRole("button", { name: "Custom activity for row 1" }));
    await user.type(screen.getByLabelText("Activity / drill 1"), "First");
    await waitFor(() => expect(api.saveLessonPlan).toHaveBeenCalledTimes(1));
    await user.type(screen.getByLabelText("Activity / drill 1"), " second");
    expect(api.saveLessonPlan).toHaveBeenCalledTimes(1);
    finishFirst({ plan: { rows: api.saveLessonPlan.mock.calls[0][3] } });
    await waitFor(() => expect(api.saveLessonPlan).toHaveBeenCalledTimes(2));
    expect(api.saveLessonPlan.mock.calls[1][3][0].activity).toBe("First second");
});
it("autosaves reordered and removed rows", async () => {
    api.fetchLessonPlan.mockResolvedValue({
        plan: {
            rows: [{
                skill: "First",
                activity: "A",
                location: "Lane",
                duration: 5,
            }, {
                skill: "Second",
                activity: "B",
                location: "Deep end",
                duration: 10,
            }],
        },
    });
    const user = userEvent.setup();
    setup();
    await screen.findByLabelText("Skill 1");
    screen.getByRole("button", { name: "Reorder row 2" }).focus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Reorder row 1" })).toHaveFocus();
    expect(screen.queryByText("Row actions")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Skill 1")).toHaveValue("Second");
    await user.click(screen.getByRole("button", { name: "Delete row 2" }));
    await waitFor(() =>
        expect(api.saveLessonPlan).toHaveBeenCalledWith(
            "s",
            "c",
            "2026-10-05",
            [{
                skill: "Second",
                activity: "B",
                location: "Deep end",
                duration: 10,
            }],
            null,
        )
    );
});
it("offers only the class level skills in catalog order", async () => {
    const user = userEvent.setup();
    setup("Splash 2A");
    await screen.findByText(/No lesson plan saved/);
    await user.click(screen.getByRole("button", { name: "Add activity" }));
    const select = screen.getByRole("combobox", { name: "Skill 1" });
    expect(
        within(select).getAllByRole("option").map((option) =>
            option.textContent
        ),
    ).toEqual([
        "Select skill",
        ...curriculumLevels.find((l) => l.id === "Splash2A")!.skills.map((s) =>
            s.compactName
        ),
    ]);
    expect(screen.queryByLabelText("Curriculum level")).not.toBeInTheDocument();
});
it("requires a plan level for private classes, preserves rows on changes, and restores the saved level", async () => {
    const user = userEvent.setup();
    api.fetchLessonPlan.mockResolvedValue({
        plan: {
            curriculum_level: "Splash1",
            rows: [{
                skill: "Enter and Exit Shallow Water",
                activity: "Practice",
                location: "Lane",
                duration: 5,
            }],
        },
    });
    const view = setup("Splash Private");
    expect(await screen.findByLabelText("Curriculum level")).toHaveValue(
        "Splash1",
    );
    await user.selectOptions(
        screen.getByLabelText("Curriculum level"),
        "Splash2A",
    );
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Skill 1")).toHaveValue(
        "Enter and Exit Shallow Water",
    );
    expect(screen.getByLabelText("Activity / drill 1")).toHaveValue("Practice");
    const skill =
        curriculumLevels.find((l) => l.id === "Splash2A")!.skills[0].name;
    await user.selectOptions(screen.getByLabelText("Skill 1"), skill);
    const plan = {
        curriculum_level: "Splash2A",
        rows: [{ skill, activity: "Practice", location: "Lane", duration: 5 }],
    };
    await waitFor(() => expect(api.saveLessonPlan).toHaveBeenCalledWith(
        "s", "c", "2026-10-05", plan.rows, "Splash2A",
    ));
    await waitFor(() => expect(api.saveLessonPlan).toHaveBeenCalled());
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    view.unmount();
    api.fetchLessonPlan.mockResolvedValue({ plan });
    setup("Splash Private");
    expect(await screen.findByLabelText("Curriculum level")).toHaveValue(
        "Splash2A",
    );
    expect(screen.getByLabelText("Skill 1")).toHaveValue(skill);
});
it.each(["Splash Private", "Unknown level", ""])(
    "waits for curriculum choice for %s and retains a level-only draft after save failure",
    async (level) => {
        const user = userEvent.setup();
        setup(level);
        await screen.findByText(/No lesson plan saved/);
        await user.click(screen.getByRole("button", { name: "Add activity" }));
        expect(screen.getByLabelText("Skill 1")).toBeDisabled();
        const levels = within(screen.getByLabelText("Curriculum level"))
            .getAllByRole("option");
        expect(levels.map((l) => (l as HTMLOptionElement).value)).not.toContain(
            "SplashPrivate",
        );
        await user.selectOptions(
            screen.getByLabelText("Curriculum level"),
            "LittleSplash1",
        );
        expect(screen.getByLabelText("Skill 1")).toBeEnabled();
        api.saveLessonPlan.mockRejectedValue(new Error("Offline"));
        await user.click(screen.getByRole("button", { name: "Delete row 1" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Your draft is retained",
        );
        expect(screen.getByLabelText("Curriculum level")).toHaveValue(
            "LittleSplash1",
        );
        expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    },
);
it("guards navigation when only the private curriculum level has changed", async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter([{
        path: "/",
        element: (
            <LessonEditor
                sessionId="s"
                classId="c"
                week="2026-10-05"
                level="Splash Private"
                lessonDuration={30}
            />
        ),
    }, { path: "/away", element: <p>Another page</p> }]);
    render(<RouterProvider router={router} />);
    await screen.findByLabelText("Curriculum level");
    await user.selectOptions(
        screen.getByLabelText("Curriculum level"),
        "Splash1",
    );
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    try {
        await router.navigate("/away");
        await waitFor(() =>
            expect(confirm).toHaveBeenCalledWith(
                "Discard unsaved lesson plan changes?",
            )
        );
        expect(screen.getByLabelText("Curriculum level")).toHaveValue(
            "Splash1",
        );
        confirm.mockReturnValue(true);
        await router.navigate("/away");
        expect(await screen.findByText("Another page")).toBeVisible();
    } finally {
        confirm.mockRestore();
    }
});

it("drags rows to a new position using the left handle", async () => {
    api.fetchLessonPlan.mockResolvedValue({
        plan: {
            rows: [{
                skill: "First",
                activity: "A",
                location: "Lane",
                duration: 5,
            }, {
                skill: "Second",
                activity: "B",
                location: "Deep end",
                duration: 10,
            }],
        },
    });
    setup();
    await screen.findByLabelText("Skill 1");
    const handle = screen.getByRole("button", { name: "Reorder row 1" });
    const firstRow = screen.getByLabelText("Skill 1").closest("tr")!;
    const secondRow = screen.getByLabelText("Skill 2").closest("tr")!;
    vi.spyOn(firstRow, "getBoundingClientRect").mockReturnValue(
        { top: 0, bottom: 100 } as DOMRect,
    );
    vi.spyOn(secondRow, "getBoundingClientRect").mockReturnValue(
        { top: 100, bottom: 200 } as DOMRect,
    );
    handle.setPointerCapture = vi.fn();
    handle.releasePointerCapture = vi.fn();
    vi.stubGlobal("PointerEvent", MouseEvent);
    try {
        fireEvent.pointerDown(handle, { button: 0, clientY: 50, pointerId: 1 });
        fireEvent.pointerMove(handle, { clientY: 160, pointerId: 1 });
        expect(firstRow).toHaveStyle({ transform: "translate3d(0, 110px, 0)" });
        expect(secondRow).toHaveStyle({
            transform: "translate3d(0, -100px, 0)",
        });
        expect(screen.getByLabelText("Skill 1")).toHaveValue("First");
        fireEvent.pointerUp(handle, { clientY: 160, pointerId: 1 });
        expect(firstRow).toHaveStyle({ transform: "translate3d(0, 100px, 0)" });
        expect(firstRow).toHaveClass("transition-transform");
        await waitFor(() =>
            expect(screen.getByLabelText("Skill 1")).toHaveValue("Second")
        );
        expect(screen.getByLabelText("Activity / drill 2")).toHaveValue("A");
        expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
        await waitFor(() => expect(api.saveLessonPlan).toHaveBeenCalled());
    } finally {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    }
});
it("returns rows to their original positions when a drag is cancelled", async () => {
    api.fetchLessonPlan.mockResolvedValue({
        plan: {
            rows: [{
                skill: "First",
                activity: "A",
                location: "Lane",
                duration: 5,
            }, {
                skill: "Second",
                activity: "B",
                location: "Deep end",
                duration: 10,
            }],
        },
    });
    setup();
    await screen.findByLabelText("Skill 1");
    const handle = screen.getByRole("button", { name: "Reorder row 1" });
    const firstRow = screen.getByLabelText("Skill 1").closest("tr")!;
    const secondRow = screen.getByLabelText("Skill 2").closest("tr")!;
    vi.spyOn(firstRow, "getBoundingClientRect").mockReturnValue(
        { top: 0, bottom: 100 } as DOMRect,
    );
    vi.spyOn(secondRow, "getBoundingClientRect").mockReturnValue(
        { top: 100, bottom: 200 } as DOMRect,
    );
    handle.setPointerCapture = vi.fn();
    vi.stubGlobal("PointerEvent", MouseEvent);
    try {
        fireEvent.pointerDown(handle, { button: 0, clientY: 50, pointerId: 1 });
        fireEvent.pointerMove(handle, { clientY: 160, pointerId: 1 });
        expect(firstRow).toHaveStyle({ transform: "translate3d(0, 110px, 0)" });
        fireEvent.pointerCancel(handle, { pointerId: 1 });
        expect(firstRow).not.toHaveStyle({
            transform: "translate3d(0, 110px, 0)",
        });
        expect(screen.getByLabelText("Skill 1")).toHaveValue("First");
        expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    } finally {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    }
});

function mockLibraryDialog() {
    const prototype = HTMLDialogElement.prototype;
    const originals = ["showModal", "close"].map((name) =>
        Object.getOwnPropertyDescriptor(prototype, name)
    );
    Object.defineProperty(prototype, "showModal", {
        configurable: true,
        value: function(this: HTMLDialogElement) {
            this.setAttribute("open", "");
            this.querySelector<HTMLButtonElement>("button")?.focus();
        },
    });
    Object.defineProperty(prototype, "close", {
        configurable: true,
        value: function(this: HTMLDialogElement) {
            this.removeAttribute("open");
        },
    });
    return () => {
        cleanup();
        ["showModal", "close"].forEach((name, i) => {
            const original = originals[i];
            if (original) Object.defineProperty(prototype, name, original);
            else Reflect.deleteProperty(prototype, name);
        });
    };
}
it("inserts from the library without changing other row fields and autosaves", async () => {
    const restore = mockLibraryDialog();
    const skill = curriculumLevels.find((l) => l.id === "Splash1")!.skills.find(
        (s) => s.id === "Splash1:5",
    )!;
    const original = [{
        skill: skill.name,
        activity: "",
        location: "Deep end",
        duration: 12,
    }, {
        skill: "Other saved skill",
        activity: "Keep this",
        location: "Lane",
        duration: 3,
    }];
    api.fetchLessonPlan.mockResolvedValue({ plan: { rows: original } });
    api.saveLessonPlan.mockImplementation(async (_s, _c, _w, rows) => ({
        plan: { rows },
    }));
    const user = userEvent.setup();
    const view = setup();
    try {
        const trigger = await screen.findByRole("button", {
            name: "Browse library for row 1",
        });
        await user.click(trigger);
        const dialog = screen.getByRole("dialog", { name: "Activity Library" });
        await user.click(
            within(dialog).getByRole("checkbox", {
                name: "Only activities for Submerge & exhale ×5",
            }),
        );
        await user.type(
            within(dialog).getByRole("searchbox"),
            "Five Little Ducks",
        );
        await user.click(within(dialog).getByText("Five Little Ducks"));
        await user.click(
            within(dialog).getByRole("button", {
                name: "Use Five Little Ducks",
            }),
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
        expect(screen.getByText(/Five Little Ducks/)).toBeVisible();
        expect(screen.getByLabelText("Skill 1")).toHaveValue(skill.name);
        expect(within(screen.getByRole("group", { name: "Pool location 1" }))
            .getByRole("button", { name: "Deep end" }))
            .toHaveAttribute("aria-pressed", "true");
        expect(screen.getByLabelText("Duration (minutes) 1")).toHaveValue(12);
        expect(screen.getByLabelText("Activity / drill 2")).toHaveValue(
            "Keep this",
        );
        expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
        await waitFor(() => expect(api.saveLessonPlan).toHaveBeenCalled());
        const inserted = api.saveLessonPlan.mock.calls[0][3][0].activity;
        expect(inserted).toContain("Five Little Ducks");
        expect(inserted).toContain("blow bubbles");
        const expected = [{
            ...original[0],
            activity: inserted,
            activities: [{ kind: "library", text: inserted }],
        }, original[1]];
        expect(api.saveLessonPlan).toHaveBeenCalledWith(
            "s",
            "c",
            "2026-10-05",
            expected,
            null,
        );
        view.unmount();
        api.fetchLessonPlan.mockResolvedValue({ plan: { rows: expected } });
        setup();
        expect(await screen.findByText(/Five Little Ducks/)).toBeVisible();
    } finally {
        restore();
    }
});
it("adds a library activity alongside existing custom instructions", async () => {
    const restore = mockLibraryDialog();
    api.fetchLessonPlan.mockResolvedValue({
        plan: {
            rows: [{
                skill: "Unknown saved skill",
                activity: "My own instructions",
                location: "Lane",
                duration: 5,
            }],
        },
    });
    const user = userEvent.setup();
    setup();
    try {
        await user.click(
            await screen.findByRole("button", {
                name: "Browse library for row 1",
            }),
        );
        const dialog = screen.getByRole("dialog");
        expect(within(dialog).getByRole("checkbox")).toBeDisabled();
        await user.type(
            within(dialog).getByRole("searchbox"),
            "Chop, Chop, Timber",
        );
        await user.click(within(dialog).getByText("Chop, Chop, Timber"));
        await user.click(
            within(dialog).getByRole("button", {
                name: "Use Chop, Chop, Timber",
            }),
        );
        expect(screen.getByLabelText("Activity / drill 1")).toHaveValue(
            "My own instructions",
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByText(/Chop, Chop, Timber/)).toBeVisible();
        await waitFor(() => expect(api.saveLessonPlan).toHaveBeenCalled());
        expect(api.saveLessonPlan.mock.calls[0][3][0].activities).toHaveLength(2);
    } finally {
        restore();
    }
});
it("closes the library with the close button or Escape without dirtying the plan", async () => {
    const restore = mockLibraryDialog();
    api.fetchLessonPlan.mockResolvedValue({
        plan: {
            rows: [{ skill: "", activity: "", location: "Lane", duration: 5 }],
        },
    });
    const user = userEvent.setup();
    setup();
    try {
        const trigger = await screen.findByRole("button", {
            name: "Browse library for row 1",
        });
        await user.click(trigger);
        expect(screen.getByRole("checkbox")).toBeDisabled();
        await user.click(
            screen.getByRole("button", { name: "Close activity library" }),
        );
        expect(trigger).toHaveFocus();
        await user.click(trigger);
        fireEvent(
            screen.getByRole("dialog"),
            new Event("cancel", { cancelable: true }),
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
        expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Activity / drill 1")).not.toBeInTheDocument();
    } finally {
        restore();
    }
});

const workoutSkill =
    curriculumLevels.find((level) => level.id === "SplashFitness")!.skills.find(
        (skill) => skill.compactName === "Workout 300m",
    )!.name;
it("builds and saves custom workouts, reopening the builder fresh while preserving row fields", async () => {
    const restore = mockLibraryDialog();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    try {
        api.fetchLessonPlan.mockResolvedValue({
            plan: {
                rows: [{
                    skill: workoutSkill,
                    activity: "Original text",
                    location: "Deep end",
                    duration: 12,
                }],
            },
        });
        api.saveLessonPlan.mockImplementation(async (_s, _c, _w, rows) => ({
            plan: { rows },
        }));
        const user = userEvent.setup();
        setup("Splash Fitness");
        await screen.findByLabelText("Skill 1");
        await user.click(
            screen.getByRole("button", { name: "Use custom workout for row 1" }),
        );
        const dialog = screen.getByRole("dialog", { name: "Workout builder" });
        expect(within(dialog).queryAllByRole("option", {
            name: /Interval workout/,
        })).toHaveLength(0);
        await user.click(
            within(dialog).getByRole("button", { name: "Use workout" }),
        );
        expect(within(dialog).getByRole("alert")).toHaveTextContent("warm-up");
        await user.selectOptions(
            within(dialog).getByLabelText("Choose warm-up preset"),
            "workouts-warm-up-1",
        );
        await user.selectOptions(
            within(dialog).getByLabelText("Choose main set preset"),
            "workouts-11-years-under-main-set-a",
        );
        await user.click(
            within(dialog).getByRole("button", {
                name: "Create custom cool-down",
            }),
        );
        await user.click(
            within(dialog).getByRole("button", { name: "Add cool-down set" }),
        );
        await user.clear(
            within(dialog).getByLabelText("Cool-down set 2 distance"),
        );
        await user.type(
            within(dialog).getByLabelText("Cool-down set 2 distance"),
            "50",
        );
        await user.click(
            within(dialog).getByRole("button", {
                name: "Move Cool-down set 2 up",
            }),
        );
        expect(within(dialog).getByLabelText("Cool-down set 1 distance"))
            .toHaveValue(50);
        await user.click(
            within(dialog).getByRole("button", {
                name: "Delete Cool-down set 2",
            }),
        );
        await user.click(
            within(dialog).getByRole("button", { name: "Use workout" }),
        );
        const summary = screen.getByLabelText("Workout summary 1").textContent;
        expect(summary).toContain("Total distance: 550 m");
        await waitFor(() => expect(api.saveLessonPlan).toHaveBeenCalled());
        const rows = api.saveLessonPlan.mock.calls[0][3];
        expect(rows[0]).toMatchObject({
            skill: workoutSkill,
            location: "Deep end",
            duration: 12,
            workout: { version: 1 },
        });
        await user.click(
            screen.getByRole("button", { name: "Use custom workout for row 1" }),
        );
        expect(screen.getByLabelText("Workout title")).toHaveValue("Workout");
        expect(screen.queryByLabelText("Warm-up set 1 distance"))
            .not.toBeInTheDocument();
        await user.clear(screen.getByLabelText("Workout title"));
        await user.type(screen.getByLabelText("Workout title"), "Changed");
        confirm.mockReturnValue(false);
        await user.click(
            screen.getByRole("button", { name: "Close workout builder" }),
        );
        expect(screen.getByRole("dialog")).toBeVisible();
        confirm.mockReturnValue(true);
        await user.click(
            screen.getByRole("button", { name: "Close workout builder" }),
        );
        expect(screen.getByLabelText("Workout summary 1").textContent).toBe(
            summary,
        );
        expect(screen.queryByRole("button", {
            name: "Convert workout in row 1 to text",
        })).not.toBeInTheDocument();
    } finally {
        confirm.mockRestore();
        restore();
    }
});

it("only offers the builder for catalog workout skills and confirms conversion when changing skills", async () => {
    const restore = mockLibraryDialog();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    try {
        const user = userEvent.setup();
        setup("Splash Fitness");
        await screen.findByText(/No lesson plan saved/);
        await user.click(screen.getByRole("button", { name: "Add activity" }));
        expect(
            screen.queryByRole("button", { name: "Use custom workout for row 1" }),
        )
            .not.toBeInTheDocument();
        const ordinary = curriculumLevels.find((level) =>
            level.id === "SplashFitness"
        )!.skills[0].name;
        await user.selectOptions(screen.getByLabelText("Skill 1"), ordinary);
        expect(
            screen.queryByRole("button", { name: "Use custom workout for row 1" }),
        )
            .not.toBeInTheDocument();
        await user.selectOptions(
            screen.getByLabelText("Skill 1"),
            workoutSkill,
        );
        await user.click(
            screen.getByRole("button", { name: "Use custom workout for row 1" }),
        );
        for (const section of ["warm-up", "main set", "cool-down"]) {
            await user.click(
                screen.getByRole("button", {
                    name: `Create custom ${section}`,
                }),
            );
        }
        await user.click(screen.getByRole("button", { name: "Use workout" }));
        const text = screen.getByLabelText("Workout summary 1").textContent;
        await user.selectOptions(screen.getByLabelText("Skill 1"), ordinary);
        expect(screen.getByLabelText("Skill 1")).toHaveValue(workoutSkill);
        expect(screen.getByRole("button", { name: "Use custom workout for row 1" }))
            .toBeVisible();
        confirm.mockReturnValue(true);
        await user.selectOptions(screen.getByLabelText("Skill 1"), ordinary);
        expect(screen.getByLabelText("Activity / drill 1")).toHaveValue(text);
        expect(
            screen.queryByRole("button", { name: "Use custom workout for row 1" }),
        )
            .not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Use custom workout for row 1" }))
            .not
            .toBeInTheDocument();
    } finally {
        confirm.mockRestore();
        restore();
    }
});
it("keeps previously saved workouts under ordinary skills readable without opening the builder", async () => {
    const { newWorkout, newSet, workoutText } = await import(
        "../../../shared/workouts/workout"
    );
    const workout = newWorkout();
    workout.sections = {
        warmUp: [newSet()],
        mainSet: [newSet()],
        coolDown: [newSet()],
    };
    api.fetchLessonPlan.mockResolvedValue({
        plan: {
            rows: [{
                skill: "Float",
                activity: workoutText(workout),
                workout,
                location: "Lane",
                duration: 10,
            }],
        },
    });
    setup();
    await screen.findByLabelText("Workout summary 1");
    expect(screen.queryByRole("button", { name: "Use custom workout for row 1" })).not
        .toBeInTheDocument();
    expect(
        screen.getByRole("button", {
            name: "Convert workout in row 1 to text",
        }),
    ).toBeVisible();
});

it("uses the skill's prescribed workout by default and opens a fresh custom builder", async () => {
    const restore = mockLibraryDialog();
    try {
        const user = userEvent.setup();
        setup("Splash Fitness");
        await screen.findByText(/No lesson plan saved/);
        await user.click(screen.getByRole("button", { name: "Add activity" }));
        await user.selectOptions(screen.getByLabelText("Skill 1"), workoutSkill);
        const expected = defaultWorkoutText(workoutSkill)!;
        expect(screen.getByLabelText("Workout summary 1").textContent).toBe(expected);
        expect(screen.queryByRole("button", { name: "Browse library for row 1" }))
            .not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Custom activity for row 1" }))
            .not.toBeInTheDocument();
        await waitFor(() => expect(api.saveLessonPlan).toHaveBeenCalled());
        expect(api.saveLessonPlan.mock.calls[api.saveLessonPlan.mock.calls.length - 1][3][0].activity).toBe(expected);
        await user.click(screen.getByRole("button", {
            name: "Use custom workout for row 1",
        }));
        expect(screen.queryByLabelText("Warm-up set 1 distance"))
            .not.toBeInTheDocument();
        expect(screen.queryByLabelText("Main set 1 distance"))
            .not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Close workout builder" }));
        expect(screen.getByLabelText("Workout summary 1").textContent).toBe(expected);
    } finally {
        restore();
    }
});

it("fills a saved workout skill with its default without saving until the plan is edited", async () => {
    api.fetchLessonPlan.mockResolvedValue({
        plan: {
            rows: [{
                skill: workoutSkill, activity: "", location: "Deep end", duration: 12,
            }]
        }
    });
    setup("Splash Fitness");
    const summary = await screen.findByLabelText("Workout summary 1");
    expect(summary.textContent).toBe(defaultWorkoutText(workoutSkill));
    expect(api.saveLessonPlan).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", {
        name: "Increase duration by 1 minute for row 1",
    }));
    await waitFor(() => expect(api.saveLessonPlan).toHaveBeenCalled());
    expect(api.saveLessonPlan.mock.calls[api.saveLessonPlan.mock.calls.length - 1][3][0]).toMatchObject({
        skill: workoutSkill, activity: defaultWorkoutText(workoutSkill),
        location: "Deep end", duration: 13,
    });
});
