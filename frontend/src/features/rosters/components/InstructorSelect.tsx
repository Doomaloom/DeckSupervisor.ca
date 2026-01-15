import React from 'react'
import { selectClass } from '../constants'

type InstructorSelectProps = {
    value: string
    options: string[]
    placeholder?: string
    optionKeyPrefix?: string
    onChange: (value: string) => void
}

function InstructorSelect({
    value,
    options,
    placeholder = 'Select Instructor',
    optionKeyPrefix,
    onChange,
}: InstructorSelectProps) {
    return (
        <select className={selectClass} value={value} onChange={event => onChange(event.target.value)}>
            <option value="">{placeholder}</option>
            {options.map(instructor => (
                <option key={`${optionKeyPrefix ?? 'instructor'}-${instructor}`} value={instructor}>
                    {instructor}
                </option>
            ))}
        </select>
    )
}

export default InstructorSelect
