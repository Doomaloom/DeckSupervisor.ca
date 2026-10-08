import type { InstructorClass, InstructorSession, LessonPlan, } from "../../../lib/serverApi";
import { renderPdfArtifact } from "../renderPdf";
import { LessonPlanDocument, LessonPlansDocument } from "./LessonPlanDocument";
export function generateLessonPlanPdf(
    session: InstructorSession,
    course: InstructorClass,
    plan: LessonPlan,
) {
    return renderPdfArtifact(
        <LessonPlanDocument session={session} course={course} plan={plan} />,
        {
            title: "Weekly lesson plan",
            filename: `lesson-plan-${course.id}-${plan.week}.pdf`,
        },
    );
}

export function generateCombinedLessonPlanPdf(
    session: InstructorSession,
    entries: { course: InstructorClass; plan: LessonPlan }[],
) {
    return renderPdfArtifact(
        <LessonPlansDocument session={session} entries={entries} />,
        {
            title: "Weekly lesson plans",
            filename: `lesson-plans-${entries[0].plan.week}.pdf`,
        },
    );
}
