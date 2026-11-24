import { useState } from "react";
import { PlayCircleIcon } from "@heroicons/react/24/outline";
import { TutorialLibrary } from "./TutorialLibrary.component";

export function TutorialLibraryButton({ className }: { className?: string }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                className={className ??
                    "flex w-fit items-center gap-2 rounded-full border-2 border-secondary/20 bg-accent px-4 py-2 font-semibold text-secondary transition hover:-translate-y-0.5 hover:border-secondary"}
                onClick={() => setOpen(true)}
            >
                <PlayCircleIcon className="h-5 w-5" aria-hidden="true" />
                Tutorial videos
            </button>
            {open ? <TutorialLibrary onClose={() => setOpen(false)} /> : null}
        </>
    );
}

export default TutorialLibraryButton;
