import { PageShell, Card } from '../../general-components'
export default function InstructorPlaceholder({title}: {title: string}) {
 return <PageShell><Card className="flex flex-col gap-4"><h2 className="text-2xl font-semibold">{title}</h2><p role="status">{title === 'Attendance' ? 'Attendance is coming later. Attendance editing is not available yet.' : 'No linked classes yet. Ask your supervisor to link your staff account to a saved schematic column.'}</p></Card></PageShell>
}
