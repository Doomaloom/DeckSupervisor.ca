import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const output = resolve(process.argv[2] || "../tmp/lesson-plan-pdf");
const server = await createServer({
    root: resolve(import.meta.dirname, ".."),
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
});
try {
    const { generateCombinedLessonPlanPdf, generateLessonPlanPdf } = await server.ssrLoadModule(
        "/src/shared/pdf/lessonPlan/generateLessonPlanPdf.tsx",
    );
    const { curriculumLevels } = await server.ssrLoadModule(
        "/src/features/instructor/LessonPlans/lessonSkills.ts",
    );
    const { activities, activityText } = await server.ssrLoadModule(
        "/src/features/instructor/ActivityLibrary/activityLibrary.ts",
    );
    const { newWorkout, workoutText } = await server.ssrLoadModule(
        "/src/shared/workouts/workout.ts",
    );
    const { workoutPresets } = await server.ssrLoadModule(
        "/src/features/instructor/LessonPlans/LessonEditor/WorkoutBuilderModal/workoutPresets.ts",
    );
    const workout = newWorkout();
    workout.title = "PDF workout check";
    for (
        const [key, id] of [
            ["warmUp", "young-1-warm"],
            ["mainSet", "young-1-main"],
            ["coolDown", "young-1-cool"],
        ]
    ) workout.sections[key] = workoutPresets.find((p) => p.id === id).sets;
    const session = {
        id: "synthetic-session",
        session_day: "Mo",
        session_season: "Fall",
        session_year: 2026,
        location: "Synthetic Pool",
        start_date: "2026-10-05",
        end_date: "2026-10-26",
        weeks: ["2026-10-05"],
    };
    const course = {
        id: "synthetic-class",
        instructor: "Alex Synthetic",
        level: "Swimmer 1",
        code: "SYNTHETIC-A",
        start_time: "09:00:00",
        end_time: "09:30:00",
    };
    const catalogLevel = curriculumLevels.find((level) => level.id === "LittleSplash1");
    const catalogSkill = catalogLevel.skills[0].name;
    const groupedSkill = catalogLevel.skills.find((skill) =>
        skill.subskills.some((subskill) => subskill.group.length)
    ).name;
    await mkdir(output, { recursive: true });
    for (
        const [name, rows] of [
            ["workout", [{
                skill: "Swimming endurance",
                activity: workoutText(workout),
                workout,
                location: "Lane",
                duration: 20,
            }]],
            ["single", [{
                skill: "Floating",
                activity: "Practice supported front and back floats.",
                location: "Shallow end",
                duration: 10,
            }, {
                skill: "Kicking",
                activity: "Flutter kick with a board.",
                location: "Lane 2",
                duration: 15,
            }]],
            [
                "multi",
                Array.from({ length: 32 }, (_, i) => ({
                    skill: `Skill ${String(i + 1).padStart(2, "0")}`,
                    activity: i === 15
                        ? "Very long activity with careful instruction and clear cues. "
                            .repeat(120)
                        : `Activity ${
                            String(i + 1).padStart(2, "0")
                        } - Practice technique with rest breaks and feedback. `
                            .repeat(5),
                    location: "Lane 2",
                    duration: 5,
                })),
            ],
        ]
    ) {
        const artifact = await generateLessonPlanPdf(session, course, {
            week: "2026-10-05",
            rows,
        });
        await writeFile(
            resolve(output, `${name}.pdf`),
            Buffer.from(await artifact.blob.arrayBuffer()),
        );
        console.log(`Rendered ${name}: ${rows.length} activities`);
    }
    const drills = activities.filter((activity) => activity.title.startsWith("Front crawl:")).slice(0, 2);
    const activityLayout = await generateLessonPlanPdf(session, course, {
        week: "2026-10-05",
        rows: [{
            skill: "Front crawl",
            activity: drills.map(activityText).join("\n\n"),
            activities: drills.map((activity) => ({ kind: "library", text: activityText(activity) })),
            equipment: ["Noodles"],
            location: "Lane 2",
            duration: 15,
        }, {
            skill: "Floating",
            activity: "Partner challenge\n\nTake turns practising while a partner watches.",
            equipment: [],
            location: "Shallow end",
            duration: 5,
        }],
    });
    await writeFile(resolve(output, "activity-layout.pdf"), Buffer.from(await activityLayout.blob.arrayBuffer()));
    const catalogPlan = {
        week: "2026-10-05",
        curriculum_level: "LittleSplash1",
        rows: [{
            skill: catalogSkill,
            activity: "Practice with feedback.",
            location: "Shallow end",
            duration: 10,
        }, {
            skill: groupedSkill,
            activity: "Discuss safe choices near water.",
            location: "Poolside",
            duration: 5,
        }],
    };
    const catalogCourse = { ...course, level: "Little Splash 1" };
    const catalog = await generateLessonPlanPdf(session, catalogCourse, catalogPlan);
    await writeFile(
        resolve(output, "catalog.pdf"),
        Buffer.from(await catalog.blob.arrayBuffer()),
    );
    const combined = await generateCombinedLessonPlanPdf(session, [
        { course: catalogCourse, plan: catalogPlan },
        { course: { ...catalogCourse, id: "synthetic-class-2", code: "SYNTHETIC-B" }, plan: catalogPlan },
    ]);
    await writeFile(
        resolve(output, "combined.pdf"),
        Buffer.from(await combined.blob.arrayBuffer()),
    );
    const noActivityPlan = {
        week: "2026-10-05",
        curriculum_level: "LittleSplash1",
        rows: catalogLevel.skills.map((skill) => ({
            skill: skill.name,
            activity: "",
            location: "Shallow end",
            duration: 5,
        })),
    };
    const noActivity = await generateLessonPlanPdf(
        session,
        catalogCourse,
        noActivityPlan,
    );
    await writeFile(
        resolve(output, "no-activity.pdf"),
        Buffer.from(await noActivity.blob.arrayBuffer()),
    );
    const splash7 = curriculumLevels.find((level) => level.id === "Splash7");
    const splash7Skills = splash7.skills.filter((skill) => skill.id !== "Splash7:11");
    splash7Skills.splice(
        splash7Skills.findIndex((skill) => skill.id === "Splash7:14") + 1,
        0,
        splash7.skills.find((skill) => skill.id === "Splash7:11"),
    );
    const longSubskills = await generateLessonPlanPdf(
        session,
        { ...course, level: "Splash 7 Rookie Patrol" },
        {
            week: "2026-10-05",
            rows: splash7Skills.map((skill) => ({
                skill: skill.name,
                activity: "",
                location: "Pool",
                duration: 5,
            })),
        },
    );
    await writeFile(
        resolve(output, "long-subskills.pdf"),
        Buffer.from(await longSubskills.blob.arrayBuffer()),
    );
} finally {
    await server.close();
}
