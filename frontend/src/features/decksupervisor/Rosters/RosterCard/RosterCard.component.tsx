import LevelModeSwitch from "../LevelModeSwitch/LevelModeSwitch.component";
import LevelSelect from "../LevelSelect/LevelSelect.component";
import StudentRow from "../StudentRow/StudentRow.component";
import SwitchBackDialog from "../SwitchBackDialog/SwitchBackDialog.component";
import { formatLevelName } from "../../../../shared/levels/formatLevelName";
import { RosterCardProps, useRosterCardLogic } from "./RosterCard.logic";

const nameListClass =
    "mt-2 divide-y divide-secondary/15 border-y border-secondary/15";
const nameItemClass = "py-2 text-base font-semibold text-text";
const linkButtonClass =
    "font-medium text-primary underline underline-offset-2 hover:text-secondary";

function NotSaved() {
    return <span className="font-semibold text-danger">Not saved</span>;
}

function sourceClassLabel(student: { service_name: string; time: string }) {
    const start = student.time.split("-")[0]?.trim();
    return start ? `${student.service_name} · ${start}` : student.service_name;
}

function RosterCard(props: RosterCardProps) {
    const view = useRosterCardLogic(props);
    const {
        roster,
        containerClass,
        actionButtonClass,
        isCustom,
        canEdit,
        mode,
        classLevel,
        registeredLevel,
        isChangedFromRegistered,
        booked,
        waitlisted,
        ownLevelStudents,
        hasOwnLevels,
        sharedLevel,
        showMixedTag,
        saveStatus,
        failures,
        classNotSaved,
        isStudentNotSaved,
        switchBackOpen,
        onModeChange,
        onCancelSwitchBack,
        onSetAll,
        onMakeClassLevel,
        onClassLevelSelect,
        onResetClassLevel,
        onStudentLevelChange,
        onPrint,
        onRetry,
    } = view;
    const showSwitch = !isCustom && canEdit;
    const classSelectId = `class-level-${roster.code}`;
    const ownLevelIds = new Set(ownLevelStudents.map((student) => student.id));

    return (
        <div
            className={containerClass}
            id={roster.code}
            data-component="roster-card"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-secondary">
                    {roster.serviceName} : {roster.time}
                    {showMixedTag && (
                        <span className="ml-2 inline-block rounded-full bg-bg px-2 py-0.5 align-middle text-xs font-medium text-secondary">
                            Mixed levels
                        </span>
                    )}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                    {showSwitch && saveStatus && (
                        <span
                            className="text-xs text-secondary/70"
                            aria-live="polite"
                        >
                            {saveStatus === "saving" ? "Saving…" : "Saved"}
                        </span>
                    )}
                    {showSwitch && (
                        <LevelModeSwitch mode={mode} onChange={onModeChange} />
                    )}
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
            </div>

            {isCustom
                ? (
                    <div className="mt-4">
                        <label
                            htmlFor={classSelectId}
                            className="text-sm font-semibold text-secondary"
                        >
                            Roster level
                        </label>
                        <div className="mt-1 max-w-sm">
                            <LevelSelect
                                id={classSelectId}
                                value={classLevel}
                                onChange={onClassLevelSelect}
                            />
                        </div>
                        <p className="mt-1 text-xs text-secondary/70">
                            Every swimmer in this roster prints on the{" "}
                            {classLevel}{" "}
                            sheet. Their level in their own class does not
                            change.
                        </p>
                        <h3 className="mt-4 text-sm font-semibold text-secondary">
                            Swimmers ({booked.length})
                        </h3>
                        {booked.map((student) => (
                            <div
                                key={student.id}
                                id={`student-row-${student.id}`}
                                data-component="student-row"
                                className="mt-2 grid grid-cols-1 gap-1 md:grid-cols-[1.2fr_1fr] md:gap-3"
                            >
                                <p className="text-base font-semibold text-text">
                                    {student.name.replace(/"/g, "")}
                                </p>
                                <p className="text-sm text-secondary/80">
                                    {sourceClassLabel(student)}
                                </p>
                            </div>
                        ))}
                    </div>
                )
                : !canEdit
                ? (
                    <div className="mt-4">
                        <p className="text-sm text-secondary">
                            <span className="font-semibold">Class level:</span>
                            {" "}
                            {classLevel}
                        </p>
                        <p className="mt-1 text-xs text-secondary/70">
                            You can view levels but not change them.
                        </p>
                        <h3 className="mt-4 text-sm font-semibold text-secondary">
                            Swimmers ({booked.length})
                        </h3>
                        <ul className={nameListClass}>
                            {booked.map((student) => (
                                <li
                                    key={student.id}
                                    id={`student-row-${student.id}`}
                                    data-component="student-row"
                                    className={`${nameItemClass} flex flex-wrap items-baseline justify-between gap-x-3`}
                                >
                                    <span>{student.name.replace(/"/g, "")}</span>
                                    {hasOwnLevels && (
                                        <span className="text-sm font-normal text-secondary">
                                            {formatLevelName(student.level)}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )
                : mode === "class"
                ? (
                    <div className="mt-4">
                        <label
                            htmlFor={classSelectId}
                            className="text-sm font-semibold text-secondary"
                        >
                            Class level
                        </label>
                        <div className="mt-1 max-w-sm">
                            <LevelSelect
                                id={classSelectId}
                                value={classLevel}
                                onChange={onClassLevelSelect}
                            />
                        </div>
                        <p className="mt-1 text-xs text-secondary/70">
                            {classNotSaved && (
                                <>
                                    <NotSaved /> {" · "}
                                </>
                            )}
                            {isChangedFromRegistered
                                ? (
                                    <>
                                        Changed from {registeredLevel} ·{" "}
                                        <button
                                            type="button"
                                            className={linkButtonClass}
                                            onClick={onResetClassLevel}
                                        >
                                            Reset to {registeredLevel}
                                        </button>
                                    </>
                                )
                                : "From registration"}
                        </p>
                        <h3 className="mt-4 text-sm font-semibold text-secondary">
                            Swimmers ({booked.length})
                        </h3>
                        <ul className={nameListClass}>
                            {booked.map((student) => (
                                <li
                                    key={student.id}
                                    id={`student-row-${student.id}`}
                                    data-component="student-row"
                                    className={nameItemClass}
                                >
                                    {student.name.replace(/"/g, "")}
                                </li>
                            ))}
                        </ul>
                    </div>
                )
                : (
                    <div className="mt-2">
                        <p className="text-xs text-secondary/70">
                            Swimmers you don't change stay at the class level
                            ({classLevel}).
                        </p>
                        {booked.map((student) => (
                            <StudentRow
                                key={student.id}
                                student={student}
                                classLevel={classLevel}
                                hasOwnLevel={ownLevelIds.has(student.id)}
                                notSaved={isStudentNotSaved(student.id)}
                                onLevelChange={onStudentLevelChange}
                            />
                        ))}
                    </div>
                )}

            {failures.map((failure) => (
                <div
                    key={failure.target}
                    role="alert"
                    className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-danger/40 bg-danger/10 px-3 py-2 text-sm text-dangerHover"
                >
                    <span className="min-w-0 flex-1">{failure.message}</span>
                    <button
                        type="button"
                        className="rounded-lg bg-danger px-3 py-1 font-medium text-white hover:bg-dangerHover"
                        onClick={() => onRetry(failure.target)}
                    >
                        Retry
                    </button>
                </div>
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

            {switchBackOpen && (
                <SwitchBackDialog
                    classLevel={classLevel}
                    swimmers={ownLevelStudents.map((student) => ({
                        id: student.id,
                        name: student.name.replace(/"/g, ""),
                        level: formatLevelName(student.level),
                    }))}
                    sharedLevel={sharedLevel}
                    onCancel={onCancelSwitchBack}
                    onSetAll={onSetAll}
                    onMakeClassLevel={onMakeClassLevel}
                />
            )}
        </div>
    );
}

export default RosterCard;
