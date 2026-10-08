import { useId, useState } from "react";

import { type ActivityCategory, type DrillSkill, filterActivities, type LibraryActivity, type WorkoutGroup, workoutPrefix } from "../activityLibrary";

export type Props = {
    onUse?: (activity: LibraryActivity) => void;
    selectedSkill?: { id: string; compactName: string };
};

export function displayTitle(
    activity: LibraryActivity,
    drillSkill: DrillSkill | "All",
    workoutGroup: WorkoutGroup | "All",
) {
    if (activity.category === "Drills" && drillSkill !== "All") {
        const prefix = `${drillSkill}: `;
        if (activity.title.startsWith(prefix)) {
            return activity.title.slice(prefix.length);
        }
    }
    if (activity.category === "Workouts" && workoutGroup !== "All") {
        const prefix = workoutPrefix(workoutGroup);
        if (activity.title.startsWith(prefix)) {
            return activity.title.slice(prefix.length);
        }
    }
    return activity.title;
}
export function useActivityLibraryBrowserLogic({ onUse, selectedSkill }: Props) {
    const searchId = useId();
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState<ActivityCategory | "All">("All");
    const [drillSkill, setDrillSkill] = useState<DrillSkill | "All">("All");
    const [workoutGroup, setWorkoutGroup] = useState<WorkoutGroup | "All">("All");
    const [applicableOnly, setApplicableOnly] = useState(false);
    const results = filterActivities(
        query,
        category,
        applicableOnly ? selectedSkill?.id : undefined,
        category === "Drills" && drillSkill !== "All" ? drillSkill : undefined,
        category === "Workouts" && workoutGroup !== "All"
            ? workoutGroup
            : undefined,
    );

    return {
        view: "ready" as const,
        category,
        setCategory,
        setDrillSkill,
        setWorkoutGroup,
        searchId,
        query,
        setQuery,
        drillSkill,
        workoutGroup,
        onUse,
        applicableOnly,
        selectedSkill,
        setApplicableOnly,
        results,
    };

}
