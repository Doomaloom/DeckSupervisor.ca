import { ActionButton, Notice } from "../../general-components";
import { useEffect, useMemo, useState } from "react";
import {
    fetchLessonPlan,
    type InstructorClass,
    type InstructorSession,
    type LessonPlan,
} from "../../lib/serverApi";
import { openPdfPrintDialog, openPrintWindow } from "../../lib/browserPrint";
import type { PdfArtifact } from "../pdf/types";
import PlanSelection from "./PlanSelection";

type SavedEntry = { course: InstructorClass; plan: LessonPlan };

function PlanPrintPreview(
    { session, courses, week, combined }: {
        session: InstructorSession;
        courses: InstructorClass[];
        week: string;
        combined: boolean;
    },
) {
    const [entries, setEntries] = useState<SavedEntry[]>([]);
    const [artifact, setArtifact] = useState<PdfArtifact | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        let active = true;
        let objectUrl: string | null = null;
        setEntries([]);
        setArtifact(null);
        setPreviewUrl(null);
        setLoading(true);
        setError("");

        async function loadPreview() {
            try {
                const results = await Promise.all(courses.map(async (course) => ({
                    course,
                    plan: (await fetchLessonPlan(session.id, course.id, week)).plan,
                })));
                if (!active) return;
                const saved = results.filter((entry): entry is SavedEntry =>
                    entry.plan !== null
                );
                setEntries(saved);
                if (!saved.length) return;

                const { generateCombinedLessonPlanPdf, generateLessonPlanPdf } =
                    await import("../pdf/lessonPlan/generateLessonPlanPdf");
                const pdf = combined
                    ? await generateCombinedLessonPlanPdf(session, saved)
                    : await generateLessonPlanPdf(
                        session,
                        saved[0].course,
                        saved[0].plan,
                    );
                if (!active) return;
                objectUrl = URL.createObjectURL(pdf.blob);
                setArtifact(pdf);
                setPreviewUrl(objectUrl);
            } catch (e) {
                if (active) {
                    setError(e instanceof Error
                        ? e.message
                        : "Unable to load the lesson plan preview.");
                }
            } finally {
                if (active) setLoading(false);
            }
        }
        void loadPreview();
        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [session, courses, week, combined, retry]);

    function printPdf() {
        if (!artifact) return;
        const target = openPrintWindow(artifact.title);
        if (!target) {
            setError("Allow popups to print your lesson plan.");
            return;
        }
        if (!openPdfPrintDialog(artifact.blob, target, artifact)) {
            target.close();
            setError("Unable to print the lesson plan PDF.");
        }
    }

    const missing = courses.length - entries.length;
    return (
        <div className="flex min-w-0 flex-col gap-4">
            {error && (
                <Notice tone="danger" role="alert">
                    {error}{" "}
                    <ActionButton onClick={() => setRetry((value) => value + 1)}>
                        Retry
                    </ActionButton>
                </Notice>
            )}
            {artifact && !error && (
                <ActionButton variant="primary" fullWidth onClick={printPdf}>
                    Print PDF
                </ActionButton>
            )}
            <section className="min-w-0 rounded-2xl border-2 border-secondary p-3">
                <div className="flex items-center justify-between gap-3 px-1 pb-3">
                    <h3 className="text-sm font-semibold">Live Preview</h3>
                    {loading && (
                        <span className="text-xs font-semibold text-secondary/70">
                            Refreshing...
                        </span>
                    )}
                </div>
                <div className="h-[min(70vh,52rem)] min-h-80 overflow-hidden rounded-2xl border border-secondary/20 bg-bg">
                    {previewUrl && !error
                        ? (
                            <iframe
                                title="Lesson plan PDF preview"
                                className="h-full w-full bg-white"
                                src={previewUrl}
                            />
                        )
                        : (
                            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-secondary/80">
                                {loading
                                    ? "Loading preview..."
                                    : error
                                    ? "Unable to load the preview."
                                    : combined
                                    ? "No saved lesson plans for this week."
                                    : "No saved lesson plan for this week. Printing creates no plan."}
                            </div>
                        )}
                </div>
            </section>
        </div>
    );
}

export function SavedPlanPrint(
    { session, course, week }: {
        session: InstructorSession;
        course: InstructorClass;
        week: string;
    },
) {
    const courses = useMemo(() => [course], [course]);
    return (
        <PlanPrintPreview
            session={session}
            courses={courses}
            week={week}
            combined={false}
        />
    );
}

function CombinedPlansPrint(
    { session, courses, week }: {
        session: InstructorSession;
        courses: InstructorClass[];
        week: string;
    },
) {
    return (
        <PlanPrintPreview
            session={session}
            courses={courses}
            week={week}
            combined
        />
    );
}

export default function PrintPlans() {
    const [printMode, setPrintMode] = useState<"separate" | "together">("separate");
    return (
        <PlanSelection
            title="Print"
            printMode={printMode}
            onPrintModeChange={setPrintMode}
            renderTogether={(session, classes, week) => (
                <CombinedPlansPrint
                    key={`${session.id}:${week}`}
                    session={session}
                    courses={classes}
                    week={week}
                />
            )}
        >
            {(session, course, week) => (
                <SavedPlanPrint
                    key={`${session.id}:${course.id}:${week}`}
                    session={session}
                    course={course}
                    week={week}
                />
            )}
        </PlanSelection>
    );
}
