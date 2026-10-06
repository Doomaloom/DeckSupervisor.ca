import { ActionButton, EmptyState, Notice } from "../../general-components";
import { useEffect, useRef, useState } from "react";
import {
    fetchLessonPlan,
    type InstructorClass,
    type InstructorSession,
    type LessonPlan,
} from "../../lib/serverApi";
import {
    openPdfPreview,
    openPdfPrintDialog,
    openPrintWindow,
} from "../../lib/browserPrint";
import PlanSelection from "./PlanSelection";
export function SavedPlanPrint(
    { session, course, week }: {
        session: InstructorSession;
        course: InstructorClass;
        week: string;
    },
) {
    const [plan, setPlan] = useState<LessonPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    const active = useRef(true);
    useEffect(() => {
        active.current = true;
        let current = true;
        setLoading(true);
        setPlan(null);
        setError("");
        fetchLessonPlan(session.id, course.id, week).then((r) => {
            if (current) {
                setPlan(r.plan);
                setLoading(false);
            }
        }).catch((e) => {
            if (current) {
                setError(e.message);
                setLoading(false);
            }
        });
        return () => {
            current = false;
            active.current = false;
        };
    }, [session.id, course.id, week, retry]);
    async function showPdf(print: boolean) {
        const target = openPrintWindow("Weekly lesson plan");
        if (!target) {
            setError("Allow popups to preview or print your lesson plan.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            const saved = await fetchLessonPlan(session.id, course.id, week);
            if (!saved.plan) {
                throw new Error("No saved lesson plan for this week.");
            }
            const { generateLessonPlanPdf } = await import(
                "../pdf/lessonPlan/generateLessonPlanPdf"
            );
            const artifact = await generateLessonPlanPdf(
                session,
                course,
                saved.plan,
            );
            if (!active.current) {
                target.close();
                return;
            }
            const shown = print
                ? openPdfPrintDialog(artifact.blob, target, artifact)
                : openPdfPreview(artifact.blob, artifact, target);
            if (!shown) throw new Error("Unable to open PDF preview.");
        } catch (e) {
            target.close();
            if (active.current) {
                setError(e instanceof Error ? e.message : "Unable to print");
            }
        } finally {
            if (active.current) setBusy(false);
        }
    }
    return (
        <div className="flex flex-col gap-3">
            {loading && <p role="status">Loading saved lesson plan…</p>}
            {error && (
                <Notice tone="danger" role="alert">
                    {error}{" "}
                    <ActionButton onClick={() => setRetry((v) => v + 1)}>
                        Retry
                    </ActionButton>
                </Notice>
            )}
            {!loading && !error && !plan && (
                <EmptyState>
                    No saved lesson plan for this week. Printing creates no
                    plan.
                </EmptyState>
            )}
            {plan && (
                <>
                    <p>
                        Print uses the saved lesson plan. Save editor changes
                        before printing.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <ActionButton
                            disabled={busy}
                            onClick={() => void showPdf(false)}
                        >
                            Preview PDF
                        </ActionButton>
                        <ActionButton
                            disabled={busy}
                            variant="primary"
                            onClick={() => void showPdf(true)}
                        >
                            Print PDF
                        </ActionButton>
                    </div>
                </>
            )}
        </div>
    );
}

function CombinedPlansPrint(
    { session, courses, week }: {
        session: InstructorSession;
        courses: InstructorClass[];
        week: string;
    },
) {
    const [plans, setPlans] = useState<
        { course: InstructorClass; plan: LessonPlan }[]
    >([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    const active = useRef(true);
    useEffect(() => {
        active.current = true;
        let current = true;
        setLoading(true);
        setError("");
        Promise.all(courses.map(async (course) => ({
            course,
            plan: (await fetchLessonPlan(session.id, course.id, week)).plan,
        }))).then((results) => {
            if (current) {
                setPlans(results.filter((entry): entry is {
                    course: InstructorClass; plan: LessonPlan;
                } => entry.plan !== null));
                setLoading(false);
            }
        }).catch((e) => {
            if (current) {
                setError(e instanceof Error ? e.message : "Unable to load plans");
                setLoading(false);
            }
        });
        return () => {
            current = false;
            active.current = false;
        };
    }, [session.id, courses, week, retry]);

    async function showPdf(print: boolean) {
        const target = openPrintWindow("Weekly lesson plans");
        if (!target) {
            setError("Allow popups to preview or print your lesson plans.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            const results = await Promise.all(courses.map(async (course) => ({
                course,
                plan: (await fetchLessonPlan(session.id, course.id, week)).plan,
            })));
            const saved = results.filter((entry): entry is {
                course: InstructorClass; plan: LessonPlan;
            } => entry.plan !== null);
            if (!saved.length) throw new Error("No saved lesson plans for this week.");
            const { generateCombinedLessonPlanPdf } = await import(
                "../pdf/lessonPlan/generateLessonPlanPdf"
            );
            const artifact = await generateCombinedLessonPlanPdf(session, saved);
            if (!active.current) {
                target.close();
                return;
            }
            const shown = print
                ? openPdfPrintDialog(artifact.blob, target, artifact)
                : openPdfPreview(artifact.blob, artifact, target);
            if (!shown) throw new Error("Unable to open PDF preview.");
        } catch (e) {
            target.close();
            if (active.current) {
                setError(e instanceof Error ? e.message : "Unable to print");
            }
        } finally {
            if (active.current) setBusy(false);
        }
    }
    return (
        <div className="flex flex-col gap-3">
            {loading && <p role="status">Loading saved lesson plans…</p>}
            {error && (
                <Notice tone="danger" role="alert">
                    {error}{" "}
                    <ActionButton onClick={() => setRetry((v) => v + 1)}>
                        Retry
                    </ActionButton>
                </Notice>
            )}
            {!loading && !error && !plans.length && (
                <EmptyState>No saved lesson plans for this week.</EmptyState>
            )}
            {!loading && plans.length > 0 && (
                <>
                    <p>
                        Print {plans.length} saved {plans.length === 1 ? "class plan" : "class plans"} in one PDF.
                        {plans.length < courses.length && ` ${courses.length - plans.length} ${courses.length - plans.length === 1 ? "class has" : "classes have"} no saved plan and will be omitted.`}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <ActionButton disabled={busy} onClick={() => void showPdf(false)}>
                            Preview PDF
                        </ActionButton>
                        <ActionButton disabled={busy} variant="primary" onClick={() => void showPdf(true)}>
                            Print PDF
                        </ActionButton>
                    </div>
                </>
            )}
        </div>
    );
}
export default function PrintPlans() {
    const [printMode, setPrintMode] = useState<"separate" | "together">("separate");
    return (
        <PlanSelection
            title="Print"
            printMode={printMode}
            onPrintModeChange={setPrintMode}
            renderTogether={(s, classes, w) => (
                <CombinedPlansPrint
                    key={`${s.id}:${w}`}
                    session={s}
                    courses={classes}
                    week={w}
                />
            )}
        >
            {(s, c, w) => (
                <SavedPlanPrint
                    key={`${s.id}:${c.id}:${w}`}
                    session={s}
                    course={c}
                    week={w}
                />
            )}
        </PlanSelection>
    );
}
