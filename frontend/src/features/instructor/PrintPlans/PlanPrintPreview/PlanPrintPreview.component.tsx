import { ActionButton, Notice } from "../../../../general-components";
import { type InstructorClass, type InstructorSession } from "../../../../lib/serverApi";
import { usePlanPrintPreviewLogic } from "./PlanPrintPreview.logic";

export function PlanPrintPreview(props: {
    session: InstructorSession;
    courses: InstructorClass[];
    week: string;
    combined: boolean;
}) {
    const viewModel = usePlanPrintPreviewLogic(props);
    const {
        error,
        setRetry,
        artifact,
        printPdf,
        loading,
        previewUrl,
        combined,
    } = viewModel;
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
            <section className="min-w-0 rounded-2xl border border-secondary/20 bg-accent p-4 text-secondary shadow-sm">
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
