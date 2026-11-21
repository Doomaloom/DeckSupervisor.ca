import { useEffect, useRef, useState } from "react";
import { formatLevelName } from "../../../../shared/levels/formatLevelName";
import {
    type CardSaveState,
    emptyCardSaveState,
} from "../hooks/useRosterEdits";
import type { LevelMode } from "../LevelModeSwitch/LevelModeSwitch.component";
import type { RosterGroup } from "../types";
import {
    getOwnLevelStudents,
    getVisibleRosterStudents,
    getWaitlistedRosterStudents,
} from "../utils";

export type RosterCardProps = {
    roster: RosterGroup;
    isCustom?: boolean;
    // False for someone who may view levels but not change them.
    canEdit?: boolean;
    saveState?: CardSaveState;
    onPrint: (roster: RosterGroup) => void;
    onClassLevelChange: (code: string, level: string) => void;
    onSetAllToLevel?: (code: string, level: string) => void;
    onCustomRosterLevelChange?: (id: string, level: string) => void;
    onStudentLevelChange: (studentId: string, level: string) => void;
    onRetrySave?: (code: string, target: string) => void;
};

export function useRosterCardLogic({
    roster,
    isCustom = false,
    canEdit = true,
    saveState = emptyCardSaveState,
    onPrint,
    onClassLevelChange,
    onSetAllToLevel,
    onCustomRosterLevelChange,
    onStudentLevelChange,
    onRetrySave,
}: RosterCardProps) {
    const containerClass = isCustom
        ? "rounded-2xl border-2 border-blue-200 bg-blue-100 p-6 shadow-md"
        : "rounded-2xl border-2 border-secondary/20 bg-accent p-6 shadow-md";
    const customId = roster.customRosterId ??
        roster.code.replace(/^custom-/, "");
    const actionButtonClass =
        "rounded-lg bg-primary px-3 py-1 text-white transition hover:-translate-y-0.5 hover:bg-secondary";

    const classLevel = roster.level;
    const registeredLevel = roster.registeredLevel ?? roster.level;
    const booked = getVisibleRosterStudents(roster.students);
    const waitlisted = getWaitlistedRosterStudents(roster.students);
    const ownLevelStudents = isCustom
        ? []
        : getOwnLevelStudents(roster.students, classLevel);
    const hasOwnLevels = ownLevelStudents.length > 0;

    // The mode follows the data when the card shows: each swimmer when someone
    // has their own level. Nothing is stored; switching changes this card only.
    const [mode, setMode] = useState<LevelMode>(
        hasOwnLevels ? "swimmer" : "class",
    );
    // Once the user has used the switch or changed a swimmer here, the card
    // keeps its mode; until then it follows the data, including saved levels
    // that arrive after the card first shows.
    const touched = useRef(false);
    useEffect(() => {
        if (hasOwnLevels) {
            setMode("swimmer");
        } else if (!touched.current) {
            setMode("class");
        }
    }, [hasOwnLevels]);
    const [switchBackOpen, setSwitchBackOpen] = useState(false);

    const levels = new Set(booked.map((student) =>
        formatLevelName(student.level)
    ));
    const sharedLevel = hasOwnLevels && levels.size === 1
        ? Array.from(levels)[0]
        : null;

    const onModeChange = (next: LevelMode) => {
        touched.current = true;
        if (next === "swimmer") {
            setMode("swimmer");
            return;
        }
        if (!hasOwnLevels) {
            setMode("class");
            return;
        }
        setSwitchBackOpen(true);
    };

    const setAllToLevel = (level: string) => {
        setSwitchBackOpen(false);
        setMode("class");
        (onSetAllToLevel ?? onClassLevelChange)(roster.code, level);
    };

    const failureFor = (target: string) =>
        saveState.failures.find((failure) => failure.target === target);
    const classNotSaved = Boolean(failureFor("class"));

    return {
        containerClass,
        actionButtonClass,
        roster,
        isCustom,
        customId,
        canEdit,
        mode,
        classLevel,
        registeredLevel,
        isChangedFromRegistered: classLevel !== registeredLevel,
        booked,
        waitlisted,
        ownLevelStudents,
        hasOwnLevels,
        sharedLevel,
        showMixedTag: mode === "swimmer" && hasOwnLevels,
        saveStatus: saveState.status,
        failures: saveState.failures,
        classNotSaved,
        isStudentNotSaved: (studentId: string) =>
            Boolean(failureFor(studentId)),
        switchBackOpen,
        onModeChange,
        onCancelSwitchBack: () => setSwitchBackOpen(false),
        onSetAll: () => setAllToLevel(classLevel),
        onMakeClassLevel: () => {
            if (sharedLevel) {
                setAllToLevel(sharedLevel);
            }
        },
        onClassLevelSelect: (level: string) => {
            if (isCustom) {
                onCustomRosterLevelChange?.(customId, level);
                return;
            }
            onClassLevelChange(roster.code, level);
        },
        onResetClassLevel: () =>
            onClassLevelChange(roster.code, registeredLevel),
        onStudentLevelChange: (studentId: string, level: string) => {
            touched.current = true;
            onStudentLevelChange(studentId, level);
        },
        onPrint,
        onRetry: (target: string) => onRetrySave?.(roster.code, target),
    };
}
