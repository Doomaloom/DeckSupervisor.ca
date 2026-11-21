import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Student } from "../../../../types/app";
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
} as const;

function renderCard(students: Student[]) {
    return render(
        <RosterCard
            roster={{
                code: "1001",
                serviceName: "Splash 6",
                level: "Splash 6",
                time: "09:00-09:30",
                instructor: "Coach Amy",
                location: "Pool A",
                schedule: "Morning",
                students,
            }}
            onPrint={vi.fn()}
            onRosterLevelChange={vi.fn()}
            onStudentLevelChange={vi.fn()}
            allowStudentLevelEdits={false}
            onToggleStudentLevelEdits={vi.fn()}
        />,
    );
}

it("shows a Waitlist section only when the class has a waitlisted swimmer (R2-W11)", () => {
    const { unmount } = renderCard([
        { ...base, id: "1", name: "Alice Smith", waitlist: false } as Student,
        { ...base, id: "2", name: "Xen Joshi", waitlist: true } as Student,
    ]);
    const section = screen.getByText("Waitlist").closest(
        '[data-component="roster-waitlist"]',
    ) as HTMLElement;
    expect(section.textContent).toContain("Xen Joshi");
    expect(section.textContent).not.toContain("Alice Smith");
    unmount();
    renderCard([
        { ...base, id: "1", name: "Alice Smith", waitlist: false } as Student,
    ]);
    expect(screen.queryByText("Waitlist")).toBeNull();
});
