import TimeRail from "../../../../shared/components/TimeRail/TimeRail.component";

import { capacityClasses, dayNames, getPlannerBoardStatusClasses } from "../utils/plannerPresentation";

import { PlannerBoardProps, usePlannerBoardLogic } from "./PlannerBoard.logic";
function PlannerBoard(props: PlannerBoardProps) {
    const viewModel = usePlannerBoardLogic(props);
    const {
        visibleClasses,
        boardColumns,
        availableDays,
        selectedDay,
        setSelectedDay,
        availableLocations,
        selectedLocation,
        setSelectedLocation,
        columnMinWidthPx,
        headerHeightRem,
        slotHeightRem,
        timeLabels,
        handleColumnDrop,
        scheduleHeightRem,
        scheduleStartMinutes,
        slotMinutes,
        selectedClassKey,
        setSelectedClassKey,
        setIsInfoPanelOpen,
        handleDragStart,
        setDragged,
        handleCourseDrop,
    } = viewModel;
    return (
        <section
            id="planner-board"
            data-component="planner-board"
            className="min-w-0 space-y-4"
        >
            <div className="space-y-4 rounded-card border-2 border-secondary/20 bg-accent p-4 text-secondary shadow-md md:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-lg font-semibold">Class schedule</h3>
                    <p className="text-sm text-secondary/70">
                        {visibleClasses.length} classes · {boardColumns.length} lanes
                    </p>
                </div>
                <div role="group" aria-label="Planning day" className="space-y-2">
                    <p className="text-sm font-semibold">Day</p>
                    <div className="flex flex-wrap gap-2">
                        {availableDays.map((day) => (
                            <button
                                key={day}
                                type="button"
                                aria-pressed={selectedDay === day}
                                className={`min-h-11 rounded-2xl border-2 px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selectedDay === day
                                    ? "border-secondary bg-secondary text-accent shadow-sm"
                                    : "border-secondary/20 bg-accent text-secondary hover:border-primary hover:shadow-sm"
                                    }`}
                                onClick={() => setSelectedDay(day)}
                            >
                                {dayNames[day] ?? day}
                            </button>
                        ))}
                    </div>
                </div>
                <div role="group" aria-label="Planning location" className="space-y-2 border-t border-secondary/20 pt-4">
                    <p className="text-sm font-semibold">Location</p>
                    <div className="flex flex-wrap gap-2">
                        {availableLocations.map((location) => (
                            <button
                                key={location}
                                type="button"
                                aria-pressed={selectedLocation === location}
                                className={`min-h-11 rounded-2xl border-2 px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selectedLocation === location
                                    ? "border-secondary bg-secondary text-accent shadow-sm"
                                    : "border-secondary/20 bg-accent text-secondary hover:border-primary hover:shadow-sm"
                                    }`}
                                onClick={() => setSelectedLocation(location)}
                            >
                                {location}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {visibleClasses.length === 0
                ? (
                    <div className="rounded-2xl border border-secondary/20 bg-accent p-5 text-sm text-secondary/70 shadow-sm">
                        No classes found for this day and location.
                    </div>
                )
                : (
                    <div
                        className="min-w-0 overflow-x-auto rounded-2xl border border-secondary/20 bg-accent text-secondary shadow-sm"
                        aria-label="Planning schematic"
                    >
                        <div
                            className="w-max min-w-full"
                            style={{
                                minWidth: `${Math.max(760, 128 + boardColumns.length * columnMinWidthPx)}px`,
                            }}
                        >
                            <div className="flex">
                                <TimeRail
                                    className="sticky left-0 z-20 w-16 shrink-0 bg-accent text-xs font-medium"
                                    headerClassName="bg-primary"
                                    rowBorderClassName="border-secondary/20"
                                    headerHeightRem={headerHeightRem}
                                    slotHeightRem={slotHeightRem}
                                    labels={timeLabels}
                                    keyPrefix="planner-left"
                                />
                                {boardColumns.map((column, columnIndex) => (
                                    <div
                                        key={`planner-column-${columnIndex}`}
                                        className="min-w-0 flex-1"
                                        style={{ minWidth: `${columnMinWidthPx}px` }}
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={(event) => {
                                            event.preventDefault();
                                            void handleColumnDrop(columnIndex);
                                        }}
                                    >
                                        <div
                                            className="flex items-center justify-center border-l border-primary bg-primary px-2 py-2 text-center text-sm font-semibold text-accent"
                                            style={{ height: `${headerHeightRem}rem` }}
                                        >
                                            Class Lane {columnIndex + 1}
                                        </div>
                                        <div
                                            className="relative border-l border-secondary/20 bg-accent"
                                            style={{ height: `${scheduleHeightRem}rem` }}
                                        >
                                            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                                                {timeLabels.map((label) => (
                                                    <div
                                                        key={`${columnIndex}-${label}`}
                                                        className="border-b border-secondary/10 last:border-b-0"
                                                        style={{ height: `${slotHeightRem}rem` }}
                                                    />
                                                ))}
                                            </div>
                                            {column.map((course) => {
                                                const startOffset =
                                                    (course.startMinutes - scheduleStartMinutes) /
                                                    slotMinutes;
                                                const courseHeight = course.runningTime / slotMinutes;
                                                const plannerClass = visibleClasses.find(
                                                    (item) => item.classKey === course.classKey,
                                                );
                                                const isSelected = selectedClassKey === course.classKey;
                                                const statusLabel = course.planningStatus === "planned_move"
                                                    ? "Planned Move"
                                                    : course.planningStatus === "pending_cancellation"
                                                        ? "Pending Cancellation"
                                                        : course.planningStatus === "cancelled"
                                                            ? "Cancelled"
                                                            : "";
                                                return (
                                                    <button
                                                        key={course.classKey}
                                                        type="button"
                                                        draggable
                                                        data-planner-course={course.classKey}
                                                        aria-pressed={isSelected}
                                                        aria-label={`${course.serviceName}, ${course.eventTime}, ${course.eventId}`}
                                                        className={`absolute inset-x-0 z-10 flex flex-col overflow-hidden border text-left text-[clamp(0.75rem,0.85vw,0.95rem)] leading-tight transition-colors hover:z-20 hover:brightness-95 focus-visible:z-20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${getPlannerBoardStatusClasses(
                                                            course.planningStatus,
                                                            isSelected,
                                                        )
                                                            } ${course.planningStatus === "active" && plannerClass
                                                                ? capacityClasses(plannerClass)
                                                                : ""
                                                            }`}
                                                        onClick={() => {
                                                            setSelectedClassKey(course.classKey);
                                                            setIsInfoPanelOpen(true);
                                                        }}
                                                        onDragStart={(event) => handleDragStart(
                                                            event,
                                                            course,
                                                            columnIndex,
                                                        )}
                                                        onDragEnd={() => setDragged(null)}
                                                        onDragOver={(event) => event.preventDefault()}
                                                        onDrop={(event) => {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            void handleCourseDrop(course, columnIndex);
                                                        }}
                                                        style={{
                                                            top: `${startOffset * slotHeightRem}rem`,
                                                            height: `${courseHeight * slotHeightRem}rem`,
                                                        }}
                                                    >
                                                        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1 text-center">
                                                            <span className="w-full break-words font-semibold">
                                                                {course.serviceName}
                                                            </span>
                                                            <span className="w-full truncate text-[0.7rem]">
                                                                {course.eventId} · {course.eventTime}
                                                            </span>
                                                            {statusLabel && (
                                                                <span className="max-w-full truncate rounded-full border border-current/25 bg-white/65 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide">
                                                                    {statusLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="shrink-0 border-t border-current/25 bg-white/60 px-1 py-0.5 text-center text-[0.7rem] font-semibold">
                                                            {course.bookedCount} of {course.maximumCapacity}
                                                            {course.waitlistCount > 0
                                                                ? ` · ${course.waitlistCount} waiting`
                                                                : ""}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                                <TimeRail
                                    className="sticky right-0 z-20 w-16 shrink-0 border-l border-secondary/20 bg-accent text-xs font-medium"
                                    headerClassName="bg-primary"
                                    rowBorderClassName="border-secondary/20"
                                    headerHeightRem={headerHeightRem}
                                    slotHeightRem={slotHeightRem}
                                    labels={timeLabels}
                                    keyPrefix="planner-right"
                                />
                            </div>
                            <div className="h-3 bg-primary" aria-hidden="true" />
                        </div>
                    </div>
                )}
        </section>
    );
}

export default PlannerBoard;

