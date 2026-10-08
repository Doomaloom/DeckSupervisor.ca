import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { InstructorClass, InstructorSession, LessonPlan, } from "../../../lib/serverApi";
import { sessionLabel } from "../../session/instructorSessionLabels";
const styles = StyleSheet.create({
    page: {
        fontFamily: "Liberation Sans",
        fontSize: 10,
        paddingTop: 136,
        paddingBottom: 40,
        paddingHorizontal: 32,
    },
    context: { position: "absolute", top: 26, left: 32, right: 32 },
    title: { fontSize: 17, fontWeight: 700, marginBottom: 5 },
    header: {
        position: "absolute",
        top: 100,
        left: 32,
        right: 32,
        flexDirection: "row",
        backgroundColor: "#edf2f7",
        borderWidth: 1,
        height: 36,
    },
    row: { flexDirection: "row", borderLeftWidth: 1, borderBottomWidth: 1 },
    cell: { padding: 6, borderRightWidth: 1 },
    text: { fontSize: 10, lineHeight: 1.3 },
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
    const widths = ["22%", "43%", "20%", "15%"];
    return (
        <Page size="LETTER" style={styles.page}>
            <View fixed style={styles.context}>
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
            <View fixed style={styles.header}>
                {[
                    "Skill",
                    "Activity / drill",
                    "Pool location",
                    "Duration (minutes)",
                ]
                    .map((label, i) => (
                        <View
                            key={label}
                            style={{ ...styles.cell, width: widths[i] }}
                        >
                            {(i === 3 ? ["Duration", "(minutes)"] : [label])
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
                const skills = textSegments(row.skill, 18),
                    activities = textSegments(row.activity, 38);
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
                                activities[part] || "",
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
            <Text
                fixed
                style={styles.footer}
                render={({ pageNumber, totalPages }) =>
                    `${pageNumber} / ${totalPages}`}
            />
        </Page>
    );
}
