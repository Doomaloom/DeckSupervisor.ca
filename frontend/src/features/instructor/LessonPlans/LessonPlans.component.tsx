import { LessonEditor } from "./LessonEditor/LessonEditor.component";

import PlanSelection from "../PlanSelection/PlanSelection.component";

import { timeToMinutes } from "../../../shared/schedule/time";

import { useLessonPlansLogic } from "./LessonPlans.logic";

export default function LessonPlans() {
    const { title } = useLessonPlansLogic();
    return (
        <PlanSelection title={title} unframed>
            {(s, c, w) => (
                <LessonEditor
                    key={`${s.id}:${c.id}:${w}`}
                    sessionId={s.id}
                    classId={c.id}
                    week={w}
                    level={c.level}
                    lessonDuration={(timeToMinutes(c.end_time) - timeToMinutes(c.start_time) + 1440) % 1440}
                />
            )}
        </PlanSelection>
    );
}

export { rowsForSave } from "./LessonEditor/LessonEditor.logic";

export { LessonEditor } from "./LessonEditor/LessonEditor.component";
