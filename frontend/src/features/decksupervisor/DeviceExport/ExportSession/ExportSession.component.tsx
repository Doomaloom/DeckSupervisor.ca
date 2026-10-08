import { Link } from "react-router-dom";
import { type SessionRecord } from "../../../../app/useCurrentSession";
import { ActionButton, Notice, PageShell, Select, Textarea, TextInput } from "../../../../general-components";
import { panel } from "../DeviceExport.logic";
import { useExportSessionLogic } from "./ExportSession.logic";
export function ExportSession(props: {
    session: SessionRecord;
    isGuest: boolean;
    scope: string;
}) {
    const viewModel = useExportSessionLogic(props);
    const {
        error,
        notice,
        instructor,
        loading,
        busy,
        shareBusy,
        shareSession,
        setInstructor,
        setError,
        setNotice,
        instructors,
        setRevision,
        courses,
        unassigned,
        selected,
        dateText,
        setDates,
        exportClasses,
        endShare,
        startShare,
        backup,
        restore,
    } = viewModel;
    return (
        <PageShell maxWidth="5xl" className="min-w-0">
            <header>
                <h2 className="text-2xl font-semibold text-secondary">
                    Device Exports
                </h2>
            </header>
            {error && <Notice tone="danger" role="alert">{error}</Notice>}
            {notice && <Notice tone="success" role="status">{notice}</Notice>}
            <section className={panel}>
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <label className="flex min-w-0 max-w-full flex-col gap-2 text-sm font-semibold">
                        Instructor<Select
                            value={instructor}
                            disabled={loading || busy || shareBusy ||
                                !!shareSession}
                            onChange={(event) => {
                                setInstructor(event.target.value);
                                setError("");
                                setNotice("");
                            }}
                        >
                            <option value="">Choose an instructor</option>
                            {instructors.map((name) => (
                                <option key={name}>{name}</option>
                            ))}
                        </Select>
                    </label>
                    <ActionButton
                        disabled={busy || shareBusy || !!shareSession ||
                            loading}
                        onClick={() => setRevision((value) => value + 1)}
                    >
                        Refresh loaded data
                    </ActionButton>
                </div>
                {loading
                    ? (
                        <p className="mt-4" role="status">
                            Loading classes and saved assignments…
                        </p>
                    )
                    : (
                        <>
                            {!courses.length && (
                                <p className="mt-4">
                                    No classes are available for this session.
                                    {" "}
                                    <Link className="underline" to="/rosters">
                                        Check the loaded rosters.
                                    </Link>
                                </p>
                            )}
                            {unassigned.length > 0 && (
                                <p className="mt-4 text-header">
                                    {unassigned.length}{" "}
                                    unassigned classes will not be exported:
                                    {" "}
                                    {unassigned.map((course) => course.code)
                                        .join(", ")}. Assign them in Schematic
                                    or Rosters.
                                </p>
                            )}
                            {!!selected.length && (
                                <>
                                    <p className="mt-5 font-semibold">
                                        {selected.length} classes ·{" "}
                                        {selected.reduce(
                                            (count, course) =>
                                                count + course.students.length,
                                            0,
                                        )} enrolled swimmers
                                    </p>
                                    <p className="mt-2 text-sm">
                                        Review dates for each class, including
                                        holidays and cancellations. Dates start
                                        from the session schedule; edit them
                                        below using YYYY-MM-DD, one per line.
                                        Waitlisted swimmers and contact details
                                        are excluded.
                                    </p>
                                    <div className="mt-4 flex flex-col gap-3">
                                        {selected.map((course) => (
                                            <details
                                                key={course.code}
                                                className="rounded-2xl border border-secondary/20 bg-bg p-4 shadow-sm open:border-secondary/40 open:shadow-md"
                                            >
                                                <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                                                    {course.startTime} ·{" "}
                                                    {course.name} ·{" "}
                                                    {course.code} ·{" "}
                                                    {course.students.length}
                                                    {" "}
                                                    swimmers
                                                </summary>
                                                <p className="my-2 text-sm">
                                                    {course.location} ·{" "}
                                                    {course.level}
                                                </p>
                                                <ul className="mb-3 list-inside list-disc text-sm">
                                                    {course.students.map((
                                                        student,
                                                        i,
                                                    ) => (
                                                        <li
                                                            key={`${student.id}:${i}`}
                                                        >
                                                            {student.name} —
                                                            {" "}
                                                            {student.level ||
                                                                course.level}
                                                        </li>
                                                    ))}
                                                </ul>
                                                <label className="flex flex-col gap-2">
                                                    Lesson dates for{" "}
                                                    {course.code}
                                                    <Textarea
                                                        aria-label={`Lesson dates for ${course.code}`}
                                                        disabled={busy ||
                                                            shareBusy ||
                                                            !!shareSession}
                                                        className="min-h-32 font-mono"
                                                        value={dateText(course)}
                                                        onChange={(event) => {
                                                            setDates((
                                                                value,
                                                            ) => ({
                                                                ...value,
                                                                [course.code]:
                                                                    event.target
                                                                        .value,
                                                            }));
                                                        }}
                                                    />
                                                </label>
                                            </details>
                                        ))}
                                    </div>
                                </>
                            )}
                            <ActionButton
                                className="mt-4"
                                disabled={!selected.length || busy ||
                                    shareBusy ||
                                    !!shareSession || loading}
                                onClick={() => void exportClasses()}
                            >
                                {busy
                                    ? "Preparing export…"
                                    : "Download instructor classes"}
                            </ActionButton>
                            <div className="mt-5 border-t border-secondary/20 pt-5">
                                <h3 className="text-lg font-semibold">
                                    Temporary session sharing
                                </h3>
                                <p className="my-2 text-sm">
                                    You can review instructor rosters and lesson
                                    dates above before starting. Each code
                                    downloads that instructor’s package. Sharing
                                    ends when you end it or leave this page.
                                </p>
                                {shareSession
                                    ? (
                                        <>
                                            <div className="my-4 grid gap-2 sm:grid-cols-2">
                                                {shareSession.codes.map((
                                                    item,
                                                ) => (
                                                    <div
                                                        key={item.instructor}
                                                        className="rounded-2xl border border-secondary/20 bg-bg p-3"
                                                    >
                                                        <span className="font-semibold">
                                                            {item.instructor}
                                                        </span>
                                                        <span className="float-right font-mono text-xl tracking-widest">
                                                            {item.code}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            <ActionButton
                                                disabled={shareBusy}
                                                onClick={() => void endShare()}
                                            >
                                                {shareBusy
                                                    ? "Ending…"
                                                    : "End Sharing"}
                                            </ActionButton>
                                        </>
                                    )
                                    : (
                                        <ActionButton
                                            className="mt-3"
                                            disabled={shareBusy || busy ||
                                                loading ||
                                                !instructors.length}
                                            onClick={() => void startShare()}
                                        >
                                            {shareBusy
                                                ? "Starting session…"
                                                : "Start Session and Create Codes"}
                                        </ActionButton>
                                    )}
                            </div>
                        </>
                    )}
            </section>
            <section className={panel}>
                <h3 className="text-lg font-semibold">
                    Keep IDs for repeat exports
                </h3>
                <p className="my-3 text-sm">
                    This browser saves export IDs so reordering rosters or
                    editing skill levels keeps device progress attached to the
                    same enrollment. Save a backup after exports. Restore it
                    before exporting this session from another browser or after
                    clearing browser data. The backup contains swimmer names and
                    matching signatures; keep it with your class files.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                    <ActionButton
                        disabled={busy || shareBusy || !!shareSession}
                        onClick={backup}
                    >
                        Download ID backup
                    </ActionButton>
                    <label className="flex min-w-0 max-w-full flex-col gap-2 text-sm">
                        Restore ID backup<TextInput
                            className="w-full min-w-0"
                            type="file"
                            accept=".json,application/json"
                            disabled={busy || shareBusy || !!shareSession}
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) void restore(file);
                            }}
                        />
                    </label>
                </div>
            </section>
        </PageShell>
    );
}
