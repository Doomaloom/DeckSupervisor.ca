import { useState } from "react";

import type { PlannerDataset, PlannerShareSession } from "../../../../types/app";

export type PlannerHeaderProps = {
    dataset: PlannerDataset | null;
    error: string;
    isPopout: boolean;
    isSharedMode: boolean;
    isShareHost: boolean;
    isSharingBusy: boolean;
    shareCode: string;
    shareDisplayName: string;
    shareLocationOverrides: Record<string, string>;
    shareNotice: string;
    sharePhoneNumber: string;
    shareCcEmail: string;
    shareSession: PlannerShareSession | null;
    statusMessage: string;
    showPlannedChangesButton: boolean;
    onHandleImport: (
        activitySummaryFile: File,
        rosterFile: File,
        mergeWithCurrent: boolean,
    ) => void | Promise<void>;
    onJoinSharedPlanner: () => void | Promise<void>;
    onLeaveSharedPlannerSession: () => void | Promise<void>;
    onLoadState: (file: File | null) => void | Promise<void>;
    onOpenPopout: () => void;
    onOpenPlannedChanges: () => void;
    onSaveState: () => void;
    onSetShareDisplayName: (value: string) => void;
    onSetShareLocationOverride: (facility: string, value: string) => void;
    onSetSharePhoneNumber: (value: string) => void;
    onSetShareCcEmail: (value: string) => void;
    onSaveSharedDetails: () => void | Promise<void>;
    onStartSharing: () => void | Promise<void>;
    onStopSharing: () => void | Promise<void>;
};
export function usePlannerHeaderLogic({
    dataset,
    error,
    isPopout,
    isSharedMode,
    isShareHost,
    isSharingBusy,
    shareCode,
    shareDisplayName,
    shareLocationOverrides,
    shareNotice,
    sharePhoneNumber,
    shareCcEmail,
    shareSession,
    statusMessage,
    showPlannedChangesButton,
    onHandleImport,
    onJoinSharedPlanner,
    onLeaveSharedPlannerSession,
    onLoadState,
    onOpenPopout,
    onOpenPlannedChanges,
    onSaveState,
    onSetShareDisplayName,
    onSetShareLocationOverride,
    onSetSharePhoneNumber,
    onSetShareCcEmail,
    onSaveSharedDetails,
    onStartSharing,
    onStopSharing,
}: PlannerHeaderProps) {
    const [activitySummaryFile, setActivitySummaryFile] = useState<File | null>(
        null,
    );
    const [rosterFile, setRosterFile] = useState<File | null>(null);
    const facilities = dataset
        ? Array.from(
            new Set(dataset.sessions.map((session) => session.facility)),
        )
            .sort((left, right) => left.localeCompare(right))
        : [];

    return {
        view: "ready" as const,
        onSaveState,
        dataset,
        onLoadState,
        showPlannedChangesButton,
        onOpenPlannedChanges,
        isPopout,
        onOpenPopout,
        shareCode,
        activitySummaryFile,
        setActivitySummaryFile,
        rosterFile,
        setRosterFile,
        onHandleImport,
        shareDisplayName,
        onSetShareDisplayName,
        facilities,
        shareLocationOverrides,
        onSetShareLocationOverride,
        sharePhoneNumber,
        onSetSharePhoneNumber,
        shareCcEmail,
        onSetShareCcEmail,
        onStartSharing,
        isSharingBusy,
        isSharedMode,
        onJoinSharedPlanner,
        shareSession,
        shareNotice,
        isShareHost,
        onStopSharing,
        onLeaveSharedPlannerSession,
        onSaveSharedDetails,
        statusMessage,
        error,
    };

}
