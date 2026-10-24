import { sanitizeLevel } from "../../../shared/levels/sanitizeLevel";
import levels from "./lessonSkills.json";
import legacySkills from "./legacyLessonSkills.json";
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

type PlanningLevel = typeof curriculumLevels[number];

// Historical grouped names remain usable in saved rows, but never enter new options.
export function findPlanningSkill(level: PlanningLevel | undefined, name: string) {
    const current = level?.skills.find(skill => skill.name === name.trim());
    if (current || !level) return current;
    const legacy = legacySkills.find(skill => skill.level === level.id && skill.name === name.trim());
    if (!legacy) return undefined;
    const components = level.skills.filter(skill => legacy.skillIds.includes(skill.id));
    if (!components.length) return undefined;
    const seen = new Set<string>();
    return {
        ...components[0],
        id: legacy.id,
        name: legacy.name,
        compactName: legacy.compactName,
        subskills: components.flatMap(skill => skill.subskills).filter(subskill => {
            const key = JSON.stringify(subskill);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }),
    };
}

export function planningSkillIds(id: string) {
    return legacySkills.find(skill => skill.id === id)?.skillIds || [id];
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
        subskills: findPlanningSkill(level, name)?.subskills || [],
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
    return workoutSkillNames.has(name) || legacySkills.some(legacy =>
        legacy.name === name && /\bworkouts?\b/i.test(legacy.name)
    );
}

export function defaultWorkoutText(name: string) {
    for (const level of curriculumLevels) {
        const skill = findPlanningSkill(level, name);
        if (skill) return skill.defaultWorkoutText;
    }
    return undefined;
}
