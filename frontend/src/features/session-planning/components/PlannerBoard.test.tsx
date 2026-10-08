import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { PlannerClass } from "../../../types/app";
import PlannerBoard from "./PlannerBoard";
import type { PlannerBoardCourse } from "../utils/plannerPresentation";

function course(classKey: string, laneIndex: number): PlannerBoardCourse {
    return {
        classKey,
        serviceName: `Swim ${classKey}`,
        eventId: classKey,
        eventTime: "9:00 AM - 9:30 AM",
        facility: "Main Pool",
        bookedCount: 4,
        maximumCapacity: 8,
        waitlistCount: 1,
        laneIndex,
        planningStatus: "active",
        startTime: "09:00",
        endTime: "09:30",
        startMinutes: 540,
        endMinutes: 570,
        runningTime: 30,
    };
}

function plannerClass(entry: PlannerBoardCourse): PlannerClass {
    return {
        classKey: entry.classKey,
        eventId: entry.eventId,
        sessionKey: "session-a",
        serviceName: entry.serviceName,
        dayOfWeek: "Mo",
        eventTime: entry.eventTime,
        facility: entry.facility,
        sessionSeason: "Fall",
        sessionYear: 2026,
        minimumCapacity: 2,
        maximumCapacity: entry.maximumCapacity,
        bookedCount: entry.bookedCount,
        waitlistCount: entry.waitlistCount,
        participantIds: [],
        waitingParticipantIds: [],
        laneIndex: entry.laneIndex,
        planningStatus: entry.planningStatus,
        plannedMoveType: "",
        plannedMoveTime: "",
        plannedMoveTargetClassKey: "",
        barcodeCancelledAt: "",
    };
}

it("selects classes and swaps same-time courses between lanes", async () => {
    const first = course("A", 0);
    const second = course("B", 1);
    const setClassLanes = vi.fn().mockResolvedValue(undefined);
    const setSelectedClassKey = vi.fn();
    const setIsInfoPanelOpen = vi.fn();
    const setSelectedDay = vi.fn();
    const setSelectedLocation = vi.fn();

    render(
        <PlannerBoard
            availableDays={["Mo", "Tu"]}
            availableLocations={["Main Pool", "North Pool"]}
            boardColumns={[[first], [second]]}
            scheduleHeightRem={6.8}
            scheduleStartMinutes={540}
            selectedClassKey=""
            selectedDay="Mo"
            selectedLocation="Main Pool"
            setClassLanes={setClassLanes}
            setIsInfoPanelOpen={setIsInfoPanelOpen}
            setSelectedClassKey={setSelectedClassKey}
            setSelectedDay={setSelectedDay}
            setSelectedLocation={setSelectedLocation}
            timeLabels={["09:00", "09:30"]}
            visibleClasses={[plannerClass(first), plannerClass(second)]}
            columnMinWidthPx={180}
            headerHeightRem={3.5}
            slotHeightRem={3.4}
            slotMinutes={30}
        />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tuesday" }));
    fireEvent.click(screen.getByRole("button", { name: "North Pool" }));
    expect(setSelectedDay).toHaveBeenCalledWith("Tu");
    expect(setSelectedLocation).toHaveBeenCalledWith("North Pool");

    const firstCard = screen.getByRole("button", { name: /Swim A/ });
    const secondCard = screen.getByRole("button", { name: /Swim B/ });
    fireEvent.click(firstCard);
    expect(setSelectedClassKey).toHaveBeenCalledWith("A");
    expect(setIsInfoPanelOpen).toHaveBeenCalledWith(true);

    fireEvent.dragStart(firstCard, {
        dataTransfer: { setDragImage: vi.fn() },
    });
    fireEvent.drop(secondCard);
    await waitFor(() =>
        expect(setClassLanes).toHaveBeenCalledWith({ A: 1, B: 0 })
    );
    expect(setClassLanes).toHaveBeenCalledTimes(1);
});
