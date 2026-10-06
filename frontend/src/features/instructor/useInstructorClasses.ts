import { formatSessionDisplayName } from "../../shared/session/sessionLabels";
import type { InstructorSession } from "../../lib/serverApi";
import { useInstructorSession } from "./InstructorSessionContext";

export function sessionLabel(s: InstructorSession) {
    return formatSessionDisplayName({
        sessionDay: s.session_day,
        sessionSeason: s.session_season,
        sessionYear: s.session_year,
        startDate: s.start_date,
        sessionStartTime24: s.session_start_time24,
        sessionEndTime24: s.session_end_time24,
    });
}
export default function useInstructorClasses() {
    return useInstructorSession();
}
