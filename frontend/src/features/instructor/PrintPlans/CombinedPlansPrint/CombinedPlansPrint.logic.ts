import { type InstructorClass, type InstructorSession } from "../../../../lib/serverApi";
export function useCombinedPlansPrintLogic({ session, courses, week }: {
    session: InstructorSession;
    courses: InstructorClass[];
    week: string;
}) {
    return {
        view: "ready" as const,
        session,
        courses,
        week,
    };

}

