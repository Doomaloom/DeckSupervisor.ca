import type { InstructorSession } from '../../lib/serverApi'
import { useInstructorSession } from './InstructorSessionContext'

export function sessionLabel(s: InstructorSession) {
 return [s.session_day,s.session_season,s.session_year,s.location,s.start_date,s.end_date].filter(Boolean).join(' · ')
}
export default function useInstructorClasses() {
 return useInstructorSession()
}
