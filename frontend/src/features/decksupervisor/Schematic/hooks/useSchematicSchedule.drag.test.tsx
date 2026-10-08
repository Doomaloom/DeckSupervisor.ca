import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useSchematicSchedule } from "./useSchematicSchedule";

const { courses } = vi.hoisted(() => ({
    courses: [{
        code: "A",
        level: "Swimmer 1",
        startTime: "09:00",
        endTime: "09:30",
        startMinutes: 540,
        endMinutes: 570,
        runningTime: 30,
        studentCount: 2,
    }],
}));

vi.mock("../../../../app/useCurrentSession", () => ({
    useCurrentSession: () => ({
        access: { mode: "guest" },
        session: null,
        sessionId: null,
    }),
}));
vi.mock("../utils/courses", () => ({ buildCourses: () => courses }));

it("passes active drag state through the schedule hook used by the page", () => {
    const { result } = renderHook(() => useSchematicSchedule("Mo"));
    expect(result.current.draggedCourseCodes).toEqual([]);
    expect(result.current.draggedColumnIndex).toBeNull();

    act(() => result.current.handleDragStart(courses[0], 0));
    expect(result.current.draggedCourseCodes).toEqual(["A"]);
    expect(result.current.draggedColumnIndex).toBe(0);

    act(() => result.current.handleDrop(0));
    expect(result.current.draggedCourseCodes).toEqual([]);
    expect(result.current.draggedColumnIndex).toBeNull();
});
