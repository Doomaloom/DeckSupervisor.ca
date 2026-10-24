import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import PrintPlans from "./PrintPlans.component";
const fixtures = vi.hoisted(() => {
    const session = { id: "s", session_day: "Mo", weeks: ["2026-10-05", "2026-10-12"] };
    const course = { id: "c", level: "Splash 1", code: "A", instructor: "Alex", start_time: "09:00", end_time: "09:30" };
    const second = { ...course, id: "c2", code: "B" };
    const plan = { week: "2026-10-12", rows: [{ skill: "Floating" }] };
    const artifact = { blob: new Blob(["pdf"]), title: "Marking", filename: "marking.pdf" };
    return { session, course, second, classes: [course, second], plan, artifact, fetch: vi.fn(), combined: vi.fn(), marking: vi.fn(), separate: vi.fn(), together: vi.fn(), print: vi.fn(), open: vi.fn() };
});
vi.mock("./loadMarkingStudents", () => ({ loadMarkingStudents: () => [] }));
vi.mock("../../../lib/serverApi", () => ({ fetchLessonPlan: fixtures.fetch }));
vi.mock("../session/useInstructorClasses", () => ({ default: () => ({ session: fixtures.session, sessionId: "s", classes: fixtures.classes, loading: false }) }));
vi.mock("../../../shared/attendance-print/buildLessonPlanMarkingDocument", () => ({ buildLessonPlanMarkingDocument: fixtures.combined }));
vi.mock("../../../shared/attendance-print/buildSkillMarkingDocument", () => ({ buildCombinedSkillMarkingDocument: fixtures.marking }));
vi.mock("../../../shared/pdf/lessonPlan/generateLessonPlanPdf", () => ({ generateLessonPlanPdf: fixtures.separate, generateCombinedLessonPlanPdf: fixtures.together }));
vi.mock("../../../shared/attendance-print/printAttendanceHtml", () => ({ printPreparedAttendanceDocument: fixtures.print }));
vi.mock("../../../lib/browserPrint", () => ({ openPrintWindow: fixtures.open, openPdfPrintDialog: fixtures.print }));
beforeEach(() => {
    vi.clearAllMocks();
    fixtures.fetch.mockResolvedValue({ plan: fixtures.plan });
    fixtures.combined.mockImplementation(() => new DOMParser().parseFromString("<html><head><title>Combined</title></head><body>Plans and marking sheets</body></html>", "text/html"));
    fixtures.marking.mockImplementation(() => new DOMParser().parseFromString("<html><head><title>Marking</title></head><body>Marking sheet</body></html>", "text/html"));
    fixtures.separate.mockResolvedValue(fixtures.artifact);
    fixtures.together.mockResolvedValue(fixtures.artifact);
    fixtures.open.mockReturnValue({ close: vi.fn() });
    fixtures.print.mockReturnValue(true);
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
});
it("defaults to Combined for all classes and keeps Together and Marking", async () => {
    render(<MemoryRouter><PrintPlans /></MemoryRouter>);
    expect(await screen.findByTitle("Combined lesson plans and marking sheets preview")).toBeVisible();
    expect(fixtures.combined).toHaveBeenCalledWith(fixtures.session, [{ course: fixtures.course, plan: fixtures.plan, students: [] }, { course: fixtures.second, plan: fixtures.plan, students: [] }]);
    expect(screen.queryByRole("group", { name: "Class" })).not.toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Print classes" });
    expect(Array.from(group.querySelectorAll("button")).map((button) => button.textContent)).toEqual(["Combined", "Together", "Marking"]);
    fireEvent.click(screen.getByRole("button", { name: "Marking" }));
    await waitFor(() => expect(fixtures.marking).toHaveBeenCalledWith(fixtures.session, [{ course: fixtures.course, plan: fixtures.plan, students: [] }, { course: fixtures.second, plan: fixtures.plan, students: [] }]));
    expect(await screen.findByTitle("Skill marking sheet preview")).toBeVisible();
    expect(screen.queryByRole("group", { name: "Class" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marking" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Print PDF" }));
    await waitFor(() => expect(fixtures.print).toHaveBeenCalledTimes(1));
    expect(fixtures.print.mock.calls[0][0].title).toBe("Marking");
    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    await waitFor(() => expect(fixtures.fetch).toHaveBeenCalledWith("s", "c", "2026-10-05"));
    fireEvent.click(screen.getByRole("button", { name: "Together" }));
    await waitFor(() => expect(fixtures.together).toHaveBeenCalled());
});
it("does not create a marking PDF or offer printing when the week has no saved plan", async () => {
    fixtures.fetch.mockResolvedValue({ plan: null });
    render(<MemoryRouter><PrintPlans /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Marking" }));
    expect(await screen.findByText(/No saved lesson plans for this week/)).toBeVisible();
    expect(fixtures.marking).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Print PDF" })).not.toBeInTheDocument();
});

it("shows rendering errors and retries the marking preview", async () => {
    fixtures.marking.mockImplementationOnce(() => { throw new Error("Marking render failed"); });
    render(<MemoryRouter><PrintPlans /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Marking" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Marking render failed");
    expect(screen.queryByRole("button", { name: "Print PDF" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByTitle("Skill marking sheet preview")).toBeVisible();
    expect(fixtures.marking).toHaveBeenCalledTimes(2);
});

it("includes saved classes and skips classes without a plan when marking together", async () => {
    fixtures.fetch.mockImplementation((_session, classId) => Promise.resolve({ plan: classId === "c" ? fixtures.plan : null }));
    render(<MemoryRouter><PrintPlans /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Marking" }));
    await waitFor(() => expect(fixtures.marking).toHaveBeenCalledWith(fixtures.session, [{ course: fixtures.course, plan: fixtures.plan, students: [] }]));
    expect(screen.queryByRole("group", { name: "Class" })).not.toBeInTheDocument();
});


it("prints the combined document in one print job", async () => {
    render(<MemoryRouter><PrintPlans /></MemoryRouter>);
    await screen.findByTitle("Combined lesson plans and marking sheets preview");
    fireEvent.click(screen.getByRole("button", { name: "Print PDF" }));
    await waitFor(() => expect(fixtures.print).toHaveBeenCalledTimes(1));
    expect(fixtures.print.mock.calls[0][0].title).toBe("Combined");
});

it("skips missing plans in Combined and allows retry after rendering fails", async () => {
    fixtures.fetch.mockImplementation((_session, classId) => Promise.resolve({ plan: classId === "c" ? fixtures.plan : null }));
    fixtures.combined.mockImplementationOnce(() => { throw new Error("Combined render failed"); });
    render(<MemoryRouter><PrintPlans /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Combined render failed");
    expect(screen.queryByRole("button", { name: "Print PDF" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByTitle("Combined lesson plans and marking sheets preview");
    expect(fixtures.combined).toHaveBeenLastCalledWith(fixtures.session, [{ course: fixtures.course, plan: fixtures.plan, students: [] }]);
});

it("offers no Combined print job when every plan is missing", async () => {
    fixtures.fetch.mockResolvedValue({ plan: null });
    render(<MemoryRouter><PrintPlans /></MemoryRouter>);
    expect(await screen.findByText(/No saved lesson plans for this week/)).toBeVisible();
    expect(fixtures.combined).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Print PDF" })).not.toBeInTheDocument();
});
