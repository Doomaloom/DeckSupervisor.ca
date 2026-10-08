import type { PlannerCallRecordUpdate, PlannerClass, PlannerParticipant, PlannerParticipantCallRecord } from "../../../../types/app";

import type { PlannerAlternativeGroups } from "../../../../lib/sessionPlanner";

export type PlannerCallModalProps = {
    activeCallParticipant: PlannerParticipant | null;
    activeCallRecord: PlannerParticipantCallRecord | null;
    alternatives: PlannerAlternativeGroups;
    callScriptMode: "live" | "voicemail";
    callerLocationName: string;
    callerName: string;
    callerPhoneNumber: string;
    plannedMoveLabel: string;
    onClose: () => void;
    onFinishCall: () => void | Promise<void>;
    onSetCallRecord: (
        participantId: string,
        update: PlannerCallRecordUpdate,
    ) => void | Promise<void>;
    onSetCallScriptMode: (mode: "live" | "voicemail") => void;
    selectedClass: PlannerClass | null;
};
export function usePlannerCallModalLogic({
    activeCallParticipant,
    activeCallRecord,
    alternatives,
    callScriptMode,
    callerLocationName,
    callerName,
    callerPhoneNumber,
    plannedMoveLabel,
    onClose,
    onFinishCall,
    onSetCallRecord,
    onSetCallScriptMode,
    selectedClass,
}: PlannerCallModalProps) {
    if (!activeCallParticipant || !activeCallRecord || !selectedClass) {
        return { view: "hidden" as const };
    }

    const isPlannedMove = selectedClass.planningStatus === "planned_move";
    const moveDestination = plannedMoveLabel || "a new class time";
    const allAlternatives = [
        ...alternatives.availableAlternatives,
        ...alternatives.fullAlternatives,
    ];

    return {
        view: "ready" as const,
        activeCallParticipant,
        onClose,
        callScriptMode,
        onSetCallScriptMode,
        callerName,
        callerLocationName,
        isPlannedMove,
        selectedClass,
        moveDestination,
        callerPhoneNumber,
        allAlternatives,
        alternatives,
        activeCallRecord,
        onSetCallRecord,
        onFinishCall,
    };

}
