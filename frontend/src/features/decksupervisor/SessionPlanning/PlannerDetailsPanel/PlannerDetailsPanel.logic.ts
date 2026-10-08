import { useEffect, useState } from "react";

import type { PlannerCallRecordUpdate, PlannerClass, PlannerClassMoveType, PlannerClassStatus, PlannerDataset, PlannerParticipant } from "../../../../types/app";

import { getPlannerMoveTargetLabel, type PlannerAlternativeGroups } from "../../../../lib/sessionPlanner";

import { dayNames } from "../utils/plannerPresentation";

export type PlannerDetailsPanelProps = {
    alternatives: PlannerAlternativeGroups;
    bookedParticipants: PlannerParticipant[];
    dataset: PlannerDataset | null;
    isInfoPanelOpen: boolean;
    selectedClass: PlannerClass | null;
    setCallRecord: (
        participantId: string,
        update: PlannerCallRecordUpdate,
    ) => void | Promise<void>;
    setClassMove: (
        classKey: string,
        update: {
            plannedMoveType?: PlannerClassMoveType;
            plannedMoveTime?: string;
            plannedMoveTargetClassKey?: string;
        },
    ) => void | Promise<void>;
    setClassStatus: (
        classKey: string,
        status: PlannerClassStatus,
    ) => void | Promise<void>;
    setIsInfoPanelOpen: (value: boolean) => void;
    startCall: (participantId: string) => void;
    waitingParticipants: PlannerParticipant[];
};

export function formatAlternativeLabel(option: PlannerClass) {
    return `${dayNames[option.dayOfWeek] ?? option.dayOfWeek
        } • ${option.eventTime} • ${option.facility}`;
}
export function userenderAlternativeSectionLogic(title: string, options: PlannerClass[], renderOption: (option: PlannerClass) => JSX.Element) {
    if (options.length === 0) {
        return { view: "hidden" as const };
    }

    return {
        view: "ready" as const,
        title,
        options,
        renderOption,
    };

}

export function usePlannerDetailsPanelLogic({
    alternatives,
    bookedParticipants,
    dataset,
    isInfoPanelOpen,
    selectedClass,
    setCallRecord,
    setClassMove,
    setClassStatus,
    setIsInfoPanelOpen,
    startCall,
    waitingParticipants,
}: PlannerDetailsPanelProps) {
    const [openAlternativeParticipantId, setOpenAlternativeParticipantId] =
        useState("");
    const [draftMoveTime, setDraftMoveTime] = useState("");

    useEffect(() => {
        setDraftMoveTime(selectedClass?.plannedMoveTime ?? "");
    }, [selectedClass?.classKey, selectedClass?.plannedMoveTime]);

    if (!isInfoPanelOpen) {
        return { view: "hidden" as const };
    }

    const plannedMoveLabel = selectedClass && dataset
        ? getPlannerMoveTargetLabel(dataset, selectedClass)
        : "";
    const allAlternatives = [
        ...alternatives.availableAlternatives,
        ...alternatives.fullAlternatives,
    ];
    return {
        view: "ready" as const,
        selectedClass,
        dataset,
        setIsInfoPanelOpen,
        setClassStatus,
        setClassMove,
        draftMoveTime,
        setDraftMoveTime,
        allAlternatives,
        plannedMoveLabel,
        alternatives,
        waitingParticipants,
        setCallRecord,
        bookedParticipants,
        setOpenAlternativeParticipantId,
        openAlternativeParticipantId,
        startCall,
    };

}
