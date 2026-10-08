import { useMemo } from "react";
import { type InstructorClass, type InstructorSession } from "../../../../lib/serverApi";
export function useSavedPlanPrintLogic({ session, course, week }: {
    session: InstructorSession;
    course: InstructorClass;
    week: string;
}) {
    const courses = useMemo(() => [course], [course]);
    return {
        view: "ready" as const,
        session,
        courses,
        week,
    };

}

