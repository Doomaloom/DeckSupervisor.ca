import type { InstructorSession } from "../../lib/serverApi";
import { formatSessionDisplayName } from "./sessionLabels";

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
