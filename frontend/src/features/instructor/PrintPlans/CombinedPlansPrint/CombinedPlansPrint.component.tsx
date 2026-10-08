import { type InstructorClass, type InstructorSession } from "../../../../lib/serverApi";
import { PlanPrintPreview } from "../PlanPrintPreview/PlanPrintPreview.component";
import { useCombinedPlansPrintLogic } from "./CombinedPlansPrint.logic";

export function CombinedPlansPrint(props: {
    session: InstructorSession;
    courses: InstructorClass[];
    week: string;
}) {
    const viewModel = useCombinedPlansPrintLogic(props);
    const { session, courses, week } = viewModel;
    return (
        <PlanPrintPreview
            session={session}
            courses={courses}
            week={week}
            combined
        />
    );
}
