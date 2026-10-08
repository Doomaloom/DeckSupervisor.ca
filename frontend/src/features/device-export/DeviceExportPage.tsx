import {
    ActionButton,
    EmptyState,
    Notice,
    PageShell,
    Select,
    Textarea,
    TextInput,
} from "../../general-components";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/AuthContext";
import {
    type SessionRecord,
    useCurrentSession,
} from "../../app/useCurrentSession";
import { getCurrentSessionId } from "../../lib/sessionStorage";
import { getStorageScope, onStorageScopeChanged } from "../../lib/storageScope";
import { onStudentsUpdated } from "../../lib/storage";
import { onExtractedClassesBySessionUpdated } from "../../lib/extractedClassesStorage";
import { loadExportCourses } from "./loadExportCourses";
import {
    buildPackage,
    type ExportCourse,
    MAX_EXPORT_BYTES,
    newRegistry,
    parseDates,
} from "./exportPackage";
import {
    downloadJSON,
    exportFilename,
    loadRegistry,
    restoreRegistry,
    saveRegistry,
} from "./exportStorage";
import {
    closeDeviceShare,
    createDeviceShare,
    type DeviceShareStarted,
    heartbeatDeviceShare,
} from "../../lib/serverApi";

const panel =
    "rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md";
const message = (error: unknown) =>
    error instanceof Error
        ? error.message
        : "Unable to prepare the export. Please try again.";

export default function DeviceExportPage() {
    const { session, sessionId, loading } = useCurrentSession();
    const { isGuest } = useAuth();
    const [scope, setScope] = useState(getStorageScope);
    useEffect(() => onStorageScopeChanged(setScope), []);
    if (loading || (session && session.id !== sessionId)) {
        return <p role="status">Loading selected session…</p>;
    }
    if (!session || !sessionId) {
        return (
            <PageShell maxWidth="5xl" className="min-w-0">
                <header className="flex flex-col gap-1">
                    <h2 className="text-2xl font-semibold text-secondary">
                        Device Exports
                    </h2>
                </header>
                <EmptyState>
                    Select a session and load its class data to export
                    instructor lessons. {" "}
                    <Link className="underline" to="/manage-sessions">
                        Manage sessions
                    </Link>
                </EmptyState>
            </PageShell>
        );
    }
    return (
        <ExportSession
            key={`${scope}:${sessionId}`}
            session={session}
            isGuest={isGuest}
            scope={scope}
        />
    );
}

function ExportSession(
    { session, isGuest, scope }: {
        session: SessionRecord;
        isGuest: boolean;
        scope: string;
    },
) {
    const [courses, setCourses] = useState<ExportCourse[]>([]);
    const [instructor, setInstructor] = useState("");
    const [dates, setDates] = useState<Record<string, string>>({});
    const [shareSession, setShareSession] = useState<DeviceShareStarted | null>(
        null,
    );
    const [shareBusy, setShareBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [revision, setRevision] = useState(0);
    const generation = useRef(0);
    const working = useRef(false);
    useEffect(() => {
        const refresh = () => {
            generation.current++;
            setLoading(true);
            setRevision((value) => value + 1);
        };
        const offStudents = onStudentsUpdated(refresh);
        const offClasses = onExtractedClassesBySessionUpdated((id) => {
            if (id === session.id) refresh();
        });
        return () => {
            generation.current++;
            offStudents();
            offClasses();
        };
    }, [session.id]);
    useEffect(() => {
        const current = ++generation.current;
        setLoading(true);
        setError("");
        setNotice("");
        void loadExportCourses(session, isGuest).then((result) => {
            if (current !== generation.current) return;
            const registry = loadRegistry(session.id);
            setCourses(result);
            setDates(
                Object.fromEntries(
                    Object.entries(registry?.dates ?? {}).map((
                        [code, dates],
                    ) => [code, dates.join("\n")]),
                ),
            );
            setLoading(false);
        }).catch((cause) => {
            if (current === generation.current) {
                setCourses([]);
                setError(message(cause));
                setLoading(false);
            }
        });
        return () => {
            generation.current++;
        };
    }, [session, isGuest, revision]);
    const instructors = useMemo(
        () =>
            [
                ...new Set(
                    courses.map((course) => course.instructor).filter(Boolean),
                ),
            ]
                .sort(),
        [courses],
    );
    const selected = courses.filter((course) =>
        course.instructor === instructor && instructor
    );
    const unassigned = courses.filter((course) => !course.instructor);
    const dateText = (course: ExportCourse) =>
        dates[course.code] ?? course.lessonDates.join("\n");
    const currentSession = () =>
        session.id === getCurrentSessionId() && scope === getStorageScope();
    const exportClasses = async () => {
        if (
            working.current || loading || shareSession || shareBusy ||
            !currentSession()
        ) return;
        working.current = true;
        setBusy(true);
        setError("");
        setNotice("");
        const current = generation.current;
        try {
            const reviewed = selected.map((course) => ({
                ...course,
                lessonDates: parseDates(dateText(course)),
            }));
            const registry = loadRegistry(session.id) ??
                newRegistry(session.id);
            const result = await buildPackage(
                session.id,
                instructor,
                reviewed,
                registry,
            );
            if (!currentSession() || current !== generation.current) {
                throw new Error(
                    "The session or roster changed. Review the current classes before exporting.",
                );
            }
            saveRegistry(result.registry);
            downloadJSON(
                result.package,
                exportFilename(instructor, session.id),
            );
            setNotice(
                `Downloaded ${result.package.courses.length} classes for ${instructor}. Save an ID backup before moving to another browser.`,
            );
        } catch (cause) {
            if (currentSession()) setError(message(cause));
        } finally {
            working.current = false;
            setBusy(false);
        }
    };
    const startShare = async () => {
        if (
            working.current || loading || shareBusy || shareSession ||
            !instructors.length || !currentSession()
        ) return;
        working.current = true;
        setShareBusy(true);
        setError("");
        setNotice("");
        const current = generation.current;
        try {
            let registry = loadRegistry(session.id) ?? newRegistry(session.id);
            const packages: Array<{ instructor: string; package: unknown }> =
                [];
            for (const name of instructors) {
                const reviewed = courses.filter((course) =>
                    course.instructor === name
                )
                    .map((course) => ({
                        ...course,
                        lessonDates: parseDates(dateText(course)),
                    }));
                const result = await buildPackage(
                    session.id,
                    name,
                    reviewed,
                    registry,
                );
                registry = result.registry;
                packages.push({ instructor: name, package: result.package });
            }
            if (!currentSession() || current !== generation.current) {
                throw new Error(
                    "The session or roster changed. Review the current classes before sharing.",
                );
            }
            saveRegistry(registry);
            const started = await createDeviceShare(packages);
            if (!currentSession() || current !== generation.current) {
                void closeDeviceShare(started.id, started.hostToken);
                throw new Error(
                    "The session changed while the share was starting. Start again from the selected session.",
                );
            }
            setShareSession(started);
            setNotice(
                "Session sharing is active. Give each instructor their code; end and restart sharing to publish roster changes.",
            );
        } catch (cause) {
            if (currentSession()) setError(message(cause));
        } finally {
            working.current = false;
            setShareBusy(false);
        }
    };
    const endShare = async () => {
        if (!shareSession) return;
        setShareBusy(true);
        try {
            await closeDeviceShare(shareSession.id, shareSession.hostToken);
            setShareSession(null);
            setNotice("Session sharing ended.");
        } catch (cause) {
            setError(message(cause));
        } finally {
            setShareBusy(false);
        }
    };
    useEffect(() => {
        if (!shareSession) return;
        const id = shareSession.id;
        const token = shareSession.hostToken;
        const timer = window.setInterval(() => {
            void heartbeatDeviceShare(id, token).catch((cause) =>
                setError(`Sharing connection interrupted: ${message(cause)}`)
            );
        }, 15_000);
        return () => {
            window.clearInterval(timer);
            void closeDeviceShare(id, token).catch(() => undefined);
        };
    }, [shareSession?.id, shareSession?.hostToken]);
    const backup = () => {
        try {
            if (!currentSession()) return;
            const registry = loadRegistry(session.id);
            if (!registry) {
                throw new Error(
                    "Export classes first to create this session’s saved IDs.",
                );
            }
            downloadJSON(
                registry,
                `rec-tablet-ids-${
                    session.id.replace(/[^a-zA-Z0-9_-]/g, "-")
                }.json`,
            );
            setNotice(
                "Downloaded export ID backup. Keep it for future exports from another browser.",
            );
            setError("");
        } catch (cause) {
            setError(message(cause));
        }
    };
    const restore = async (file: File) => {
        try {
            if (file.size > MAX_EXPORT_BYTES) {
                throw new Error("ID backup is too large.");
            }
            const text = await file.text();
            if (!currentSession()) return;
            restoreRegistry(text, session.id);
            const registry = loadRegistry(session.id);
            setDates(
                Object.fromEntries(
                    Object.entries(registry?.dates ?? {}).map((
                        [code, dates],
                    ) => [code, dates.join("\n")]),
                ),
            );
            setError("");
            setNotice("Export IDs restored for this session.");
        } catch (cause) {
            if (currentSession()) setError(message(cause));
        }
    };
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
