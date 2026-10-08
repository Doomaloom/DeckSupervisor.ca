import { CourseCardProps, useCourseCardLogic } from "./CourseCard.logic";
function CourseCard(props: CourseCardProps) {
    const viewModel = useCourseCardLogic(props);
    const {
        backgroundClass,
        requestClass,
        course,
        selected,
        draggable,
        pointerDrag,
        onClick,
        style,
        capacityClass,
        capacity,
    } = viewModel;
    return (
        <div
            className={`absolute inset-x-0 flex cursor-pointer flex-col overflow-x-hidden overflow-y-auto border border-secondary/50 text-[clamp(0.8125rem,0.95vw,1.05rem)] leading-tight text-secondary transition-colors ${backgroundClass} ${requestClass}`}
            data-course-code={course.code}
            data-course-selected={selected}
            draggable={false}
            onPointerDown={pointerDrag.onPointerDown}
            onClick={(event) => {
                if (pointerDrag.suppressClick.current) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                onClick();
            }}
            style={{ ...style, touchAction: draggable ? "none" : undefined, userSelect: "none" }}
        >
            <div className="flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-0.5 text-center">
                <p className="w-full break-words font-semibold">
                    {course.level}
                </p>
                <p className="w-full">{course.code}</p>
                {course.isRequested && course.assignedInstructor
                    ? (
                        <p className="max-w-full rounded-full bg-yellow-400 px-1 py-0.5 text-[0.625rem] font-semibold">
                            Request: {course.assignedInstructor}
                        </p>
                    )
                    : null}
                {course.studentName &&
                    course.level.toLowerCase().includes("private") &&
                    (
                        <p className="w-full break-words text-[0.625rem] font-semibold">
                            {course.studentName}
                        </p>
                    )}
            </div>
            <div
                className={`shrink-0 border-t border-secondary/50 px-1 py-0.5 text-center text-[clamp(0.6875rem,0.75vw,0.875rem)] font-semibold ${capacityClass}`}
            >
                {course.studentCount} of {capacity}
            </div>
        </div>
    );
}

export default CourseCard;

