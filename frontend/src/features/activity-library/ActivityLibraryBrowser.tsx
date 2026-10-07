import { useId, useState } from "react";
import { ActionButton, EmptyState, TextInput } from "../../general-components";
import {
    activityCategories,
    type ActivityCategory,
    drillSkills,
    type DrillSkill,
    filterActivities,
    type LibraryActivity,
    librarySkills,
    workoutGroups,
    type WorkoutGroup,
    workoutPrefix,
} from "./activityLibrary";

type Props = {
    onUse?: (activity: LibraryActivity) => void;
    selectedSkill?: { id: string; compactName: string };
};

function displayTitle(
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

export default function ActivityLibraryBrowser(
    { onUse, selectedSkill }: Props,
) {
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

    return (
        <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-end gap-4">
                <div
                    role="group"
                    aria-label="Activity categories"
                    className="flex flex-wrap gap-2"
                >
                    {(["All", ...activityCategories] as const).map((value) => (
                        <ActionButton
                            key={value}
                            className="w-32"
                            variant={category === value ? "primary" : "outline"}
                            aria-pressed={category === value}
                            onClick={() => {
                                setCategory(value);
                                if (value !== "Drills") setDrillSkill("All");
                                if (value !== "Workouts") setWorkoutGroup("All");
                            }}
                        >
                            {value}
                        </ActionButton>
                    ))}
                </div>
                <label
                    htmlFor={searchId}
                    className="min-w-[16rem] flex-1 space-y-2 text-sm font-semibold"
                >
                    <span>Search activities</span>
                    <TextInput
                        id={searchId}
                        type="search"
                        className="w-full"
                        placeholder="Search names, instructions, or equipment"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </label>
            </div>
            {category === "Drills" && (
                <div role="group" aria-label="Drill skills" className="space-y-2">
                    <p className="text-sm font-semibold">Skill</p>
                    <div className="flex flex-wrap gap-2">
                        {(["All", ...drillSkills] as const).map((skill) => (
                            <ActionButton
                                key={skill}
                                className="w-32"
                                variant={drillSkill === skill ? "primary" : "outline"}
                                aria-pressed={drillSkill === skill}
                                onClick={() => setDrillSkill(skill)}
                            >
                                {skill}
                            </ActionButton>
                        ))}
                    </div>
                </div>
            )}
            {category === "Workouts" && (
                <div role="group" aria-label="Workout groups" className="space-y-2">
                    <p className="text-sm font-semibold">Workout group</p>
                    <div className="flex flex-wrap gap-2">
                        {(["All", ...workoutGroups] as const).map((group) => (
                            <ActionButton
                                key={group}
                                className="w-40"
                                variant={workoutGroup === group ? "primary" : "outline"}
                                aria-pressed={workoutGroup === group}
                                onClick={() => setWorkoutGroup(group)}
                            >
                                {group}
                            </ActionButton>
                        ))}
                    </div>
                </div>
            )}
            {onUse && (
                <div className="space-y-1">
                    <label className="flex items-start gap-2 text-sm font-semibold">
                        <input
                            className="mt-1 h-4 w-4 shrink-0"
                            type="checkbox"
                            checked={applicableOnly}
                            disabled={!selectedSkill}
                            onChange={(event) =>
                                setApplicableOnly(event.target.checked)}
                        />
                        <span>
                            {selectedSkill
                                ? `Only activities for ${selectedSkill.compactName}`
                                : "Only activities for the selected skill"}
                        </span>
                    </label>
                    {!selectedSkill && (
                        <p className="text-sm text-secondary/80">
                            Choose a curriculum skill in the lesson row to
                            filter by skill.
                        </p>
                    )}
                </div>
            )}
            <p role="status" className="text-sm text-secondary/80">
                {results.length}{" "}
                {results.length === 1 ? "activity" : "activities"}
            </p>
            {!results.length && (
                <EmptyState>
                    <p>No activities match these filters.</p>
                    <ActionButton
                        className="mt-3"
                        variant="outline"
                        onClick={() => {
                            setQuery("");
                            setCategory("All");
                            setDrillSkill("All");
                            setWorkoutGroup("All");
                            setApplicableOnly(false);
                        }}
                    >
                        Clear filters
                    </ActionButton>
                </EmptyState>
            )}
            {activityCategories.map((group) => {
                const entries = results.filter((activity) =>
                    activity.category === group
                );
                const isAgeWorkoutGroup = group === "Workouts" &&
                    workoutGroup !== "All" &&
                    workoutGroup !== "Warm-ups" &&
                    workoutGroup !== "Cool-downs";
                const intervalWorkouts = entries.filter((activity) =>
                    activity.title.includes("Interval workout")
                );
                const components = entries.filter((activity) =>
                    !activity.title.includes("Interval workout")
                );
                const renderActivity = (activity: LibraryActivity) => (
                    <details
                        key={activity.id}
                        className="rounded-2xl border border-secondary/20 bg-accent open:shadow-sm"
                    >
                        <summary className="cursor-pointer rounded-2xl p-4 font-semibold focus-visible:outline-2 focus-visible:outline-primary">
                            {displayTitle(activity, drillSkill, workoutGroup)}
                        </summary>
                        <div className="space-y-4 px-4 pb-4">
                            {activity.suitability && <p className="text-sm"><strong>Suitable for:</strong> {activity.suitability}</p>}
                            {activity.equipment && <p className="text-sm"><strong>Equipment:</strong> {activity.equipment}</p>}
                            <p className="whitespace-pre-wrap break-words leading-relaxed">{activity.instructions}</p>
                            {!!activity.skillIds.length && (
                                <details className="text-sm">
                                    <summary className="cursor-pointer font-semibold">Applicable skills</summary>
                                    <ul className="mt-2 list-disc space-y-1 pl-5">
                                        {librarySkills.filter((skill) => activity.skillIds.includes(skill.id)).map((skill) => (
                                            <li key={skill.id}>{skill.level}: {skill.compactName}</li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                            <p className="text-xs text-secondary/70">
                                Source: Lifesaving Society, Teaching Swim for Life · Activity library.pdf, {activity.sourcePages.length === 1 ? "scan page" : "scan pages"} {activity.sourcePages.join(", ")}
                            </p>
                            {onUse && <ActionButton variant="primary" onClick={() => onUse(activity)} aria-label={`Use ${displayTitle(activity, drillSkill, workoutGroup)}`}>Use activity</ActionButton>}
                        </div>
                    </details>
                );
                return entries.length > 0 && (
                    <section key={group} aria-label={group} className="space-y-3">
                        <h3 className="text-xl font-semibold">
                            {group}{" "}
                            <span className="text-sm font-normal text-secondary/70">({entries.length})</span>
                        </h3>
                        {isAgeWorkoutGroup && intervalWorkouts.length > 0 && (
                            <h4 className="text-lg font-semibold">Interval Workouts</h4>
                        )}
                        {(isAgeWorkoutGroup ? intervalWorkouts : entries).map(renderActivity)}
                        {isAgeWorkoutGroup && components.length > 0 && (
                            <>
                                <h4 className="pt-3 text-lg font-semibold">Main Set Components</h4>
                                {components.map(renderActivity)}
                            </>
                        )}
                    </section>
                );
            })}
        </div>
    );
}
