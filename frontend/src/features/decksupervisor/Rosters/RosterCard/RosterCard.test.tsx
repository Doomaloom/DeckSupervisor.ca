import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { Student } from "../../../../types/app";
import type { CardSaveState } from "../hooks/useRosterEdits";
import type { RosterGroup } from "../types";
import RosterCard from "./RosterCard.component";

const base = {
    service_name: "Splash 6",
    code: "1001",
    day: "Th",
    time: "09:00-09:30",
    location: "Pool A",
    schedule: "Morning",
    phone: "",
    instructor: "Coach Amy",
    level: "Splash 6",
    registered_level: "Splash 6",
} as const;

const student = (id: string, name: string, extra: Partial<Student> = {}) =>
    ({ ...base, id, name, waitlist: false, ...extra }) as Student;

function group(students: Student[], extra: Partial<RosterGroup> = {}) {
    return {
        code: "1001",
        serviceName: "Splash 6",
        level: "Splash 6",
        registeredLevel: "Splash 6",
        time: "09:00-09:30",
        instructor: "Coach Amy",
        location: "Pool A",
        schedule: "Morning",
        students,
        ...extra,
    } as RosterGroup;
}

function renderCard(
    students: Student[],
    props: Partial<React.ComponentProps<typeof RosterCard>> = {},
    extra: Partial<RosterGroup> = {},
) {
    const handlers = {
        onPrint: vi.fn(),
        onClassLevelChange: vi.fn(),
        onSetAllToLevel: vi.fn(),
        onStudentLevelChange: vi.fn(),
        onCustomRosterLevelChange: vi.fn(),
        onRetrySave: vi.fn(),
    };
    const view = render(
        <RosterCard
            roster={group(students, extra)}
            {...handlers}
            {...props}
        />,
    );
    return { ...view, ...handlers };
}

const radio = (name: string) => screen.getByRole("radio", { name });
const dropdowns = () => screen.queryAllByRole("combobox");

it("shows a Waitlist section only when the class has a waitlisted swimmer (R2-W11)", () => {
    const { unmount } = renderCard([
        student("1", "Alice Smith"),
        student("2", "Xen Joshi", { waitlist: true }),
    ]);
    const section = screen.getByText("Waitlist").closest(
        '[data-component="roster-waitlist"]',
    ) as HTMLElement;
    expect(section.textContent).toContain("Xen Joshi");
    expect(section.textContent).not.toContain("Alice Smith");
    unmount();
    renderCard([student("1", "Alice Smith")]);
    expect(screen.queryByText("Waitlist")).toBeNull();
});

it("opens in whole class mode when every swimmer is on the class level", () => {
    renderCard([
        student("1", "Alice Smith"),
        student("2", "Ben Ng", { level: "Splash6" }),
        student("3", "Cy Wu", { level: "Splash 1", waitlist: true }),
    ]);
    expect(radio("Whole class").getAttribute("aria-checked")).toBe("true");
    expect(radio("Each swimmer").getAttribute("aria-checked")).toBe("false");
    // Only the class dropdown; swimmers are names.
    expect(dropdowns()).toHaveLength(1);
    expect(screen.getByLabelText("Class level")).toBe(dropdowns()[0]);
    expect(screen.getByText("From registration")).toBeTruthy();
    expect(screen.getByText("Swimmers (2)")).toBeTruthy();
    expect(screen.queryByText("Mixed levels")).toBeNull();
});

it("offers to reset a class level that was changed from registration", async () => {
    const { onClassLevelChange } = renderCard(
        [student("1", "Alice Smith", { level: "Splash 4" })],
        {},
        { level: "Splash 4" },
    );
    expect(screen.getByText(/Changed from Splash 6/)).toBeTruthy();
    await userEvent.setup().click(
        screen.getByRole("button", { name: "Reset to Splash 6" }),
    );
    expect(onClassLevelChange).toHaveBeenCalledWith("1001", "Splash 6");
});

it("saves the class level picked in the dropdown", async () => {
    const { onClassLevelChange } = renderCard([student("1", "Alice Smith")]);
    await userEvent.setup().selectOptions(
        screen.getByLabelText("Class level"),
        "Splash 3",
    );
    expect(onClassLevelChange).toHaveBeenCalledWith("1001", "Splash 3");
});

it("opens in each swimmer mode when a booked swimmer has their own level", async () => {
    const { onStudentLevelChange } = renderCard([
        student("1", "Alice Smith"),
        student("2", "Ben Ng", { level: "Splash 4" }),
        student("3", "Cy Wu", { level: "Splash 1", waitlist: true }),
    ]);
    expect(radio("Each swimmer").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Mixed levels")).toBeTruthy();
    expect(screen.queryByLabelText("Class level")).toBeNull();
    expect(dropdowns()).toHaveLength(2);
    expect(
        screen.getByText(
            "Swimmers you don't change stay at the class level (Splash 6).",
        ),
    ).toBeTruthy();
    const row = document.getElementById("student-row-2") as HTMLElement;
    expect(within(row).getByText(/Own level/)).toBeTruthy();
    expect(
        document.getElementById("student-row-1")!.textContent,
    ).not.toContain("Own level");
    await userEvent.setup().click(
        within(row).getByRole("button", { name: "Reset to Splash 6" }),
    );
    expect(onStudentLevelChange).toHaveBeenCalledWith("2", "Splash 6");
});

it("shows each swimmer's dropdown without saving anything when switched by hand", async () => {
    const handlers = renderCard([student("1", "Alice Smith")]);
    await userEvent.setup().click(radio("Each swimmer"));
    expect(radio("Each swimmer").getAttribute("aria-checked")).toBe("true");
    expect(dropdowns()).toHaveLength(1);
    expect(screen.queryByLabelText("Class level")).toBeNull();
    expect(screen.queryByText("Mixed levels")).toBeNull();
    expect(handlers.onClassLevelChange).not.toHaveBeenCalled();
    expect(handlers.onSetAllToLevel).not.toHaveBeenCalled();
    expect(handlers.onStudentLevelChange).not.toHaveBeenCalled();
    // Nothing to reset, so going back asks nothing.
    await userEvent.setup().click(radio("Whole class"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(radio("Whole class").getAttribute("aria-checked")).toBe("true");
});

const mixedStudents = () => [
    student("1", "Alice Smith"),
    student("2", "Ben Ng", { level: "Splash 4" }),
    student("3", "Cy Wu", { level: "Splash 4" }),
];

it("asks before switching back, and Cancel leaves everything as it was", async () => {
    const user = userEvent.setup();
    const handlers = renderCard(mixedStudents());
    await user.click(radio("Whole class"));
    const dialog = screen.getByRole("dialog");
    expect(
        within(dialog).getByText("Use one level for the whole class?"),
    ).toBeTruthy();
    expect(within(dialog).getByText(/These 2 swimmers have their own level/))
        .toBeTruthy();
    expect(dialog.textContent).toContain("Ben Ng: Splash 4 → Splash 6");
    expect(dialog.textContent).toContain("Cy Wu: Splash 4 → Splash 6");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(radio("Each swimmer").getAttribute("aria-checked")).toBe("true");
    expect(handlers.onSetAllToLevel).not.toHaveBeenCalled();
    expect(handlers.onClassLevelChange).not.toHaveBeenCalled();
});

it("Set all resets the swimmers to the class level and switches", async () => {
    const user = userEvent.setup();
    const handlers = renderCard(mixedStudents());
    await user.click(radio("Whole class"));
    await user.click(screen.getByRole("button", { name: "Set all to Splash 6" }));
    expect(handlers.onSetAllToLevel).toHaveBeenCalledWith("1001", "Splash 6");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(radio("Whole class").getAttribute("aria-checked")).toBe("true");
});

it("offers to make a shared level the class level only when every swimmer is on it", async () => {
    const user = userEvent.setup();
    const { unmount } = renderCard(mixedStudents());
    await user.click(radio("Whole class"));
    expect(
        screen.queryByRole("button", { name: /the class level$/ }),
    ).toBeNull();
    unmount();

    const handlers = renderCard([
        student("2", "Ben Ng", { level: "Splash 4" }),
        student("3", "Cy Wu", { level: "Splash4" }),
    ]);
    await user.click(radio("Whole class"));
    await user.click(
        screen.getByRole("button", { name: "Make Splash 4 the class level" }),
    );
    expect(handlers.onSetAllToLevel).toHaveBeenCalledWith("1001", "Splash 4");
    expect(screen.queryByRole("dialog")).toBeNull();
});

it("never uses the browser's confirm box", async () => {
    const confirm = vi.spyOn(window, "confirm");
    await userEvent.setup().click(
        (renderCard(mixedStudents()), radio("Whole class")),
    );
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
});

it("shows levels as text, with no switch or dropdowns, for someone who can only view", () => {
    renderCard(mixedStudents(), { canEdit: false });
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(dropdowns()).toHaveLength(0);
    expect(screen.getByText("Class level:").parentElement!.textContent).toContain(
        "Splash 6",
    );
    expect(
        screen.getByText("You can view levels but not change them."),
    ).toBeTruthy();
    expect(screen.getByText("Ben Ng").parentElement!.textContent).toContain(
        "Splash 4",
    );
});

it("marks a failed save Not saved and Retry repeats it", async () => {
    const saveState: CardSaveState = {
        status: "",
        failures: [{
            target: "2",
            message:
                "Couldn't save Ben Ng's level (Splash 4). Check your connection, then press Retry.",
        }],
    };
    const { onRetrySave } = renderCard(mixedStudents(), { saveState });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Couldn't save Ben Ng's level");
    expect(within(alert).queryByRole("button", { name: /close|dismiss/i }))
        .toBeNull();
    const row = document.getElementById("student-row-2") as HTMLElement;
    expect(within(row).getByText("Not saved")).toBeTruthy();
    expect(
        within(document.getElementById("student-row-3")!).queryByText(
            "Not saved",
        ),
    ).toBeNull();
    await userEvent.setup().click(
        within(alert).getByRole("button", { name: "Retry" }),
    );
    expect(onRetrySave).toHaveBeenCalledWith("1001", "2");
});

it("marks a failed class save under the class dropdown", () => {
    renderCard([student("1", "Alice Smith")], {
        saveState: {
            status: "",
            failures: [{
                target: "class",
                message:
                    "Couldn't save the class level (Splash 3). Check your connection, then press Retry.",
            }],
        },
    });
    expect(screen.getByText("Not saved")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
        "Couldn't save the class level (Splash 3)",
    );
});

it("shows Saving and Saved next to the switch", () => {
    const { rerender } = renderCard([student("1", "Alice Smith")], {
        saveState: { status: "saving", failures: [] },
    });
    expect(screen.getByText("Saving…")).toBeTruthy();
    rerender(
        <RosterCard
            roster={group([student("1", "Alice Smith")])}
            onPrint={vi.fn()}
            onClassLevelChange={vi.fn()}
            onStudentLevelChange={vi.fn()}
            saveState={{ status: "saved", failures: [] }}
        />,
    );
    expect(screen.getByText("Saved")).toBeTruthy();
});

it("shows a custom roster with a Roster level and no switch", async () => {
    const { onCustomRosterLevelChange } = renderCard(
        [
            student("1", "Alice Smith", { level: "Splash 4", service_name: "Splash 4", time: "4:30 PM-5:00 PM" }),
            student("2", "Ben Ng", { waitlist: true }),
        ],
        { isCustom: true },
        { code: "custom-c1", customRosterId: "c1", level: "Splash 5" },
    );
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByLabelText("Roster level")).toBeTruthy();
    expect(
        screen.getByText(/Every swimmer in this roster prints on the Splash 5\s+sheet\. Their level in their own class does not change\./),
    ).toBeTruthy();
    expect(screen.getByText("Splash 4 · 4:30 PM")).toBeTruthy();
    expect(dropdowns()).toHaveLength(1);
    await userEvent.setup().selectOptions(
        screen.getByLabelText("Roster level"),
        "Splash 3",
    );
    expect(onCustomRosterLevelChange).toHaveBeenCalledWith("c1", "Splash 3");
});

// RL-5: saved levels can arrive after the card first shows.
it("moves to whole class when saved levels arrive and nobody has their own level any more", () => {
    const { rerender } = renderCard(mixedStudents());
    expect(radio("Each swimmer").getAttribute("aria-checked")).toBe("true");
    rerender(
        <RosterCard
            roster={group([
                student("1", "Alice Smith"),
                student("2", "Ben Ng"),
                student("3", "Cy Wu"),
            ])}
            onPrint={vi.fn()}
            onClassLevelChange={vi.fn()}
            onStudentLevelChange={vi.fn()}
        />,
    );
    expect(radio("Whole class").getAttribute("aria-checked")).toBe("true");
});

it("keeps Each swimmer once the user has used the card", async () => {
    const user = userEvent.setup();
    const props = {
        onPrint: vi.fn(),
        onClassLevelChange: vi.fn(),
        onStudentLevelChange: vi.fn(),
    };
    const { rerender } = render(
        <RosterCard roster={group(mixedStudents())} {...props} />,
    );
    await user.click(
        within(document.getElementById("student-row-2")!).getByRole("button", {
            name: "Reset to Splash 6",
        }),
    );
    rerender(
        <RosterCard
            roster={group([
                student("1", "Alice Smith"),
                student("2", "Ben Ng"),
                student("3", "Cy Wu"),
            ])}
            {...props}
        />,
    );
    expect(radio("Each swimmer").getAttribute("aria-checked")).toBe("true");
});
