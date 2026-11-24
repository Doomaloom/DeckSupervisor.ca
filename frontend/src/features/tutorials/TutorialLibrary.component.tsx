import { useEffect, useId, useState } from "react";
import { ModalShell } from "../../general-components";
import {
    formatDuration,
    TUTORIAL_TABS,
    tutorialVideoUrl,
    type TutorialVideo,
} from "./tutorialVideos";

type TutorialLibraryProps = { onClose: () => void };

export function TutorialLibrary({ onClose }: TutorialLibraryProps) {
    const uid = useId();
    const [activeId, setActiveId] = useState(TUTORIAL_TABS[0].id);
    const [selected, setSelected] = useState<TutorialVideo | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    const active = TUTORIAL_TABS.find((tab) => tab.id === activeId) ??
        TUTORIAL_TABS[0];

    const onTabKeyDown = (event: React.KeyboardEvent, index: number) => {
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % TUTORIAL_TABS.length;
        else if (event.key === "ArrowLeft") {
            next = (index - 1 + TUTORIAL_TABS.length) % TUTORIAL_TABS.length;
        } else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = TUTORIAL_TABS.length - 1;
        else return;
        event.preventDefault();
        setActiveId(TUTORIAL_TABS[next].id);
        document.getElementById(`${uid}-tab-${TUTORIAL_TABS[next].id}`)?.focus();
    };

    return (
        <ModalShell
            title="Tutorial videos"
            description="Short how-to videos for the website and the tablet."
            onClose={onClose}
            panelClassName="max-h-[90vh] overflow-y-auto p-4 sm:p-8"
        >
            <div className="mt-4 min-w-0">
                {selected
                    ? (
                        <div className="flex flex-col gap-3">
                            <button
                                type="button"
                                className="w-fit rounded-full bg-secondary px-4 py-2 text-accent transition hover:bg-primary"
                                onClick={() => {
                                    setSelected(null);
                                    setFailed(false);
                                }}
                            >
                                ← Back to videos
                            </button>
                            <h4 className="text-xl font-semibold">
                                {selected.title}
                            </h4>
                            {failed
                                ? (
                                    <p
                                        role="alert"
                                        className="rounded-card border-2 border-secondary/20 p-6 text-center"
                                    >
                                        This video isn't available yet.
                                    </p>
                                )
                                : (
                                    <video
                                        key={selected.file}
                                        className="w-full rounded-card bg-black"
                                        src={tutorialVideoUrl(selected.file)}
                                        controls
                                        preload="metadata"
                                        playsInline
                                        onError={() => setFailed(true)}
                                    />
                                )}
                        </div>
                    )
                    : (
                        <>
                            <div
                                role="tablist"
                                aria-label="Tutorial topics"
                                className="flex gap-2 overflow-x-auto pb-2"
                            >
                                {TUTORIAL_TABS.map((tab, index) => {
                                    const isActive = tab.id === active.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            id={`${uid}-tab-${tab.id}`}
                                            type="button"
                                            role="tab"
                                            aria-selected={isActive}
                                            aria-controls={`${uid}-panel`}
                                            tabIndex={isActive ? 0 : -1}
                                            onClick={() => setActiveId(tab.id)}
                                            onKeyDown={(e) =>
                                                onTabKeyDown(e, index)}
                                            className={`shrink-0 whitespace-nowrap rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${isActive
                                                ? "border-secondary bg-secondary text-accent"
                                                : "border-secondary/20 bg-accent text-secondary hover:border-secondary"
                                                }`}
                                        >
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <div
                                role="tabpanel"
                                id={`${uid}-panel`}
                                aria-labelledby={`${uid}-tab-${active.id}`}
                                className="mt-3 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2"
                            >
                                {active.videos.map((video) => (
                                    <button
                                        key={video.file}
                                        type="button"
                                        onClick={() => {
                                            setFailed(false);
                                            setSelected(video);
                                        }}
                                        className="flex min-w-0 flex-col gap-2 break-words rounded-card border-2 border-secondary/20 bg-accent p-4 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
                                    >
                                        <span className="text-lg font-semibold">
                                            {video.title}
                                        </span>
                                        <span className="text-sm text-secondary/80">
                                            {video.description}
                                        </span>
                                        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-secondary/70">
                                            <span>For: {video.audience}</span>
                                            <span>App: {video.app}</span>
                                            <span>
                                                {formatDuration(
                                                    video.durationSeconds,
                                                )}
                                            </span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
            </div>
        </ModalShell>
    );
}

export default TutorialLibrary;
