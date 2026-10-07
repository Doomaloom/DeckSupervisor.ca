import { expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
    curriculumLevels,
    defaultWorkoutText,
    findCurriculumLevel,
    isWorkoutSkill,
} from "./lessonSkills";
import levels from "./lessonSkills.json";

it.each([
    ["Splash 2a", "Splash2A"],
    ["Little Splash 3", "LittleSplash3"],
    ["Parent & Tot 2", "ParentandTot2"],
    ["Teen / Adult 1", "TeenAdult1"],
    ["Splash Fitness", "SplashFitness"],
    ["SplashPrivate", undefined],
    ["", undefined],
    ["Unknown", undefined],
    ["Splash 2", undefined],
])("matches %s without guessing a curriculum", (name, id) => {
    expect(findCurriculumLevel(name)?.id).toBe(id);
});
const sourcePath = resolve(
    process.cwd(),
    "../../rec-tablet/internal/workflows/swimming/curriculum/catalog.json",
);
it.skipIf(!existsSync(sourcePath))(
    "keeps generated curriculum aligned with the Rectab extraction",
    () => {
        const source = JSON.parse(readFileSync(sourcePath, "utf8"));
        const compactTitles = JSON.parse(
            readFileSync(resolve(sourcePath, "../compact_titles.json"), "utf8"),
        );
        expect(levels.map((level) => ({
            ...level,
            skills: level.skills.map(({ defaultWorkoutText: _default, ...skill }) => skill),
        }))).toEqual(
            source.levels.map((
                { id, name, skills }: {
                    id: string;
                    name: string;
                    skills: { id: string; name: string }[];
                },
            ) => ({
                id,
                name,
                skills: skills.map(({ id, name }) => ({
                    id,
                    name,
                    compactName: compactTitles[id] || name,
                })),
            })),
        );
        expect(curriculumLevels.every((level) => level.skills.length > 0)).toBe(
            true,
        );
    },
);

it("recognizes workout and workout-design skills across curricula, excluding ordinary and unknown skills", () => {
    const workouts = curriculumLevels.flatMap((level) => level.skills).filter(
        (skill) => /\bworkouts?\b/i.test(skill.name),
    );
    expect(workouts).toHaveLength(6);
    for (const skill of workouts) expect(isWorkoutSkill(skill.name)).toBe(true);
    expect(isWorkoutSkill("")).toBe(false);
    expect(isWorkoutSkill("My invented workout skill")).toBe(false);
    expect(isWorkoutSkill("Enter and Exit Shallow Water")).toBe(false);
});

it("includes prescribed workouts from subskills and skill names, but no invented design workout", () => {
    const skills = curriculumLevels.flatMap((level) => level.skills);
    for (const id of ["Splash6:12", "Splash7:9", "Splash9:10", "SplashFitness:5", "TeenAdult3:13"]) {
        const skill = skills.find((entry) => entry.id === id)!;
        expect(defaultWorkoutText(skill.name), id).toMatch(/warm[- ]?up/i);
        expect(defaultWorkoutText(skill.name), id).toMatch(/cool[- ]?down/i);
    }
    expect(defaultWorkoutText(skills.find((s) => s.id === "Splash7:9")!.name))
        .toContain("6 x 25 m or yd any Stroke on 60 sec");
    expect(defaultWorkoutText(skills.find((s) => s.id === "Splash9:10")!.name))
        .toContain("5 x 25 m or yd Instructor's choice");
    expect(defaultWorkoutText(skills.find((s) => s.id === "SplashFitness:6")!.name))
        .toBeUndefined();
});
