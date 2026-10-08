import type { PlannerCallStatus } from "../../../../types/app";

import type { PlannerClass, PlannerDataset, PlannerParticipant, PlannerParticipantCallRecord, } from "../../../../types/app";

import { dayNames } from "../utils/plannerPresentation";

export type PlannedChangeRow = {
    participant: PlannerParticipant;
    callRecord: PlannerParticipantCallRecord;
};

export type PlannedChangeGroup = {
    plannerClass: PlannerClass;
    rows: PlannedChangeRow[];
};

export type PlannerPlannedChangesModalProps = {
    dataset: PlannerDataset;
    groups: PlannedChangeGroup[];
    onClose: () => void;
    onOpenEmailDraft: (
        participant: PlannerParticipant,
        plannerClass: PlannerClass,
        callRecord: PlannerParticipantCallRecord,
    ) => void;
    onToggleAcceptedChecklistItem: (
        participantId: string,
        field:
            | "withdrawRefundAt"
            | "refundReceiptSentAt"
            | "reRegisteredAt"
            | "registrationConfirmationSentAt",
        isDone: boolean,
    ) => void | Promise<void>;
    onToggleBarcodeCancelled: (
        classKey: string,
        isDone: boolean,
    ) => void | Promise<void>;
    onToggleComplete: (
        participantId: string,
        isComplete: boolean,
    ) => void | Promise<void>;
    onToggleEmailSent: (
        participantId: string,
        isSent: boolean,
    ) => void | Promise<void>;
};

export const statusLabels: Record<PlannerCallStatus, string> = {
    not_started: "Not started",
    called: "Called",
    voicemail: "Voicemail",
    reached: "Reached",
    declined_alternatives: "Declined alternatives",
    accepted_alternative: "Accepted alternative",
};
export function usePlannerPlannedChangesModalLogic({
    dataset,
    groups,
    onClose,
    onOpenEmailDraft,
    onToggleAcceptedChecklistItem,
    onToggleBarcodeCancelled,
    onToggleComplete,
    onToggleEmailSent,
}: PlannerPlannedChangesModalProps) {
    const getAlternativeLabel = (classKey: string) => {
        const plannerClass = dataset.classes.find((item) =>
            item.classKey === classKey
        );
        if (!plannerClass) {
            return classKey;
        }
        return `${plannerClass.serviceName} • ${dayNames[plannerClass.dayOfWeek] ?? plannerClass.dayOfWeek
            } • ${plannerClass.eventTime} • ${plannerClass.facility}`;
    };

    if (groups.length === 0) {
        return { view: "hidden" as const };
    }

    return {
        view: "ready" as const,
        onClose,
        groups,
        dataset,
        onToggleBarcodeCancelled,
        onOpenEmailDraft,
        onToggleEmailSent,
        onToggleComplete,
        getAlternativeLabel,
        onToggleAcceptedChecklistItem,
    };

}
