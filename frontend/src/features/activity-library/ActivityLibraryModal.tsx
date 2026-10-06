import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import ActivityLibraryBrowser from "./ActivityLibraryBrowser";
import type { LibraryActivity } from "./activityLibrary";

type Props = {
    selectedSkill?: { id: string; compactName: string };
    onUse: (activity: LibraryActivity) => void;
    onClose: () => void;
};

export default function ActivityLibraryModal(
    { selectedSkill, onUse, onClose }: Props,
) {
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

    return createPortal(
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-4xl overflow-y-auto rounded-2xl border border-secondary/20 bg-bg p-0 text-secondary shadow-xl backdrop:bg-black/50"
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
        >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-secondary/20 bg-bg p-4 md:px-6">
                <h2 id={titleId} className="text-2xl font-semibold">
                    Activity Library
                </h2>
                <button
                    type="button"
                    className="shrink-0 rounded-lg border border-secondary/30 px-3 py-2 font-semibold hover:bg-accent"
                    onClick={onClose}
                    aria-label="Close activity library"
                >
                    Close
                </button>
            </div>
            <div className="p-4 md:p-6">
                <ActivityLibraryBrowser
                    onUse={onUse}
                    selectedSkill={selectedSkill}
                />
            </div>
        </dialog>,
        document.body,
    );
}
