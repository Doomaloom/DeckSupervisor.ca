import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { curriculumLevels, defaultWorkoutText, findCurriculumLevel, findPlanningSkill, planningSkillIds, isWorkoutSkill, plannedSkillSubskills, } from "./lessonSkills";
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
const tabletRoot = resolve(process.cwd(), "../../rec-tablet");
const sourcePath = resolve(tabletRoot, "src/workflows/swimming/curriculum/catalog.json");
// Standalone website checkouts may omit the tablet; an incorrect path in this workspace must fail.
it.skipIf(!existsSync(tabletRoot))(
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
                    skills: { id: string; name: string; subskills: { text: string; group: string[] }[] }[];
                },
            ) => ({
                id,
                name,
                skills: skills.map(({ id, name, subskills }) => ({
                    id,
                    name,
                    compactName: compactTitles[id] || name,
                    subskills: subskills.map(({ text, group }) => ({ text, group })),
                })),
            })),
        );
        expect(curriculumLevels.every((level) => level.skills.length > 0)).toBe(
            true,
        );
    },
);

it("lists each planned skill once in row order, with only its level's subskills", () => {
    const skill = curriculumLevels.find((level) => level.id === "LittleSplash1")!.skills[0];
    const entries = plannedSkillSubskills("Little Splash 1", "Splash1", [
        { skill: skill.name },
        { skill: " Custom skill " },
        { skill: skill.name },
        { skill: "" },
    ]);
    expect(entries).toEqual([
        { name: skill.name, subskills: skill.subskills },
        { name: "Custom skill", subskills: [] },
    ]);
    expect(plannedSkillSubskills("Private", "LittleSplash1", [{ skill: skill.name }])[0].subskills)
        .toEqual(skill.subskills);
});

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

it("exposes individual tablet components with the tablet short titles", () => {
    const level = findCurriculumLevel("Splash1")!;
    expect(level.skills.filter(skill => skill.id.startsWith("Splash1:6"))
        .map(skill => [skill.id, skill.compactName])).toEqual([
            ["Splash1:6a", "Front float 5s"],
            ["Splash1:6b", "Back float 5s"],
        ]);
    expect(level.skills.filter(skill => skill.id.startsWith("Splash1:8"))
        .map(skill => skill.id)).toEqual(["Splash1:8a", "Splash1:8b", "Splash1:8c"]);
    expect(level.skills.some(skill => skill.id === "Splash1:6" || skill.id === "Splash1:8"))
        .toBe(false);
});

it("resolves historical saved names without adding them to the current choices", () => {
    const level = findCurriculumLevel("Splash1")!;
    const oldName = "Float on front and back (5 sec. each)";
    expect(findPlanningSkill(level, oldName)?.id).toBe("Splash1:6");
    expect(planningSkillIds("Splash1:6")).toEqual(["Splash1:6a", "Splash1:6b"]);
    expect(level.skills.some(skill => skill.name === oldName)).toBe(false);
    expect(findPlanningSkill(findCurriculumLevel("Splash2A"), oldName)).toBeUndefined();
    expect(findPlanningSkill(level, "Invented float")).toBeUndefined();
    expect(plannedSkillSubskills("Splash1", null, [{ skill: oldName }])[0].subskills.length)
        .toBeGreaterThan(0);
});
