import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { InstructorClass, InstructorSession, LessonPlan, LessonRow, } from "../../../lib/serverApi";
import { sessionLabel } from "../../session/instructorSessionLabels";
import { plannedSkillSubskills } from "../../../features/instructor/LessonPlans/lessonSkills";
const styles = StyleSheet.create({
    page: {
        fontFamily: "Liberation Sans",
        fontSize: 10,
        paddingTop: 26,
        paddingBottom: 40,
        paddingHorizontal: 32,
    },
    context: { marginBottom: 27 },
    title: { fontSize: 17, fontWeight: 700, marginBottom: 5 },
    header: {
        flexDirection: "row",
        backgroundColor: "#edf2f7",
        borderWidth: 1,
        height: 36,
    },
    row: { flexDirection: "row", borderLeftWidth: 1, borderBottomWidth: 1 },
    cell: { padding: 6, borderRightWidth: 1 },
    text: { fontSize: 10, lineHeight: 1.3 },
    subskills: { marginTop: 18, flexShrink: 0 },
    subskillsTitle: { fontSize: 13, fontWeight: 700, marginBottom: 9 },
    skillTitle: { fontSize: 10, fontWeight: 700, marginBottom: 3 },
    skillGroup: { marginBottom: 9, flexShrink: 0 },
    subskill: { fontSize: 9, lineHeight: 1.35, marginLeft: 12, marginBottom: 2 },
    footer: {
        position: "absolute",
        bottom: 20,
        left: 32,
        right: 32,
        textAlign: "right",
        fontSize: 8,
    },
});
// Bound each segment by visual line budget so even a 10,000-character activity can span pages.
export function textSegments(text: string, width: number) {
    const segments: string[] = [];
    let part = "";
    let lines = 0;
    let lineChars = 0;
    for (const char of text) {
        part += char;
        lineChars++;
        if (char === "\n" || lineChars >= width) {
            lines++;
            lineChars = 0;
        }
        if (lines >= 8) {
            const boundary = part.search(/\s+\S*$/);
            const cut = boundary > part.length / 2 ? boundary + 1 : part.length;
            segments.push(part.slice(0, cut));
            part = part.slice(cut);
            lines = 0;
            lineChars = part.length;
        }
    }
    if (part || !segments.length) segments.push(part);
    return segments;
}
export function lessonPlanHeading(
    session: InstructorSession,
    course: InstructorClass,
    plan: LessonPlan,
) {
    const weekNumber = session.weeks.indexOf(plan.week) + 1;
    return `${course.level} · ${course.code} · Week ${weekNumber || plan.week} Plan`;
}
export function hasActivityDrill(rows: Pick<LessonRow, "activity">[]) {
    return rows.some((row) => row.activity.trim().length > 0);
}
export function LessonPlanDocument(
    { session, course, plan }: {
        session: InstructorSession;
        course: InstructorClass;
        plan: LessonPlan;
    },
) {
    return <LessonPlansDocument session={session} entries={[{ course, plan }]} />;
}

export function LessonPlansDocument(
    { session, entries }: {
        session: InstructorSession;
        entries: { course: InstructorClass; plan: LessonPlan }[];
    },
) {
    return (
        <Document title={`Lesson plans - ${entries[0]?.plan.week || ""}`}>
            {entries.map(({ course, plan }) => (
                <LessonPlanPage
                    key={course.id}
                    session={session}
                    course={course}
                    plan={plan}
                />
            ))}
        </Document>
    );
}

function LessonPlanPage(
    { session, course, plan }: {
        session: InstructorSession;
        course: InstructorClass;
        plan: LessonPlan;
    },
) {
    const showActivity = hasActivityDrill(plan.rows);
    const widths = showActivity
        ? ["22%", "43%", "20%", "15%"]
        : ["65%", "20%", "15%"];
    const labels = showActivity
        ? ["Skill", "Activity / drill", "Pool location", "Duration (minutes)"]
        : ["Skill", "Pool location", "Duration (minutes)"];
    const plannedSkills = plannedSkillSubskills(
        course.level,
        plan.curriculum_level,
        plan.rows,
    );
    return (
        <Page size="LETTER" style={styles.page}>
            <View wrap={false} style={styles.context}>
                <Text style={styles.title}>
                    {lessonPlanHeading(session, course, plan)}
                </Text>
                <Text>
                    {course.instructor} | {course.level} | {course.code} |
                    {" "}
                    {course.start_time.slice(0, 5)}-{course.end_time.slice(
                        0,
                        5,
                    )}
                </Text>
                <Text>{sessionLabel(session)}</Text>
            </View>
            <View wrap={false} style={styles.header}>
                {labels.map((label, i) => (
                        <View
                            key={label}
                            style={{ ...styles.cell, width: widths[i] }}
                        >
                            {(label === "Duration (minutes)" ? ["Duration", "(minutes)"] : [label])
                                .map((line) => (
                                    <Text
                                        key={line}
                                        style={{
                                            fontSize: 9,
                                            fontWeight: 700,
                                        }}
                                    >
                                        {line}
                                    </Text>
                                ))}
                        </View>
                    ))}
            </View>
            {plan.rows.flatMap((row, index) => {
                const skills = textSegments(row.skill, showActivity ? 18 : 55),
                    activities = showActivity ? textSegments(row.activity, 38) : [];
                return Array.from(
                    { length: Math.max(skills.length, activities.length) },
                    (_, part) => (
                        <View
                            key={`${index}:${part}`}
                            wrap={false}
                            style={styles.row}
                        >
                            {[
                                skills[part] || "",
                                ...(showActivity ? [activities[part] || ""] : []),
                                part === 0 ? row.location : "",
                                part === 0 ? String(row.duration) : "",
                            ].map((text, i) => (
                                <View
                                    key={i}
                                    style={{
                                        ...styles.cell,
                                        width: widths[i],
                                    }}
                                >
                                    <Text style={styles.text}>{text}</Text>
                                </View>
                            ))}
                        </View>
                    ),
                );
            })}
            {!plan.rows.length && (
                <Text>No activities in this saved plan.</Text>
            )}
            {plannedSkills.length > 0 && (
                <View style={styles.subskills}>
                    {plannedSkills.map(({ name, subskills }, index) => (
                        <View key={name} wrap={false} style={styles.skillGroup}>
                            {index === 0 && (
                                <Text style={styles.subskillsTitle}>Subskills</Text>
                            )}
                            <Text style={styles.skillTitle}>{name}</Text>
                            {subskills.length ? subskills.map((subskill, subskillIndex) => (
                                <Text key={subskillIndex} style={styles.subskill}>
                                    {`• ${subskill.group.length
                                        ? `${subskill.group.join(" / ")}: `
                                        : ""}${subskill.text}`}
                                </Text>
                            )) : (
                                <Text style={styles.subskill}>Subskills unavailable</Text>
                            )}
                        </View>
                    ))}
                </View>
            )}
            <Text
                fixed
                style={styles.footer}
                render={({ pageNumber, totalPages }) =>
                    `${pageNumber} / ${totalPages}`}
            />
        </Page>
    );
}
