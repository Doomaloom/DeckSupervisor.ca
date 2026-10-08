import { ActionButton, EmptyState, TextInput } from "../../../../general-components";

import { activityCategories, drillSkills, type LibraryActivity, librarySkills, workoutGroups } from "../activityLibrary";
import { displayTitle, Props, useActivityLibraryBrowserLogic } from "./ActivityLibraryBrowser.logic";
export default function ActivityLibraryBrowser(props: Props) {
    const viewModel = useActivityLibraryBrowserLogic(props);
    const {
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
    } = viewModel;
    return (
        <div className="min-w-0 space-y-6">
            <div className="min-w-0 space-y-5 rounded-card border-2 border-secondary/20 bg-accent p-4 text-secondary shadow-md md:p-6">
                <div role="group" aria-label="Activity categories" className="space-y-2">
                    <p className="text-sm font-semibold">Category</p>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,8rem),1fr))] gap-2">
                        {(["All", ...activityCategories] as const).map((value) => (
                            <button
                                key={value}
                                type="button"
                                className={`min-h-11 rounded-2xl border-2 px-3 py-2 text-sm font-semibold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${category === value
                                    ? "border-secondary bg-secondary text-accent shadow-sm"
                                    : "border-secondary/20 bg-accent text-secondary hover:border-primary hover:shadow-sm"
                                    }`}
                                aria-pressed={category === value}
                                onClick={() => {
                                    setCategory(value);
                                    if (value !== "Drills") setDrillSkill("All");
                                    if (value !== "Workouts") setWorkoutGroup("All");
                                }}
                            >
                                {value}
                            </button>
                        ))}
                    </div>
                </div>
                <label htmlFor={searchId} className="block space-y-2 text-sm font-semibold">
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
                {category === "Drills" && (
                    <div role="group" aria-label="Drill skills" className="space-y-2 border-t border-secondary/20 pt-5">
                        <p className="text-sm font-semibold">Skill</p>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,8rem),1fr))] gap-2">
                            {(["All", ...drillSkills] as const).map((skill) => (
                                <button
                                    key={skill}
                                    type="button"
                                    className={`min-h-11 rounded-2xl border-2 px-3 py-2 text-sm font-semibold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${drillSkill === skill
                                        ? "border-secondary bg-secondary text-accent shadow-sm"
                                        : "border-secondary/20 bg-accent text-secondary hover:border-primary hover:shadow-sm"
                                        }`}
                                    aria-pressed={drillSkill === skill}
                                    onClick={() => setDrillSkill(skill)}
                                >
                                    {skill}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {category === "Workouts" && (
                    <div role="group" aria-label="Workout groups" className="space-y-2 border-t border-secondary/20 pt-5">
                        <p className="text-sm font-semibold">Workout group</p>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,10rem),1fr))] gap-2">
                            {(["All", ...workoutGroups] as const).map((group) => (
                                <button
                                    key={group}
                                    type="button"
                                    className={`min-h-11 rounded-2xl border-2 px-3 py-2 text-sm font-semibold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${workoutGroup === group
                                        ? "border-secondary bg-secondary text-accent shadow-sm"
                                        : "border-secondary/20 bg-accent text-secondary hover:border-primary hover:shadow-sm"
                                        }`}
                                    aria-pressed={workoutGroup === group}
                                    onClick={() => setWorkoutGroup(group)}
                                >
                                    {group}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {onUse && (
                    <div className="space-y-1 border-t border-secondary/20 pt-5">
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
            </div>
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
                        className="rounded-2xl border border-secondary/20 bg-accent text-secondary shadow-sm open:border-secondary/40 open:shadow-md"
                    >
                        <summary className="cursor-pointer rounded-2xl p-4 font-semibold transition hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
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

