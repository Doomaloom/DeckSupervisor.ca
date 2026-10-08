import React from "react";

import type { FullTimeRequestEntry } from "../types";

export type FullTimeRequestDraft = {
    firstName: string;
    lastName: string;
    phone: string;
    instructor: string;
};

export type FullTimeRequestListPanelProps = {
    draft: FullTimeRequestDraft;
    entries: FullTimeRequestEntry[];
    onDraftChange: (field: keyof FullTimeRequestDraft, value: string) => void;
    onAddRequest: () => void;
    onImportCsv: (file: File | null) => void;
    onAutoAssign: () => void;
    onReattemptEntry: (id: string) => void;
    onEntryChange: <K extends keyof FullTimeRequestEntry>(
        id: string,
        field: K,
        value: FullTimeRequestEntry[K],
    ) => void;
    onDeleteRequest: (id: string) => void;
};
export function useFullTimeRequestListPanelLogic({
    draft,
    entries,
    onDraftChange,
    onAddRequest,
    onImportCsv,
    onAutoAssign,
    onReattemptEntry,
    onEntryChange,
    onDeleteRequest,
}: FullTimeRequestListPanelProps) {
    const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
    const [showOnlyNonAccommodated, setShowOnlyNonAccommodated] = React
        .useState(
            false,
        );
    const visibleEntries = showOnlyNonAccommodated
        ? entries.filter((entry) => !entry.accommodated)
        : entries;
    const nonAccommodatedCount =
        entries.filter((entry) => !entry.accommodated).length;

    return {
        view: "ready" as const,
        uploadInputRef,
        onImportCsv,
        onAutoAssign,
        draft,
        onDraftChange,
        onAddRequest,
        entries,
        nonAccommodatedCount,
        showOnlyNonAccommodated,
        setShowOnlyNonAccommodated,
        visibleEntries,
        onEntryChange,
        onReattemptEntry,
        onDeleteRequest,
    };

}
