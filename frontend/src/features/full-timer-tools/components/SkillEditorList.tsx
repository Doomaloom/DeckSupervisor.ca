import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { AttendanceSheetSkill } from '../../../types/app'
import { createSkill, moveSkill } from '../utils/attendanceSheets'

type Props = {
    skills: AttendanceSheetSkill[]
    onChange: (skills: AttendanceSheetSkill[]) => void
}

function SkillEditorList({ skills, onChange }: Props) {
    const updateSkill = (index: number, patch: Partial<AttendanceSheetSkill>) => {
        onChange(skills.map((skill, skillIndex) => (skillIndex === index ? { ...skill, ...patch } : skill)))
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-secondary">Skills</h4>
                <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-3 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5"
                    onClick={() => onChange([...skills, createSkill(`Skill ${skills.length + 1}`)])}
                >
                    <PlusIcon className="h-4 w-4" />
                    Add Skill
                </button>
            </div>

            {skills.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-secondary/30 bg-bg px-4 py-3 text-sm text-secondary/70">
                    No skills yet. Add skills to create columns on the attendance sheet.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {skills.map((skill, index) => (
                        <div key={skill.id} className="rounded-2xl border border-secondary/20 bg-bg p-4">
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <label className="min-w-[220px] flex-1 text-sm font-semibold text-secondary">
                                        Skill Label
                                        <input
                                            className="mt-1 w-full rounded-2xl border-2 border-secondary/30 bg-accent px-3 py-2 text-sm text-secondary"
                                            value={skill.label}
                                            onChange={event => updateSkill(index, { label: event.target.value })}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        className="rounded-full border border-secondary/30 p-2 text-secondary transition hover:bg-accent disabled:opacity-40"
                                        title="Move skill up"
                                        disabled={index === 0}
                                        onClick={() => onChange(moveSkill(skills, index, -1))}
                                    >
                                        <ArrowUpIcon className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-full border border-secondary/30 p-2 text-secondary transition hover:bg-accent disabled:opacity-40"
                                        title="Move skill down"
                                        disabled={index === skills.length - 1}
                                        onClick={() => onChange(moveSkill(skills, index, 1))}
                                    >
                                        <ArrowDownIcon className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-full border border-red-300 p-2 text-red-700 transition hover:bg-red-50"
                                        title="Remove skill"
                                        onClick={() => onChange(skills.filter((_, skillIndex) => skillIndex !== index))}
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </div>
                                <label className="text-sm font-semibold text-secondary">
                                    Detail Lines
                                    <textarea
                                        className="mt-1 min-h-24 w-full rounded-2xl border-2 border-secondary/30 bg-accent px-3 py-2 text-sm text-secondary"
                                        value={skill.details.join('\n')}
                                        onChange={event =>
                                            updateSkill(index, {
                                                details: event.target.value.split('\n'),
                                            })
                                        }
                                    />
                                </label>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default SkillEditorList
