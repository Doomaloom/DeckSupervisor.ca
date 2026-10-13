import { sanitizeLevel } from "../../../shared/levels/sanitizeLevel";
import levels from "./lessonSkills.json";
import type { LessonRow } from "../../../lib/serverApi";

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

export function plannedSkillSubskills(
    courseLevel: string,
    curriculumLevel: string | null | undefined,
    rows: Pick<LessonRow, "skill">[],
) {
    const level = findCurriculumLevel(courseLevel) ||
        curriculumLevels.find((entry) => entry.id === curriculumLevel);
    const names = [...new Set(rows.map((row) => row.skill.trim()).filter(Boolean))];
    return names.map((name) => ({
        name,
        subskills: level?.skills.find((skill) => skill.name === name)?.subskills || [],
    }));
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
