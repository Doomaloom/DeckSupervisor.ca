import { useEffect, useState } from "react";
import { openPdfPrintDialog, openPrintWindow } from "../../../../lib/browserPrint";
import { fetchLessonPlan, type InstructorClass, type InstructorSession } from "../../../../lib/serverApi";
import type { PdfArtifact } from "../../../../shared/pdf/types";
import { SavedEntry } from "../PrintPlans.logic";
export function usePlanPrintPreviewLogic({ session, courses, week, combined, marking = false }: {
    session: InstructorSession;
    courses: InstructorClass[];
    week: string;
    combined: boolean;
    marking?: boolean;
}) {
    const [artifact, setArtifact] = useState<PdfArtifact | null>(null);
    const [markingDocument, setMarkingDocument] = useState<Document | null>(null);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        let active = true;
        let objectUrl: string | null = null;
        setArtifact(null);
        setMarkingDocument(null);
        setPreviewHtml(null);
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
                if (!saved.length) return;

                if (marking) {
                    const { buildCombinedSkillMarkingDocument } = await import(
                        "../../../../shared/attendance-print/buildSkillMarkingDocument"
                    );
                    const { loadMarkingStudents } = await import("../loadMarkingStudents");
                    const prepared = buildCombinedSkillMarkingDocument(session, saved.map((entry) => ({
                        ...entry, students: loadMarkingStudents(session, entry.course),
                    })));
                    if (!active) return;
                    setMarkingDocument(prepared);
                    setPreviewHtml(`<!doctype html>${prepared.documentElement.outerHTML}`);
                    return;
                }
                const { generateCombinedLessonPlanPdf, generateLessonPlanPdf } =
                    await import("../../../../shared/pdf/lessonPlan/generateLessonPlanPdf");
                const pdf = combined
                    ? await generateCombinedLessonPlanPdf(session, saved)
                    : await generateLessonPlanPdf(session, saved[0].course, saved[0].plan);
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
    }, [session.id, courses, week, combined, marking, retry]);

    async function printPdf() {
        if (markingDocument) {
            const target = openPrintWindow(markingDocument.title);
            if (!target) {
                setError("Allow popups to print your PDF.");
                return;
            }
            try {
                const { printPreparedAttendanceDocument } = await import(
                    "../../../../shared/attendance-print/printAttendanceHtml"
                );
                await printPreparedAttendanceDocument(markingDocument, target);
            } catch (cause) {
                target.close();
                setError(cause instanceof Error ? cause.message : "Unable to print the marking sheet.");
            }
            return;
        }
        if (!artifact) return;
        const target = openPrintWindow(artifact.title);
        if (!target) {
            setError("Allow popups to print your PDF.");
            return;
        }
        if (!openPdfPrintDialog(artifact.blob, target, artifact)) {
            target.close();
            setError("Unable to print the PDF.");
        }
    }

    return {
        view: "ready" as const,
        error,
        setRetry,
        canPrint: Boolean(artifact || markingDocument),
        previewHtml,
        printPdf,
        loading,
        previewUrl,
        combined,
    };

}

