import { useEffect, useMemo, useRef, useState } from "react";
import { type SessionRecord } from "../../../../app/useCurrentSession";
import { onExtractedClassesBySessionUpdated } from "../../../../lib/extractedClassesStorage";
import { closeDeviceShare, createDeviceShare, type DeviceShareStarted, heartbeatDeviceShare, } from "../../../../lib/serverApi";
import { getCurrentSessionId } from "../../../../lib/sessionStorage";
import { onStudentsUpdated } from "../../../../lib/storage";
import { getStorageScope } from "../../../../lib/storageScope";
import { message } from "../DeviceExport.logic";
import { buildPackage, type ExportCourse, MAX_EXPORT_BYTES, newRegistry, parseDates, } from "../services/exportPackage";
import { downloadJSON, exportFilename, loadRegistry, restoreRegistry, saveRegistry, } from "../services/exportStorage";
import { loadExportCourses } from "../services/loadExportCourses";
export function useExportSessionLogic({ session, isGuest, scope }: {
    session: SessionRecord;
    isGuest: boolean;
    scope: string;
}) {
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
                `rec-tablet-ids-${session.id.replace(/[^a-zA-Z0-9_-]/g, "-")
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
    return {
        view: "ready" as const,
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
    };

}

