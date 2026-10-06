import catalog from "./activities.json";
import { curriculumLevels } from "../instructor/lessonSkills";

export const activityCategories = [
    "Songs",
    "Games",
    "Drills",
    "Workouts",
] as const;
export type ActivityCategory = typeof activityCategories[number];
export const drillSkills = [
    "Front crawl",
    "Back crawl",
    "Breaststroke",
    "Dry land",
] as const;
export type DrillSkill = typeof drillSkills[number];
export const workoutGroups = [
    "11 years & under",
    "11-14 years",
    "13-18 years",
    "Sample",
] as const;
export type WorkoutGroup = typeof workoutGroups[number];
export function workoutPrefix(group: WorkoutGroup) {
    return group === "Sample" ? "Sample " : `${group}: `;
}
export type LibraryActivity = {
    id: string;
    category: ActivityCategory;
    title: string;
    instructions: string;
    equipment?: string;
    suitability?: string;
    sourcePages: number[];
    skillIds: string[];
};

export const activities = catalog as LibraryActivity[];
export const librarySkills = curriculumLevels.flatMap((level) =>
    level.skills.map((skill) => ({ ...skill, level: level.name }))
);

export function activityText(activity: LibraryActivity) {
    return [
        activity.title,
        activity.suitability && `Suitable for: ${activity.suitability}`,
        activity.equipment && `Equipment: ${activity.equipment}`,
        activity.instructions,
    ].filter(Boolean).join("\n\n");
}

export function filterActivities(
    query: string,
    category: ActivityCategory | "All",
    skillId?: string,
    drillSkill?: DrillSkill,
    workoutGroup?: WorkoutGroup,
) {
    const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return activities.filter((activity) => {
        const text = `${activity.title} ${activity.instructions} ${
            activity.equipment || ""
        } ${activity.suitability || ""}`.toLocaleLowerCase();
        return (category === "All" || activity.category === category) &&
            (!skillId || activity.skillIds.includes(skillId)) &&
            (!drillSkill || (activity.category === "Drills" &&
                activity.title.startsWith(`${drillSkill}:`))) &&
            (!workoutGroup || (activity.category === "Workouts" &&
                activity.title.startsWith(workoutPrefix(workoutGroup)))) &&
            terms.every((term) => text.includes(term));
    }).sort((a, b) => a.title.localeCompare(b.title));
}
