import { type InstructorClass, type InstructorSession } from "../../../../lib/serverApi";
import { PlanPrintPreview } from "../PlanPrintPreview/PlanPrintPreview.component";
import { useSavedPlanPrintLogic } from "./SavedPlanPrint.logic";

export function SavedPlanPrint(props: {
    session: InstructorSession;
    course: InstructorClass;
    week: string;
}) {
    const viewModel = useSavedPlanPrintLogic(props);
    const { session, courses, week } = viewModel;
    return (
        <PlanPrintPreview
            session={session}
            courses={courses}
            week={week}
            combined={false}
        />
    );
}
