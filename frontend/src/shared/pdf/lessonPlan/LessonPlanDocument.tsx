import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { InstructorClass, InstructorSession, LessonPlan, } from "../../../lib/serverApi";
import { sessionLabel } from "../../session/instructorSessionLabels";
import { plannedSkillSubskills } from "../../../features/instructor/LessonPlans/lessonSkills";
import { textSegments, lessonPlanHeading, printedPlanRows } from "./lessonPlanContent";
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
export { textSegments, lessonPlanHeading } from "./lessonPlanContent";
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
    const widths = ["53%", "17%", "17%", "13%"];
    const labels = ["Skill / Activity / drill", "Equipment", "Pool location", "Duration (minutes)"];
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
            {printedPlanRows(plan.rows).flatMap((row, index) => {
                // Continuation fragments keep exceptionally long text printable without
                // adding borders between fragments of the same planner row.
                const blocks = [
                    ...textSegments(row.skill, 43).map((text) => ({ text, bold: true, italic: false })),
                    ...row.activities.flatMap(({ title, explanation }) => [
                        ...textSegments(title, 43).map((text) => ({ text, bold: false, italic: true })),
                        ...textSegments(explanation, 43).map((text) => ({ text, bold: false, italic: false })),
                    ]),
                ].filter(({ text }) => text);
                const details: typeof blocks[] = [[]];
                let lines = 0;
                for (const block of blocks) {
                    const blockLines = block.text.split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 43)), 0) + 1;
                    if (lines && lines + blockLines > 20) {
                        details.push([]);
                        lines = 0;
                    }
                    details[details.length - 1].push(block);
                    lines += blockLines;
                }
                const equipment = textSegments(row.equipment.join("\n"), 13);
                const locations = textSegments(row.location, 13);
                const count = Math.max(details.length, equipment.length, locations.length);
                return Array.from({ length: count }, (_, part) => (
                    <View key={`${index}:${part}`} wrap={false} style={{ ...styles.row, borderBottomWidth: part === count - 1 ? 1 : 0 }}>
                        <View style={{ ...styles.cell, width: widths[0] }}>
                            {details[part]?.map((block, blockIndex) => (
                                <Text key={blockIndex} style={{ ...styles.text, fontWeight: block.bold ? 700 : 400, fontStyle: block.italic ? "italic" : "normal", marginBottom: 4 }}>{block.text}</Text>
                            ))}
                        </View>
                        {[equipment[part] || "", locations[part] || "", part === 0 ? row.duration : ""].map((text, i) => (
                            <View key={i} style={{ ...styles.cell, width: widths[i + 1] }}>
                                <Text style={styles.text}>{text}</Text>
                            </View>
                        ))}
                    </View>
                ));
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
