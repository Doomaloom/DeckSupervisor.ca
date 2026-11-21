import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PlannerClass, PlannerClassStatus, PlannerDataset, PlannerParticipant } from "../../../../types/app";
import PlannerDetailsPanel from "./PlannerDetailsPanel.component";
import type { PlannerDetailsPanelProps } from "./PlannerDetailsPanel.logic";

function plannerClass(planningStatus: PlannerClassStatus): PlannerClass {
    return {
        classKey: "A",
        eventId: "98005",
        sessionKey: "session-a",
        serviceName: "Splash 4",
        dayOfWeek: "Th",
        eventTime: "04:00 PM - 04:30 PM",
        facility: "Main Pool",
        sessionSeason: "Fall",
        sessionYear: 2026,
        minimumCapacity: 3,
        maximumCapacity: 9,
        bookedCount: 2,
        waitlistCount: 0,
        participantIds: ["p1", "p2"],
        waitingParticipantIds: [],
        laneIndex: 0,
        planningStatus,
        plannedMoveType: planningStatus === "planned_move" ? "new_time" : "",
        plannedMoveTime: planningStatus === "planned_move" ? "Thursday 3:30 PM - 4:00 PM" : "",
        plannedMoveTargetClassKey: "",
        barcodeCancelledAt: "",
    };
}

function participant(id: string, name: string): PlannerParticipant {
    return { id, classKey: "A", eventId: "98005", serviceName: "Splash 4", name, phone: "555-0100", email: "", age: "6", attendeeStatus: "booked" } as PlannerParticipant;
}

function renderPanel(overrides: Partial<PlannerDetailsPanelProps> = {}) {
    const selectedClass = plannerClass("cancelled");
    const dataset: PlannerDataset = { sourceFileName: "x.csv", importedAt: "", sessions: [], classes: [selectedClass], participants: [], callRecords: {} };
    const props: PlannerDetailsPanelProps = {
        alternatives: { availableAlternatives: [], fullAlternatives: [] },
        bookedParticipants: [participant("p1", "Vale Reid"), participant("p2", "Casey Zhang")],
        dataset,
        isInfoPanelOpen: true,
        selectedClass,
        setCallRecord: vi.fn(),
        setClassMove: vi.fn(),
        setClassStatus: vi.fn(),
        setIsInfoPanelOpen: vi.fn(),
        startCall: vi.fn(),
        waitingParticipants: [],
        ...overrides,
    };
    return render(<PlannerDetailsPanel {...props} />);
}

it("renders nothing once the panel is closed, so the board can take the full width", () => {
    const { container } = renderPanel({ isInfoPanelOpen: false });
    expect(container).toBeEmptyDOMElement();
});

it.each([["planned_move", "Move Call Workflow"], ["pending_cancellation", "Cancellation Call Workflow"], ["cancelled", "Cancellation Call Workflow"]] as const)(
    "keeps the %s call workflow at its content height instead of letting it shrink inside the panel",
    (status, heading) => {
        const { container } = renderPanel({ selectedClass: plannerClass(status) });
        expect(screen.getByRole("heading", { name: heading })).toBeVisible();
        expect(screen.getAllByRole("button", { name: "Call Parent / Guardian" })).toHaveLength(2);
        // The panel itself scrolls inside its height cap; the workflow section must not be a
        // shrinkable flex item (min-h-0) or a second scroll box, or it collapses to its title.
        const section = container.querySelector('[data-component="planner-call-workflow"]');
        expect(section).not.toBeNull();
        expect(section).not.toHaveClass("min-h-0");
        for (const element of section!.querySelectorAll(":scope > div")) {
            expect(element).not.toHaveClass("min-h-0");
            expect(element).not.toHaveClass("overflow-y-auto");
        }
        expect(container.querySelector("#planner-details-panel")).toHaveClass("xl:overflow-y-auto");
    },
);

afterEach(() => { vi.useRealTimers(); });

it("keeps every letter typed in Notes while a slow save is in flight, and saves once after a pause", async () => {
    vi.useFakeTimers();
    let finishSave: () => void = () => { };
    const setCallRecord = vi.fn(() => new Promise<void>((resolve) => { finishSave = resolve; }));
    renderPanel({ setCallRecord });
    const notes = screen.getAllByRole("textbox")[0] as HTMLTextAreaElement;
    notes.focus();
    let typed = "";
    for (const letter of "Left a message") {
        typed += letter;
        fireEvent.change(notes, { target: { value: typed } });
        await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    }
    expect(notes.value).toBe("Left a message");
    expect(setCallRecord).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(setCallRecord).toHaveBeenCalledTimes(1);
    expect(setCallRecord).toHaveBeenCalledWith("p1", { notes: "Left a message" });
    // A reply that arrives after the save does not wipe what is on screen.
    await act(async () => { finishSave(); });
    expect(notes.value).toBe("Left a message");
});

it("saves pending Notes when the field loses focus", () => {
    const setCallRecord = vi.fn();
    renderPanel({ setCallRecord });
    const notes = screen.getAllByRole("textbox")[0];
    fireEvent.focus(notes);
    fireEvent.change(notes, { target: { value: "Voicemail" } });
    fireEvent.blur(notes);
    expect(setCallRecord).toHaveBeenCalledWith("p1", { notes: "Voicemail" });
});
