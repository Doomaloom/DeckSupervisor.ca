import { useEffect, useId, useRef } from "react";

export type OwnLevelSwimmer = {
    id: string;
    name: string;
    level: string;
};

type SwitchBackDialogProps = {
    classLevel: string;
    swimmers: OwnLevelSwimmer[];
    // Set when every booked swimmer is on one level other than the class level.
    sharedLevel: string | null;
    onCancel: () => void;
    onSetAll: () => void;
    onMakeClassLevel: () => void;
};

const primaryClass =
    "rounded-lg bg-primary px-3 py-1 text-white transition hover:-translate-y-0.5 hover:bg-secondary";
const outlineClass =
    "rounded-lg border-2 border-secondary px-3 py-1 text-secondary hover:bg-bg";

// Asks before switching back to whole class, because it resets the swimmers
// who have their own level.
function SwitchBackDialog(
    {
        classLevel,
        swimmers,
        sharedLevel,
        onCancel,
        onSetAll,
        onMakeClassLevel,
    }: SwitchBackDialogProps,
) {
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement | null>(null);
    const primaryRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        primaryRef.current?.focus();
        return () => previous?.focus?.();
    }, []);

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Escape") {
            event.stopPropagation();
            onCancel();
            return;
        }
        if (event.key !== "Tab") {
            return;
        }
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled])",
        );
        if (!focusable || focusable.length === 0) {
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    return (
        <div
            className="fixed inset-0 z-20 flex items-center justify-center bg-secondary/40 p-4"
            role="presentation"
            onKeyDown={onKeyDown}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                data-component="switch-back-dialog"
                className="w-full max-w-md rounded-2xl border-2 border-secondary/20 bg-accent p-6 shadow-xl"
            >
                <h2 id={titleId} className="text-lg font-semibold text-secondary">
                    Use one level for the whole class?
                </h2>
                <p className="mt-2 text-sm text-secondary">
                    {swimmers.length === 1
                        ? "This swimmer has their own level."
                        : `These ${swimmers.length} swimmers have their own level.`}{" "}
                    They will be set to {classLevel}:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-secondary">
                    {swimmers.map((swimmer) => (
                        <li key={swimmer.id}>
                            <span className="font-medium">{swimmer.name}:</span>{" "}
                            {swimmer.level} → {classLevel}
                        </li>
                    ))}
                </ul>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button type="button" className={outlineClass} onClick={onCancel}>
                        Cancel
                    </button>
                    {sharedLevel && (
                        <button
                            type="button"
                            className="rounded-lg border-2 border-primary px-3 py-1 text-primary hover:bg-bg"
                            onClick={onMakeClassLevel}
                        >
                            Make {sharedLevel} the class level
                        </button>
                    )}
                    <button
                        ref={primaryRef}
                        type="button"
                        className={primaryClass}
                        onClick={onSetAll}
                    >
                        Set all to {classLevel}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SwitchBackDialog;
