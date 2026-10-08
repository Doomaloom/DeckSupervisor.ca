import { CombinedPlansPrint } from "./CombinedPlansPrint/CombinedPlansPrint.component";
import { SavedPlanPrint } from "./SavedPlanPrint/SavedPlanPrint.component";

import PlanSelection from "../PlanSelection/PlanSelection.component";
import { usePrintPlansLogic } from "./PrintPlans.logic";

export default function PrintPlans() {
    const viewModel = usePrintPlansLogic();
    const { printMode, setPrintMode } = viewModel;
    return (
        <PlanSelection
            title="Print"
            unframed
            printMode={printMode}
            onPrintModeChange={setPrintMode}
            renderTogether={(session, classes, week) => (
                <CombinedPlansPrint
                    key={`${session.id}:${week}`}
                    session={session}
                    courses={classes}
                    week={week}
                />
            )}
        >
            {(session, course, week) => (
                <SavedPlanPrint
                    key={`${session.id}:${course.id}:${week}`}
                    session={session}
                    course={course}
                    week={week}
                />
            )}
        </PlanSelection>
    );
}

export { SavedPlanPrint } from "./SavedPlanPrint/SavedPlanPrint.component";
