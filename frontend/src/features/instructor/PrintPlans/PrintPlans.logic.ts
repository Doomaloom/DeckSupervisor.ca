import { useState } from "react";

import { type InstructorClass, type LessonPlan } from "../../../lib/serverApi";

export type SavedEntry = { course: InstructorClass; plan: LessonPlan };

export function usePrintPlansLogic() {
    const [printMode, setPrintMode] = useState<"separate" | "together">("separate");
    return { view: "ready" as const, printMode, setPrintMode };

}
