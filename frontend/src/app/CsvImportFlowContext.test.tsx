import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { applyLocalInstructorsToRosters } from "../lib/api";
import { loadSessions } from "../lib/sessionStorage";
import { getStudentsForDay, setInstructorsForDay } from "../lib/storage";
import { setStorageScope } from "../lib/storageScope";
import type { ClassRoster, CsvSessionCandidate } from "../types/app";
import { CsvImportFlowProvider } from "./CsvImportFlowContext";

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    fetchCsvAnalyze: vi.fn(),
    createSession: vi.fn(),
    trackUploadedRosters: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("./AuthContext", () => ({
    useAuth: () => ({ accountType: null, isGuest: true, user: null }),
}));
vi.mock("./DayContext", () => ({ useDay: () => ({ setSelectedDay: vi.fn() }) }));
vi.mock("./useCurrentTeam", () => ({ useCurrentTeam: () => ({ currentTeamId: "" }) }));
vi.mock("./useCurrentTerm", () => ({ useCurrentTerm: () => ({ currentTerm: null }) }));
vi.mock("../lib/serverApi", () => ({
    fetchCsvAnalyze: mocks.fetchCsvAnalyze,
    createSession: mocks.createSession,
    fetchSchematic: vi.fn(),
}));
vi.mock("../lib/rosterPrintUpdates", () => ({
    trackUploadedRosters: mocks.trackUploadedRosters,
}));
vi.mock("../components/CsvSessionImportModal", () => ({
    default: (props: {
        candidates: CsvSessionCandidate[];
        error: string;
        onSelectCandidate: (candidate: CsvSessionCandidate) => void;
    }) => (
        <div>
            {props.candidates.map((candidate) => (
                <button
                    key={candidate.sessionKey}
                    type="button"
                    onClick={() => props.onSelectCandidate(candidate)}
                >
                    import {candidate.sessionKey}
                </button>
            ))}
            <p role="status">{props.error}</p>
        </div>
    ),
}));

const candidate: CsvSessionCandidate = {
    sessionKey: "thu",
    sourceSessionKeys: ["thu-src"],
    rawLocations: ["Lakeside Demo Pool"],
    dayOfWeek: "Th",
    sessionSeason: "Fall",
    sessionYear: 2026,
    startDate: "2026-09-17",
    endDate: "2026-12-10",
    location: "Lakeside Demo Pool",
    sessionStartTime24: "15:30",
    sessionEndTime24: "16:00",
    classCount: 1,
    studentCount: 2,
    waitlistCount: 0,
    courseCodes: ["98001"],
    matchedSession: null,
};

const roster: ClassRoster = {
    sessionKey: "thu-src",
    code: "98001",
    serviceName: "Little Splash 1",
    day: "Th",
    time: "15:30-16:00",
    location: "Lakeside Demo Pool",
    schedule: "Th",
    instructor: "",
    students: [
        { name: "Avery Test", phone: "", instructor: "", level: "" },
        { name: "Blair Test", phone: "", instructor: "", level: "" },
    ],
};

function analyzeResponse(rosters: ClassRoster[]) {
    return {
        success: true,
        warnings: [],
        rosters,
        totalStudents: 2,
        extracted: { totalSessions: 1, totalClasses: 1, sessions: [], classesBySession: {} },
        candidates: [candidate],
        rostersByCandidateKey: { thu: rosters },
    };
}

async function uploadAndSelect() {
    const { container } = render(
        <CsvImportFlowProvider>
            <span />
        </CsvImportFlowProvider>,
    );
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, {
        target: { files: [new File(["csv"], "roster.csv", { type: "text/csv" })] },
    });
    fireEvent.click(await screen.findByRole("button", { name: "import thu" }));
}

beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    setStorageScope("guest");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("unexpected network call"))));
});

// Triage W4: guest import used /api/process-csv, which the backend no longer serves.
it("imports a signed-out roster from the analyzed CSV without another request", async () => {
    mocks.fetchCsvAnalyze.mockResolvedValue(analyzeResponse([roster]));
    setInstructorsForDay("Th", { names: ["Jordan"], codes: ["098001"] });

    await uploadAndSelect();

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/manage-sessions"));
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.trackUploadedRosters).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
    const sessions = loadSessions();
    expect(sessions).toHaveLength(1);
    expect(getStudentsForDay("Th", sessions[0].id).map((s) => [s.name, s.instructor])).toEqual([
        ["Avery Test", "Jordan"],
        ["Blair Test", "Jordan"],
    ]);
});

it("does not create a guest session when the selected candidate has no roster", async () => {
    mocks.fetchCsvAnalyze.mockResolvedValue(analyzeResponse([]));

    await uploadAndSelect();

    expect(await screen.findByRole("status")).toHaveTextContent("No roster data");
    expect(loadSessions()).toHaveLength(0);
    expect(mocks.navigate).not.toHaveBeenCalled();
});

it("maps local instructors by class code, ignoring leading zeros", () => {
    const [mapped] = applyLocalInstructorsToRosters([{ ...roster, code: "0098001" }], [
        { name: " Sam ", codes: "98001, 98002" },
        { name: "", codes: "98003" },
    ]);
    expect(mapped.instructor).toBe("Sam");
    expect(mapped.students.every((student) => student.instructor === "Sam")).toBe(true);
    expect(applyLocalInstructorsToRosters([roster], [])[0]).toBe(roster);
});
