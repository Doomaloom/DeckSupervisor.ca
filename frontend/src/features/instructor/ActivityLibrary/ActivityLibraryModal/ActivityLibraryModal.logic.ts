import { useEffect, useId, useRef } from "react";

import type { LibraryActivity } from "../activityLibrary";

export type Props = {
    selectedSkill?: { id: string; compactName: string };
    onUse: (activity: LibraryActivity) => void;
    onClose: () => void;
};
export function useActivityLibraryModalLogic({ selectedSkill, onUse, onClose }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        const trigger = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const dialog = dialogRef.current!;
        dialog.showModal();
        return () => {
            dialog.close();
            trigger?.focus();
        };
    }, []);

    return {
        view: "ready" as const,
        dialogRef,
        titleId,
        onClose,
        onUse,
        selectedSkill,
    };

}
