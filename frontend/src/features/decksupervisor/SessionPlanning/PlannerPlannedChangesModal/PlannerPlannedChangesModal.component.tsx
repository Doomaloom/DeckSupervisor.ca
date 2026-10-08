import { getPlannerMoveTargetLabel } from "../../../../lib/sessionPlanner";

import { dayNames } from "../utils/plannerPresentation";
import { PlannerPlannedChangesModalProps, statusLabels, usePlannerPlannedChangesModalLogic } from "./PlannerPlannedChangesModal.logic";
function PlannerPlannedChangesModal(props: PlannerPlannedChangesModalProps) {
    const viewModel = usePlannerPlannedChangesModalLogic(props);
    if (viewModel.view === "hidden") {
        return null;
    }
    const {
        onClose,
        groups,
        dataset,
        onToggleBarcodeCancelled,
        onOpenEmailDraft,
        onToggleEmailSent,
        onToggleComplete,
        getAlternativeLabel,
        onToggleAcceptedChecklistItem,
    } = viewModel;
    return (
        <div
            id="planner-planned-changes-modal"
            data-component="planner-planned-changes-modal"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
            <div
                data-component="planner-planned-changes-modal-panel"
                className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-card border-2 border-secondary/20 bg-accent p-4 text-secondary shadow-xl md:p-6"
            >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-secondary/20 pb-4">
                    <div>
                        <h3 className="text-2xl font-semibold text-secondary">
                            Planned Changes Summary
                        </h3>
                        <p className="mt-1 text-sm text-secondary/70">
                            Showing every student whose call workflow is no
                            longer not started.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="rounded-2xl border border-secondary/30 bg-bg px-3 py-2 text-sm font-semibold text-secondary transition hover:border-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>

                <div className="mt-6 flex flex-col gap-5">
                    {groups.map((group) => (
                        <section
                            key={group.plannerClass.classKey}
                            className="rounded-2xl border border-secondary/20 bg-bg p-5"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-lg font-semibold">
                                        {group.plannerClass.serviceName}
                                    </h4>
                                    <p className="mt-1 text-sm text-secondary/70">
                                        Code {group.plannerClass.eventId} •{" "}
                                        {dayNames[
                                            group.plannerClass.dayOfWeek
                                        ] ??
                                            group.plannerClass.dayOfWeek} •{" "}
                                        {group.plannerClass.eventTime} •{" "}
                                        {group.plannerClass.facility}
                                    </p>
                                    {group.plannerClass.planningStatus ===
                                        "planned_move"
                                        ? (
                                            <p className="mt-1 text-sm text-sky-900">
                                                Planned move:{" "}
                                                {getPlannerMoveTargetLabel(
                                                    dataset,
                                                    group.plannerClass,
                                                ) || "Not set"}
                                            </p>
                                        )
                                        : null}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {group.plannerClass.planningStatus ===
                                        "pending_cancellation" ||
                                        group.plannerClass
                                            .planningStatus ===
                                        "cancelled"
                                        ? (
                                            <button
                                                type="button"
                                                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${group.plannerClass
                                                    .barcodeCancelledAt
                                                    ? "bg-amber-100 text-amber-900"
                                                    : "border border-secondary/20 bg-accent text-secondary"
                                                    }`}
                                                onClick={() =>
                                                    void onToggleBarcodeCancelled(
                                                        group.plannerClass
                                                            .classKey,
                                                        !Boolean(
                                                            group.plannerClass
                                                                .barcodeCancelledAt,
                                                        ),
                                                    )}
                                            >
                                                {group.plannerClass
                                                    .barcodeCancelledAt
                                                    ? "Barcode Cancelled"
                                                    : "Mark Barcode Cancelled"}
                                            </button>
                                        )
                                        : null}
                                    <span className="rounded-full border border-secondary/20 bg-accent px-3 py-1 text-sm font-semibold">
                                        {group.rows.length} planned
                                    </span>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-col gap-3">
                                {group.rows.map((
                                    { participant, callRecord },
                                ) => (
                                    <div
                                        key={participant.id}
                                        className="rounded-2xl border border-secondary/20 bg-accent p-4"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold">
                                                    {participant.name}
                                                </p>
                                                <p className="text-sm text-secondary/70">
                                                    {participant.phone ||
                                                        "No phone"}{" "}
                                                    {participant.email
                                                        ? `• ${participant.email}`
                                                        : ""}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full border border-secondary/20 bg-bg px-3 py-1 text-sm font-semibold">
                                                    {statusLabels[
                                                        callRecord.status
                                                    ]}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="rounded-2xl border border-secondary/20 bg-bg px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-secondary/5"
                                                    onClick={() =>
                                                        onOpenEmailDraft(
                                                            participant,
                                                            group.plannerClass,
                                                            callRecord,
                                                        )}
                                                >
                                                    Email Draft
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${callRecord.emailSentAt
                                                        ? "bg-sky-100 text-sky-900"
                                                        : "border border-secondary/20 bg-bg text-secondary"
                                                        }`}
                                                    onClick={() =>
                                                        void onToggleEmailSent(
                                                            participant.id,
                                                            !Boolean(
                                                                callRecord
                                                                    .emailSentAt,
                                                            ),
                                                        )}
                                                >
                                                    {callRecord.emailSentAt
                                                        ? "Email Sent"
                                                        : "Mark Email Sent"}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${callRecord.completedAt
                                                        ? "bg-emerald-100 text-emerald-900"
                                                        : "bg-primary text-accent"
                                                        }`}
                                                    onClick={() =>
                                                        void onToggleComplete(
                                                            participant.id,
                                                            !Boolean(
                                                                callRecord
                                                                    .completedAt,
                                                            ),
                                                        )}
                                                >
                                                    {callRecord.completedAt
                                                        ? "Complete"
                                                        : "Mark Complete"}
                                                </button>
                                            </div>
                                        </div>

                                        {(callRecord
                                            .offeredAlternativeClassKey ||
                                            callRecord
                                                .acceptedAlternativeClassKey ||
                                            callRecord.notes)
                                            ? (
                                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                                    <div className="rounded-xl border border-secondary/20 bg-bg px-3 py-3 text-sm text-secondary">
                                                        <span className="font-semibold">
                                                            Alternative option:
                                                        </span>{" "}
                                                        {callRecord
                                                            .acceptedAlternativeClassKey
                                                            ? getAlternativeLabel(
                                                                callRecord
                                                                    .acceptedAlternativeClassKey,
                                                            )
                                                            : callRecord
                                                                .offeredAlternativeClassKey
                                                                ? getAlternativeLabel(
                                                                    callRecord
                                                                        .offeredAlternativeClassKey,
                                                                )
                                                                : "None"}
                                                    </div>
                                                    <div className="rounded-xl border border-secondary/20 bg-bg px-3 py-3 text-sm text-secondary">
                                                        <span className="font-semibold">
                                                            Notes:
                                                        </span>{" "}
                                                        {callRecord.notes ||
                                                            "None"}
                                                    </div>
                                                </div>
                                            )
                                            : null}

                                        {callRecord.status ===
                                            "accepted_alternative"
                                            ? (
                                                <div className="mt-3 rounded-2xl border border-secondary/20 bg-bg p-4">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary/60">
                                                        Accepted Alternative
                                                        Todo
                                                    </p>
                                                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                                                        {[
                                                            [
                                                                "withdrawRefundAt",
                                                                "Withdraw + refund",
                                                            ],
                                                            [
                                                                "refundReceiptSentAt",
                                                                "Send refund receipt",
                                                            ],
                                                            [
                                                                "reRegisteredAt",
                                                                "Re-register in alternative",
                                                            ],
                                                            [
                                                                "registrationConfirmationSentAt",
                                                                "Send registration confirmation",
                                                            ],
                                                        ].map(
                                                            (
                                                                [field, label],
                                                            ) => {
                                                                const fieldKey =
                                                                    field as
                                                                    | "withdrawRefundAt"
                                                                    | "refundReceiptSentAt"
                                                                    | "reRegisteredAt"
                                                                    | "registrationConfirmationSentAt";
                                                                const isDone =
                                                                    Boolean(
                                                                        callRecord[
                                                                        fieldKey
                                                                        ],
                                                                    );
                                                                return (
                                                                    <button
                                                                        key={field}
                                                                        type="button"
                                                                        className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition hover:-translate-y-0.5 ${isDone
                                                                            ? "bg-emerald-100 text-emerald-900"
                                                                            : "border border-secondary/20 bg-accent text-secondary"
                                                                            }`}
                                                                        onClick={() =>
                                                                            void onToggleAcceptedChecklistItem(
                                                                                participant
                                                                                    .id,
                                                                                fieldKey,
                                                                                !isDone,
                                                                            )}
                                                                    >
                                                                        {label}
                                                                    </button>
                                                                );
                                                            },
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                            : null}
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default PlannerPlannedChangesModal;

