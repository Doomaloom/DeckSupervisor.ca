import levels from "./lessonSkills.json";
import { sanitizeLevel } from "../rosters/utils";

export const curriculumLevels = levels.filter((level) =>
    level.skills.length > 0
);

export function findCurriculumLevel(value: string) {
    if (!value.trim()) return undefined;
    const id = sanitizeLevel(value);
    return curriculumLevels.find((level) =>
        level.id.toLowerCase() === id.toLowerCase()
    );
}

const workoutSkillNames = new Set(
    curriculumLevels.flatMap((level) =>
        level.skills.filter((skill) => /\bworkouts?\b/i.test(skill.name)).map(
            (skill) => skill.name,
        )
    ),
);

export function isWorkoutSkill(name: string) {
    return workoutSkillNames.has(name);
}

export function defaultWorkoutText(name: string) {
    return curriculumLevels.flatMap((level) => level.skills).find((skill) =>
        skill.name === name
    )?.defaultWorkoutText;
}
