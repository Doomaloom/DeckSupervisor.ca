import { getVisibleRosterStudents, getWaitlistedRosterStudents } from "../utils";

import LevelSelect from "../LevelSelect/LevelSelect.component";

import StudentRow from "../StudentRow/StudentRow.component";
import { RosterCardProps, useRosterCardLogic } from "./RosterCard.logic";
function RosterCard(props: RosterCardProps) {
    const viewModel = useRosterCardLogic(props);
    const {
        containerClass,
        roster,
        toggleButtonClass,
        onToggleStudentLevelEdits,
        allowStudentLevelEdits,
        actionButtonClass,
        onPrint,
        isCustom,
        customId,
        onCustomRosterLevelChange,
        onRosterLevelChange,
        onStudentLevelChange,
        isReadOnly,
    } = viewModel;
    const waitlisted = getWaitlistedRosterStudents(roster.students);
    return (
        <div
            className={containerClass}
            id={roster.code}
            data-component="roster-card"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-secondary">
                    {roster.serviceName} : {roster.time}
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className={toggleButtonClass}
                        onClick={onToggleStudentLevelEdits}
                        aria-pressed={allowStudentLevelEdits}
                    >
                        {allowStudentLevelEdits
                            ? "Individual Level"
                            : "Class Level"}
                    </button>
                    <button
                        type="button"
                        className={actionButtonClass}
                        onClick={() => onPrint(roster)}
                    >
                        Print
                    </button>
                </div>
            </div>
            <div className="mt-4 grid w-full grid-cols-1 gap-3">
                <p className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary">
                    Instructor: {roster.instructor || "Unassigned"}
                </p>
                <LevelSelect
                    value={roster.level}
                    onChange={(value) => {
                        if (isCustom && customId && onCustomRosterLevelChange) {
                            onCustomRosterLevelChange(customId, value);
                            return;
                        }
                        onRosterLevelChange(roster.code, value);
                    }}
                />
            </div>
            {getVisibleRosterStudents(roster.students).map((student) => (
                <StudentRow
                    key={student.id}
                    student={student}
                    onLevelChange={onStudentLevelChange}
                    disabled={isReadOnly || !allowStudentLevelEdits}
                />
            ))}
            {waitlisted.length > 0 && (
                <div
                    data-component="roster-waitlist"
                    className="mt-4 border-t-2 border-secondary/20 pt-3"
                >
                    <h3 className="text-sm font-semibold text-secondary">
                        Waitlist
                    </h3>
                    {waitlisted.map((student) => (
                        <p
                            key={student.id}
                            id={`waitlist-row-${student.id}`}
                            className="mt-2 text-secondary"
                        >
                            {student.name.replace(/"/g, "")}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}

export default RosterCard;

