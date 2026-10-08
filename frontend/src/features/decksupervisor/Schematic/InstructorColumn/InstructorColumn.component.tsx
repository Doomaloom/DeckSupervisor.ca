import { TrashIcon } from "@heroicons/react/24/outline";

import { SCHEDULE_HEADER_HEIGHT, SCHEDULE_SLOT_HEIGHT, SLOT_HEIGHT_REM, SLOT_MINUTES, } from "../../../../shared/schedule/constants";

import { getCapacity, getCapacityClass } from "../utils/capacity";

import CourseCard from "../CourseCard/CourseCard.component";
import { InstructorColumnProps, useInstructorColumnLogic } from "./InstructorColumn.logic";
function InstructorColumn(props: InstructorColumnProps) {
    const viewModel = useInstructorColumnLogic(props);
    const {
        columnIndex,
        canRemove,
        onRemoveColumn,
        readOnly,
        lockedInstructor,
        instructor,
        instructorId,
        onInstructorChange,
        instructorOptions,
        scheduleHeightRem,
        column,
        scheduleStartMinutes,
        selectedCourseCodes,
        highlightedCourseCodes,
        onCourseSelect,
        onCourseDragStart,
        onDropAt,
        onHoverAt,
    } = viewModel;
    return (
        <div
            className="flex min-w-24 flex-1 flex-col"
            data-schematic-column={columnIndex}
        >
            <div
                className="flex items-center justify-center border-b border-primary bg-primary px-1 py-2 text-center text-[clamp(0.8125rem,0.9vw,1.125rem)] font-semibold text-accent"
                style={{ height: SCHEDULE_HEADER_HEIGHT }}
            >
                {canRemove
                    ? (
                        <button
                            type="button"
                            aria-label={`Delete empty column ${columnIndex + 1}`}
                            className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-accent/60 bg-accent/10 px-1 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            onClick={() => onRemoveColumn?.(columnIndex)}
                        >
                            <TrashIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            Delete
                        </button>
                    )
                    : readOnly || lockedInstructor
                        ? (
                            <div className="w-full break-words">
                                {lockedInstructor || instructor ||
                                    `Instructor ${columnIndex + 1}`}
                            </div>
                        )
                        : (
                            <select
                                className="w-full min-w-0 rounded-lg border border-secondary/30 bg-accent px-1 py-2 text-[clamp(0.75rem,0.85vw,1rem)] font-medium text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                value={instructorId === undefined
                                    ? instructor
                                    : instructorId ?? ""}
                                onChange={(event) =>
                                    onInstructorChange(
                                        columnIndex,
                                        event.target.value,
                                    )}
                            >
                                <option value="">
                                    {`Instructor ${columnIndex + 1}`}
                                </option>
                                {instructorOptions.map((option) => (
                                    <option
                                        key={typeof option === "string"
                                            ? option
                                            : option.id}
                                        value={typeof option === "string"
                                            ? option
                                            : option.id}
                                    >
                                        {typeof option === "string"
                                            ? option
                                            : option.label}
                                    </option>
                                ))}
                            </select>
                        )}
            </div>
            <div
                className="relative border-l border-secondary/20 bg-accent"
                style={{
                    height:
                        `calc(${scheduleHeightRem / SLOT_HEIGHT_REM} * ${SCHEDULE_SLOT_HEIGHT})`,
                }}
            >
                {column.map((course) => {
                    const startOffset =
                        (course.startMinutes - scheduleStartMinutes) /
                        SLOT_MINUTES;
                    const courseHeight = course.runningTime / SLOT_MINUTES;
                    const capacity = getCapacity(course);
                    const capacityClass = getCapacityClass(course, capacity);
                    return (
                        <CourseCard
                            key={course.code}
                            course={course}
                            capacity={capacity}
                            capacityClass={capacityClass}
                            selected={selectedCourseCodes.includes(course.code)}
                            highlighted={highlightedCourseCodes.includes(course.code)}
                            draggable={!readOnly && !course.isLockedToInstructor}
                            onClick={() => onCourseSelect(course, columnIndex)}
                            onDragStart={() =>
                                onCourseDragStart(course, columnIndex)}
                            onDropAt={onDropAt}
                            onHoverAt={onHoverAt}
                            style={{
                                top:
                                    `calc(${startOffset} * ${SCHEDULE_SLOT_HEIGHT})`,
                                height:
                                    `calc(${courseHeight} * ${SCHEDULE_SLOT_HEIGHT})`,
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}

export default InstructorColumn;

