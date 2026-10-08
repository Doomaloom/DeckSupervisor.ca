import {
    ActionButton,
    Card,
    EmptyState,
    Notice,
    PageShell,
} from "../../general-components";
import { type ReactNode, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import useInstructorClasses from "./useInstructorClasses";
import type { InstructorClass, InstructorSession } from "../../lib/serverApi";

const pickerGridClassName =
    "grid auto-rows-fr grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] gap-3";
const weekArrowClassName =
    "flex h-14 min-w-0 items-center justify-center rounded-2xl border border-secondary/20 bg-accent px-0 py-2 text-center font-semibold text-secondary transition hover:-translate-y-0.5 hover:border-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-secondary/40 disabled:hover:translate-y-0 disabled:hover:border-secondary/20";
const classButtonClassName =
    "flex h-full min-h-24 min-w-0 flex-col justify-center gap-1 rounded-2xl border-2 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function closestUpcomingWeek(weeks: string[], now = new Date()) {
    if (!weeks.length) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Toronto",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(now);
    const date = (type: string) =>
        parts.find((part) => part.type === type)!.value;
    const today = `${date("year")}-${date("month")}-${date("day")}`;
    return weeks.find((week) => week >= today) || weeks[weeks.length - 1];
}

export default function PlanSelection(
    { title, children, printMode, onPrintModeChange, renderTogether, unframed }: {
        title: string;
        unframed?: boolean;
        children: (
            s: InstructorSession,
            c: InstructorClass,
            w: string,
        ) => ReactNode;
        printMode?: "separate" | "together";
        onPrintModeChange?: (mode: "separate" | "together") => void;
        renderTogether?: (
            s: InstructorSession,
            classes: InstructorClass[],
            w: string,
        ) => ReactNode;
    },
) {
    const [params] = useSearchParams();
    const state = useInstructorClasses();
    const [classId, setClassId] = useState("");
    const [week, setWeek] = useState("");
    useEffect(() => {
        if (!state.loading) {
            setClassId(
                (!params.get("session") ||
                        params.get("session") === state.sessionId) &&
                    state.classes.some((c) => c.id === params.get("class"))
                    ? params.get("class")!
                    : state.classes[0]?.id || "",
            );
            setWeek(closestUpcomingWeek(state.session?.weeks || []));
        }
    }, [state.loading, state.sessionId, state.classes, state.session, params]);
    const selected = state.classes.find((c) => c.id === classId);
    const weeks = state.session?.weeks || [];
    const weekIndex = weeks.indexOf(week);
    const [dirty, setDirty] = useState(false);
    // Editor signals unsaved changes so changing a selector also prompts.
    useEffect(() => {
        const listener = (e: Event) =>
            setDirty((e as CustomEvent<boolean>).detail);
        window.addEventListener("instructor-draft", listener);
        return () => window.removeEventListener("instructor-draft", listener);
    }, []);
    function change(action: () => void) {
        if (!dirty || window.confirm("Discard unsaved lesson plan changes?")) {
            setDirty(false);
            action();
        }
    }
    return (
        <PageShell className="min-w-0">
            <Card variant={unframed ? "plain" : "panel"} className="flex min-w-0 flex-col gap-6">
                <header className="flex flex-col gap-1">
                    <h2 className="text-2xl font-semibold">{title}</h2>
                </header>
                {state.loading && <p role="status">Loading linked classes…</p>}
                {state.error && (
                    <Notice tone="danger" role="alert">
                        {state.error}{" "}
                        <ActionButton onClick={() => change(state.refresh)}>
                            Retry
                        </ActionButton>
                    </Notice>
                )}
                {!state.loading && !state.error && !state.classes.length && (
                    <EmptyState>
                        No linked classes. Ask your supervisor to link your
                        account.
                    </EmptyState>
                )}
                {!state.loading && !state.error && state.classes.length > 0 && (
                    <>
                        {!state.session?.weeks.length && (
                            <p>
                                Planning is unavailable until the supervisor
                                completes valid session dates and scheduled
                                lesson days.
                            </p>
                        )}
                        {!!state.session?.weeks.length && (
                            <fieldset className="min-w-0">
                                <legend className="mb-2 text-sm font-semibold">
                                    Week{" "}
                                    <span className="font-normal">
                                        (lesson date, America/Toronto)
                                    </span>
                                </legend>
                                <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-stretch gap-2 sm:grid-cols-[5rem_minmax(0,1fr)_5rem] sm:gap-3">
                                    <button
                                        type="button"
                                        aria-label="Previous week"
                                        disabled={weekIndex <= 0}
                                        className={weekArrowClassName}
                                        onClick={() =>
                                            change(() =>
                                                setWeek(weeks[weekIndex - 1])
                                            )}
                                    >
                                        <svg
                                            aria-hidden="true"
                                            className="h-6 w-6"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                        >
                                            <path d="m15 6-6 6 6 6" />
                                        </svg>
                                    </button>
                                    <div
                                        role="status"
                                        aria-label="Selected week"
                                        className="flex h-14 min-w-0 items-center justify-center rounded-2xl border border-secondary/20 bg-accent px-3 text-center font-semibold text-secondary"
                                    >
                                        Week {weekIndex + 1} | {week}
                                    </div>
                                    <button
                                        type="button"
                                        aria-label="Next week"
                                        disabled={weekIndex < 0 ||
                                            weekIndex >= weeks.length - 1}
                                        className={weekArrowClassName}
                                        onClick={() =>
                                            change(() =>
                                                setWeek(weeks[weekIndex + 1])
                                            )}
                                    >
                                        <svg
                                            aria-hidden="true"
                                            className="h-6 w-6"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                        >
                                            <path d="m9 6 6 6-6 6" />
                                        </svg>
                                    </button>
                                </div>
                            </fieldset>
                        )}
                        {printMode && onPrintModeChange && (
                            <fieldset className="min-w-0">
                                <legend className="mb-2 text-sm font-semibold">
                                    Print classes
                                </legend>
                                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Print classes">
                                    {(["separate", "together"] as const).map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            aria-pressed={printMode === mode}
                                            className={`min-h-11 rounded-2xl border-2 px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                                                printMode === mode
                                                    ? "border-secondary bg-secondary text-accent shadow-sm"
                                                    : "border-secondary/20 bg-accent text-secondary hover:border-primary hover:shadow-sm"
                                            }`}
                                            onClick={() => onPrintModeChange(mode)}
                                        >
                                            {mode === "separate" ? "Separately" : "Together"}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>
                        )}
                        {printMode !== "together" && <fieldset className="min-w-0">
                            <legend className="mb-2 text-sm font-semibold">
                                Class
                            </legend>
                            <div className={pickerGridClassName}>
                                {state.classes.map((c) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        aria-pressed={classId === c.id}
                                        aria-label={`${c.level} · ${c.code} · ${
                                            c.start_time.slice(0, 5)
                                        } · ${c.instructor}`}
                                        title={`${c.level} · ${c.code} · ${
                                            c.start_time.slice(0, 5)
                                        } · ${c.instructor}`}
                                        className={`${classButtonClassName} ${
                                            classId === c.id
                                                ? "border-secondary bg-secondary text-accent shadow-sm"
                                                : "border-secondary/20 bg-accent text-secondary hover:border-primary"
                                        }`}
                                        onClick={() => {
                                            if (classId !== c.id) {
                                                change(() => setClassId(c.id));
                                            }
                                        }}
                                    >
                                        <span className="w-full break-words font-semibold">
                                            {c.level}
                                        </span>
                                        <span className={`w-fit max-w-full truncate rounded-full border px-2 py-0.5 text-xs font-semibold ${
                                            classId === c.id
                                                ? "border-accent/40 bg-accent/15 text-accent"
                                                : "border-secondary/20 bg-accent text-secondary"
                                        }`}>
                                            {c.code}
                                        </span>
                                        <span className={`flex w-full min-w-0 items-center gap-1 text-sm ${
                                            classId === c.id
                                                ? "text-accent/90"
                                                : "text-secondary/80"
                                        }`}>
                                            <span className="shrink-0 tabular-nums">
                                                {c.start_time.slice(0, 5)}
                                            </span>
                                            <span aria-hidden="true">·</span>
                                            <span className="min-w-0 truncate">
                                                {c.instructor}
                                            </span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </fieldset>}
                        {state.session && week &&
                            (printMode === "together" || selected) && (
                            <div className="min-w-0 border-t border-secondary/20 pt-6">
                                {printMode === "together" && renderTogether
                                    ? renderTogether(state.session, state.classes, week)
                                    : selected && children(state.session, selected, week)}
                            </div>
                        )}
                    </>
                )}
            </Card>
        </PageShell>
    );
}
