import {
    CalendarDaysIcon,
    ClipboardDocumentListIcon,
    FolderIcon,
    UsersIcon,
} from '@heroicons/react/24/outline'
import type { PrintOption } from './types'

export const printOptions: PrintOption[] = [
    {
        key: 'day1',
        title: 'Day 1 Print',
        description: 'Generate attendance sheets for the first day of the session.',
        icon: FolderIcon,
    },
    {
        key: 'instructors',
        title: 'Print Instructor Sheets',
        description: 'Create instructor-ready packets grouped by class or block.',
        icon: UsersIcon,
    },
    {
        key: 'masterlist',
        title: 'Print Masterlist',
        description: 'Build a formatted master list for front-desk or admin use.',
        icon: ClipboardDocumentListIcon,
    },
    {
        key: 'schematic',
        title: 'Print Schematic',
        description: 'Export the session schematic layout for quick reference.',
        icon: CalendarDaysIcon,
    },
]
