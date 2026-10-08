import type { PlannerCallStatus, PlannerClass } from "../../../../types/app";

import { plannerCallStatusOptions } from "../../../../lib/sessionPlanner";

import { dayNames } from "../utils/plannerPresentation";
import { PlannerDetailsPanelProps, formatAlternativeLabel, usePlannerDetailsPanelLogic, userenderAlternativeSectionLogic } from "./PlannerDetailsPanel.logic";
function renderAlternativeSection(props: string, props1: PlannerClass[], props2: (option: PlannerClass) => JSX.Element) {
    const viewModel = userenderAlternativeSectionLogic(props, props1, props2);
    if (viewModel.view === "hidden") {
        return null;
    }
    const { title, options, renderOption } = viewModel;
    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary/60">
                {title}
            </p>
            {options.map(renderOption)}
        </div>
    );
}

function PlannerDetailsPanel(props: PlannerDetailsPanelProps) {
    const viewModel = usePlannerDetailsPanelLogic(props);
    if (viewModel.view === "hidden") {
        return null;
    }
    const {
        selectedClass,
        dataset,
        setIsInfoPanelOpen,
        setClassStatus,
        setClassMove,
        draftMoveTime,
        setDraftMoveTime,
        allAlternatives,
        plannedMoveLabel,
        alternatives,
        waitingParticipants,
        setCallRecord,
        bookedParticipants,
        setOpenAlternativeParticipantId,
        openAlternativeParticipantId,
        startCall,
    } = viewModel;
    return (
        <div
            id="planner-details-panel"
            data-component="planner-details-panel"
            className="flex min-w-0 flex-col gap-4 rounded-card border-2 border-secondary/20 bg-accent p-4 text-secondary shadow-md md:p-6 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto"
        >
            {!selectedClass || !dataset
                ? (
                    <>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                                    Class Details
                                </p>
                                <h3 className="mt-2 text-xl font-semibold">
                                    No class selected
                                </h3>
                            </div>
                            <button
                                type="button"
                                className="rounded-2xl border border-secondary/30 bg-bg px-3 py-2 text-sm font-semibold text-secondary transition hover:border-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                onClick={() => setIsInfoPanelOpen(false)}
                            >
                                Close
                            </button>
                        </div>
                        <div className="rounded-2xl border border-secondary/20 bg-bg p-5 text-sm text-secondary/70">
                            Select a class on the board to manage its
                            cancellation workflow.
                        </div>
                    </>
                )
                : (
                    <>
                        <div className="space-y-4 border-b border-secondary/20 pb-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-secondary/70">
                                        Class details
                                    </p>
                                    <h3 className="mt-1 break-words text-xl font-semibold">
                                        {selectedClass.serviceName}
                                    </h3>
                                    <p className="mt-1 text-sm text-secondary/75">
                                        {selectedClass.eventId} · {selectedClass.eventTime}
                                    </p>
                                    <p className="text-sm text-secondary/75">
                                        {dayNames[selectedClass.dayOfWeek] ?? selectedClass.dayOfWeek} · {selectedClass.facility}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="rounded-2xl border border-secondary/30 bg-bg px-3 py-2 text-sm font-semibold text-secondary transition hover:border-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                    onClick={() => setIsInfoPanelOpen(false)}
                                >
                                    Close
                                </button>
                            </div>
                            <div role="group" aria-label="Planning status" className="grid grid-cols-2 gap-2">
                                {([
                                    ["active", "Active", "border-emerald-400 bg-emerald-50 text-emerald-900"],
                                    ["planned_move", "Planned Move", "border-sky-400 bg-sky-50 text-sky-900"],
                                    ["pending_cancellation", "Pending Cancellation", "border-amber-400 bg-amber-50 text-amber-900"],
                                    ["cancelled", "Cancelled", "border-rose-400 bg-rose-50 text-rose-900"],
                                ] as const).map(([status, label, colorClass]) => (
                                    <button
                                        key={status}
                                        type="button"
                                        aria-pressed={selectedClass.planningStatus === status}
                                        className={`min-h-11 rounded-2xl border-2 px-2 py-2 text-sm font-semibold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${colorClass} ${selectedClass.planningStatus === status
                                            ? "ring-2 ring-secondary/30 ring-offset-2"
                                            : "opacity-75 hover:opacity-100"
                                            }`}
                                        onClick={() => void setClassStatus(selectedClass.classKey, status)}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
                                <p className="text-xs uppercase tracking-[0.14em] text-secondary/70">
                                    Capacity
                                </p>
                                <p className="mt-2 text-lg font-semibold">
                                    {selectedClass.bookedCount} /{" "}
                                    {selectedClass.maximumCapacity}
                                </p>
                                <p className="text-sm text-secondary/70">
                                    Minimum capacity{" "}
                                    {selectedClass.minimumCapacity}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
                                <p className="text-xs uppercase tracking-[0.14em] text-secondary/70">
                                    Waitlist
                                </p>
                                <p className="mt-2 text-lg font-semibold">
                                    {selectedClass.waitlistCount}
                                </p>
                                <p className="text-sm text-secondary/70">
                                    Booked count trusts the CSV Booked field.
                                </p>
                            </div>
                        </div>

                        {selectedClass.planningStatus === "planned_move"
                            ? (
                                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                                    <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-sky-900">
                                        Planned Move Destination
                                    </h4>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${selectedClass
                                                .plannedMoveType ===
                                                "new_time"
                                                ? "bg-sky-600 text-white"
                                                : "border border-sky-200 bg-white text-sky-900"
                                                }`}
                                            onClick={() =>
                                                void setClassMove(
                                                    selectedClass.classKey,
                                                    {
                                                        plannedMoveType:
                                                            "new_time",
                                                        plannedMoveTime:
                                                            draftMoveTime ||
                                                            selectedClass
                                                                .plannedMoveTime,
                                                    },
                                                )}
                                        >
                                            New Time
                                        </button>
                                        <button
                                            type="button"
                                            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${selectedClass
                                                .plannedMoveType ===
                                                "target_class"
                                                ? "bg-sky-600 text-white"
                                                : "border border-sky-200 bg-white text-sky-900"
                                                }`}
                                            onClick={() =>
                                                void setClassMove(
                                                    selectedClass.classKey,
                                                    {
                                                        plannedMoveType:
                                                            "target_class",
                                                        plannedMoveTargetClassKey:
                                                            selectedClass
                                                                .plannedMoveTargetClassKey,
                                                    },
                                                )}
                                        >
                                            Target Class
                                        </button>
                                        <button
                                            type="button"
                                            className="rounded-2xl border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-900 transition"
                                            onClick={() =>
                                                void setClassMove(
                                                    selectedClass.classKey,
                                                    {
                                                        plannedMoveType: "",
                                                        plannedMoveTime: "",
                                                        plannedMoveTargetClassKey:
                                                            "",
                                                    },
                                                )}
                                        >
                                            Clear
                                        </button>
                                    </div>

                                    {selectedClass.plannedMoveType ===
                                        "new_time"
                                        ? (
                                            <div className="mt-4 flex flex-wrap items-end gap-3">
                                                <label className="flex min-w-[220px] flex-1 flex-col gap-2 text-sm font-semibold text-sky-900">
                                                    New class time
                                                    <input
                                                        className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-secondary"
                                                        value={draftMoveTime ||
                                                            selectedClass
                                                                .plannedMoveTime}
                                                        onChange={(event) =>
                                                            setDraftMoveTime(
                                                                event.target
                                                                    .value,
                                                            )}
                                                        placeholder="Tuesday • 6:00 PM - 6:30 PM"
                                                    />
                                                </label>
                                                <button
                                                    type="button"
                                                    className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition"
                                                    onClick={() =>
                                                        void setClassMove(
                                                            selectedClass
                                                                .classKey,
                                                            {
                                                                plannedMoveType:
                                                                    "new_time",
                                                                plannedMoveTime:
                                                                    draftMoveTime ||
                                                                    selectedClass
                                                                        .plannedMoveTime,
                                                            },
                                                        )}
                                                >
                                                    Save New Time
                                                </button>
                                            </div>
                                        )
                                        : null}

                                    {selectedClass.plannedMoveType ===
                                        "target_class"
                                        ? (
                                            <label className="mt-4 flex flex-col gap-2 text-sm font-semibold text-sky-900">
                                                Move participants to
                                                <select
                                                    className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-secondary"
                                                    value={selectedClass
                                                        .plannedMoveTargetClassKey}
                                                    onChange={(event) =>
                                                        void setClassMove(
                                                            selectedClass
                                                                .classKey,
                                                            {
                                                                plannedMoveType:
                                                                    "target_class",
                                                                plannedMoveTargetClassKey:
                                                                    event.target
                                                                        .value,
                                                            },
                                                        )}
                                                >
                                                    <option value="">
                                                        Select a target class
                                                    </option>
                                                    {allAlternatives.map((
                                                        option,
                                                    ) => (
                                                        <option
                                                            key={option
                                                                .classKey}
                                                            value={option
                                                                .classKey}
                                                        >
                                                            {formatAlternativeLabel(
                                                                option,
                                                            )}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        )
                                        : null}

                                    <p className="mt-4 text-sm text-sky-900/80">
                                        {plannedMoveLabel
                                            ? `Current planned move: ${plannedMoveLabel}`
                                            : "Set a new time or choose a target class for this planned move."}
                                    </p>
                                </div>
                            )
                            : null}

                        <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
                            <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-secondary/70">
                                Alternative Classes
                            </h4>
                            <div className="mt-3 flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
                                {allAlternatives.length === 0
                                    ? (
                                        <p className="text-sm text-secondary/70">
                                            No exact ServiceName alternatives
                                            found.
                                        </p>
                                    )
                                    : (
                                        <>
                                            {renderAlternativeSection(
                                                "Available Alternatives",
                                                alternatives
                                                    .availableAlternatives,
                                                (option) => (
                                                    <div
                                                        key={option.classKey}
                                                        className="rounded-2xl border border-secondary/20 bg-accent p-3"
                                                    >
                                                        <p className="font-semibold">
                                                            {dayNames[
                                                                option.dayOfWeek
                                                            ] ??
                                                                option
                                                                    .dayOfWeek}
                                                            {" "}
                                                            • {option.eventTime}
                                                        </p>
                                                        <p className="text-sm text-secondary/70">
                                                            {option.facility} •
                                                            {" "}
                                                            {option
                                                                .bookedCount}/{option
                                                                    .maximumCapacity}
                                                            {" "}
                                                            booked • waitlist
                                                            {" "}
                                                            {option
                                                                .waitlistCount}
                                                        </p>
                                                    </div>
                                                ),
                                            )}
                                            {renderAlternativeSection(
                                                "Full Alternatives",
                                                alternatives.fullAlternatives,
                                                (option) => (
                                                    <div
                                                        key={option.classKey}
                                                        className="rounded-2xl border border-secondary/20 bg-accent p-3 opacity-80"
                                                    >
                                                        <p className="font-semibold">
                                                            {dayNames[
                                                                option.dayOfWeek
                                                            ] ??
                                                                option
                                                                    .dayOfWeek}
                                                            {" "}
                                                            • {option.eventTime}
                                                        </p>
                                                        <p className="text-sm text-secondary/70">
                                                            {option.facility} •
                                                            {" "}
                                                            {option
                                                                .bookedCount}/{option
                                                                    .maximumCapacity}
                                                            {" "}
                                                            booked • waitlist
                                                            {" "}
                                                            {option
                                                                .waitlistCount}
                                                        </p>
                                                    </div>
                                                ),
                                            )}
                                        </>
                                    )}
                            </div>
                        </div>

                        {waitingParticipants.length > 0
                            ? (
                                <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
                                    <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-secondary/70">
                                        Waitlist Contacts
                                    </h4>
                                    <div className="mt-3 flex max-h-56 flex-col gap-3 overflow-y-auto pr-1">
                                        {waitingParticipants.map(
                                            (participant) => {
                                                const callRecord = dataset
                                                    .callRecords[
                                                    participant.id
                                                ];
                                                return (
                                                    <div
                                                        key={participant.id}
                                                        className="rounded-2xl border border-secondary/20 bg-accent p-4"
                                                    >
                                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                                            <div>
                                                                <p className="font-semibold">
                                                                    {participant
                                                                        .name}
                                                                </p>
                                                                <p className="mt-1 text-sm text-secondary/70">
                                                                    {participant
                                                                        .phone ||
                                                                        "No phone"}
                                                                    {" "}
                                                                    {participant
                                                                        .email
                                                                        ? `• ${participant.email}`
                                                                        : ""}
                                                                </p>
                                                                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-secondary/60">
                                                                    Waitlist
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${callRecord
                                                                    ?.status ===
                                                                    "called"
                                                                    ? "bg-primary text-accent"
                                                                    : "border border-secondary/20 bg-bg text-secondary hover:bg-secondary/5"
                                                                    }`}
                                                                onClick={() =>
                                                                    void setCallRecord(
                                                                        participant
                                                                            .id,
                                                                        {
                                                                            status:
                                                                                callRecord
                                                                                    ?.status ===
                                                                                    "called"
                                                                                    ? "not_started"
                                                                                    : "called",
                                                                        },
                                                                    )}
                                                            >
                                                                {callRecord
                                                                    ?.status ===
                                                                    "called"
                                                                    ? "Called"
                                                                    : "Mark Called"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            },
                                        )}
                                    </div>
                                </div>
                            )
                            : null}

                        {selectedClass.planningStatus === "active"
                            ? (
                                <div className="rounded-2xl border border-secondary/20 bg-bg p-4 text-sm text-secondary/70">
                                    Mark this class as planned move, pending
                                    cancellation, or cancelled to start the call
                                    workflow.
                                </div>
                            )
                            : (
                                <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-secondary/20 bg-bg p-4">
                                    <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-secondary/70">
                                        {selectedClass.planningStatus ===
                                            "planned_move"
                                            ? "Move Call Workflow"
                                            : "Cancellation Call Workflow"}
                                    </h4>
                                    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
                                        {bookedParticipants.map(
                                            (participant) => {
                                                const callRecord = dataset
                                                    .callRecords[
                                                    participant.id
                                                ];
                                                return (
                                                    <div
                                                        key={participant.id}
                                                        className="rounded-2xl border border-secondary/20 bg-accent p-4"
                                                    >
                                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                                            <div>
                                                                <p className="font-semibold">
                                                                    {participant
                                                                        .name}
                                                                </p>
                                                                <p className="text-sm text-secondary/70">
                                                                    {participant
                                                                        .phone ||
                                                                        "No phone"}
                                                                    {" "}
                                                                    {participant
                                                                        .email
                                                                        ? `• ${participant.email}`
                                                                        : ""}
                                                                </p>
                                                            </div>
                                                            <select
                                                                className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                                                                value={callRecord
                                                                    ?.status ??
                                                                    "not_started"}
                                                                onChange={(
                                                                    event,
                                                                ) => void setCallRecord(
                                                                    participant
                                                                        .id,
                                                                    {
                                                                        status:
                                                                            event
                                                                                .target
                                                                                .value as PlannerCallStatus,
                                                                    },
                                                                )}
                                                            >
                                                                {plannerCallStatusOptions
                                                                    .map((
                                                                        option,
                                                                    ) => (
                                                                        <option
                                                                            key={option
                                                                                .key}
                                                                            value={option
                                                                                .key}
                                                                        >
                                                                            {option
                                                                                .label}
                                                                        </option>
                                                                    ))}
                                                            </select>
                                                        </div>

                                                        <div className="mt-3 grid gap-3">
                                                            <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                                                                Alternative
                                                                Option
                                                                <div className="relative">
                                                                    <button
                                                                        type="button"
                                                                        className="flex w-full items-start justify-between gap-2 rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-left text-sm text-secondary"
                                                                        onClick={() =>
                                                                            setOpenAlternativeParticipantId(
                                                                                (
                                                                                    current,
                                                                                ) => current ===
                                                                                    participant
                                                                                        .id
                                                                                        ? ""
                                                                                        : participant
                                                                                            .id,
                                                                            )}
                                                                    >
                                                                        <span className="min-w-0 break-words">
                                                                            {callRecord
                                                                                ?.offeredAlternativeClassKey
                                                                                ? formatAlternativeLabel(
                                                                                    allAlternatives
                                                                                        .find(
                                                                                            (
                                                                                                option,
                                                                                            ) => option
                                                                                                .classKey ===
                                                                                                callRecord
                                                                                                    .offeredAlternativeClassKey,
                                                                                        ) ??
                                                                                    {
                                                                                        classKey:
                                                                                            "",
                                                                                        eventId:
                                                                                            "",
                                                                                        sessionKey:
                                                                                            "",
                                                                                        serviceName:
                                                                                            "",
                                                                                        dayOfWeek:
                                                                                            "",
                                                                                        eventTime:
                                                                                            "",
                                                                                        facility:
                                                                                            "",
                                                                                        sessionSeason:
                                                                                            "",
                                                                                        sessionYear:
                                                                                            0,
                                                                                        minimumCapacity:
                                                                                            0,
                                                                                        maximumCapacity:
                                                                                            0,
                                                                                        bookedCount:
                                                                                            0,
                                                                                        waitlistCount:
                                                                                            0,
                                                                                        participantIds:
                                                                                            [],
                                                                                        waitingParticipantIds:
                                                                                            [],
                                                                                        laneIndex:
                                                                                            0,
                                                                                        planningStatus:
                                                                                            "active",
                                                                                        plannedMoveType:
                                                                                            "",
                                                                                        plannedMoveTime:
                                                                                            "",
                                                                                        plannedMoveTargetClassKey:
                                                                                            "",
                                                                                        barcodeCancelledAt:
                                                                                            "",
                                                                                    },
                                                                                )
                                                                                : "No alternative selected"}
                                                                        </span>
                                                                        <span className="shrink-0 text-secondary/60">
                                                                            {openAlternativeParticipantId ===
                                                                                participant
                                                                                    .id
                                                                                ? "▲"
                                                                                : "▼"}
                                                                        </span>
                                                                    </button>
                                                                    {openAlternativeParticipantId ===
                                                                        participant
                                                                            .id
                                                                        ? (
                                                                            <div className="absolute z-10 mt-2 w-full rounded-2xl border border-secondary/20 bg-accent p-2 shadow-lg">
                                                                                <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                                                                                    <button
                                                                                        type="button"
                                                                                        className="rounded-xl border border-secondary/20 bg-bg px-3 py-2 text-left text-sm text-secondary transition hover:bg-secondary/5"
                                                                                        onClick={() => {
                                                                                            void setCallRecord(
                                                                                                participant
                                                                                                    .id,
                                                                                                {
                                                                                                    offeredAlternativeClassKey:
                                                                                                        "",
                                                                                                    acceptedAlternativeClassKey:
                                                                                                        "",
                                                                                                },
                                                                                            );
                                                                                            setOpenAlternativeParticipantId(
                                                                                                "",
                                                                                            );
                                                                                        }}
                                                                                    >
                                                                                        No
                                                                                        alternative
                                                                                        selected
                                                                                    </button>
                                                                                    {renderAlternativeSection(
                                                                                        "Available Alternatives",
                                                                                        alternatives
                                                                                            .availableAlternatives,
                                                                                        (
                                                                                            option,
                                                                                        ) => (
                                                                                            <button
                                                                                                key={option
                                                                                                    .classKey}
                                                                                                type="button"
                                                                                                className="rounded-xl border border-secondary/20 bg-bg px-3 py-2 text-left text-sm text-secondary transition hover:bg-secondary/5"
                                                                                                onClick={() => {
                                                                                                    void setCallRecord(
                                                                                                        participant
                                                                                                            .id,
                                                                                                        {
                                                                                                            offeredAlternativeClassKey:
                                                                                                                option
                                                                                                                    .classKey,
                                                                                                            acceptedAlternativeClassKey:
                                                                                                                option
                                                                                                                    .classKey ===
                                                                                                                    callRecord
                                                                                                                        ?.acceptedAlternativeClassKey
                                                                                                                    ? option
                                                                                                                        .classKey
                                                                                                                    : "",
                                                                                                        },
                                                                                                    );
                                                                                                    setOpenAlternativeParticipantId(
                                                                                                        "",
                                                                                                    );
                                                                                                }}
                                                                                            >
                                                                                                <span className="break-words">
                                                                                                    {formatAlternativeLabel(
                                                                                                        option,
                                                                                                    )}
                                                                                                </span>
                                                                                            </button>
                                                                                        ),
                                                                                    )}
                                                                                    {renderAlternativeSection(
                                                                                        "Full Alternatives",
                                                                                        alternatives
                                                                                            .fullAlternatives,
                                                                                        (
                                                                                            option,
                                                                                        ) => (
                                                                                            <button
                                                                                                key={option
                                                                                                    .classKey}
                                                                                                type="button"
                                                                                                className="rounded-xl border border-secondary/20 bg-bg px-3 py-2 text-left text-sm text-secondary transition hover:bg-secondary/5"
                                                                                                onClick={() => {
                                                                                                    void setCallRecord(
                                                                                                        participant
                                                                                                            .id,
                                                                                                        {
                                                                                                            offeredAlternativeClassKey:
                                                                                                                option
                                                                                                                    .classKey,
                                                                                                            acceptedAlternativeClassKey:
                                                                                                                option
                                                                                                                    .classKey ===
                                                                                                                    callRecord
                                                                                                                        ?.acceptedAlternativeClassKey
                                                                                                                    ? option
                                                                                                                        .classKey
                                                                                                                    : "",
                                                                                                        },
                                                                                                    );
                                                                                                    setOpenAlternativeParticipantId(
                                                                                                        "",
                                                                                                    );
                                                                                                }}
                                                                                            >
                                                                                                <span className="break-words">
                                                                                                    {formatAlternativeLabel(
                                                                                                        option,
                                                                                                    )}
                                                                                                </span>
                                                                                            </button>
                                                                                        ),
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                        : null}
                                                                </div>
                                                            </label>
                                                        </div>

                                                        <label className="mt-3 flex flex-col gap-2 text-sm font-semibold text-secondary">
                                                            Notes
                                                            <textarea
                                                                className="min-h-20 rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                                                                value={callRecord
                                                                    ?.notes ??
                                                                    ""}
                                                                onChange={(
                                                                    event,
                                                                ) => void setCallRecord(
                                                                    participant
                                                                        .id,
                                                                    {
                                                                        notes:
                                                                            event
                                                                                .target
                                                                                .value,
                                                                    },
                                                                )}
                                                            />
                                                        </label>
                                                        <div className="mt-4 flex justify-end">
                                                            <button
                                                                type="button"
                                                                className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5"
                                                                onClick={() =>
                                                                    startCall(
                                                                        participant
                                                                            .id,
                                                                    )}
                                                            >
                                                                Call Parent /
                                                                Guardian
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            },
                                        )}
                                    </div>
                                </div>
                            )}
                    </>
                )}
        </div>
    );
}

export default PlannerDetailsPanel;

