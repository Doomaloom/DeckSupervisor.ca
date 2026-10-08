import { type ReactNode, useEffect, useState } from "react";

import { useSearchParams } from "react-router-dom";

import useInstructorClasses from "../session/useInstructorClasses";

import type { InstructorClass, InstructorSession } from "../../../lib/serverApi";

export const pickerGridClassName =
    "grid auto-rows-fr grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] gap-3";

export const weekArrowClassName =
    "flex h-14 min-w-0 items-center justify-center rounded-2xl border border-secondary/20 bg-accent px-0 py-2 text-center font-semibold text-secondary transition hover:-translate-y-0.5 hover:border-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-secondary/40 disabled:hover:translate-y-0 disabled:hover:border-secondary/20";

export const classButtonClassName =
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
export function usePlanSelectionLogic({ title, children, printMode, onPrintModeChange, renderTogether, unframed }: {
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
}) {
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
    return {
        view: "ready" as const,
        unframed,
        title,
        state,
        change,
        weeks,
        weekIndex,
        setWeek,
        week,
        printMode,
        onPrintModeChange,
        classId,
        setClassId,
        selected,
        renderTogether,
        children,
    };

}
