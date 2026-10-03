import {renderPdfArtifact} from '../renderPdf'
import {LessonPlanDocument} from './LessonPlanDocument'
import type {InstructorClass,InstructorSession,LessonPlan} from '../../../lib/serverApi'
export function generateLessonPlanPdf(session: InstructorSession,course: InstructorClass,plan: LessonPlan) {
 return renderPdfArtifact(<LessonPlanDocument session={session} course={course} plan={plan}/>,{title:'Weekly lesson plan',filename:`lesson-plan-${course.id}-${plan.week}.pdf`})
}
