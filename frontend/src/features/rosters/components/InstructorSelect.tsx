import React from 'react'
import { selectClass } from '../constants'

type InstructorSelectProps = {
    value: string
    options: string[]
    placeholder?: string
    optionKeyPrefix?: string
    disabled?: boolean
    onChange: (value: string) => void
}

function InstructorSelect({
    value,
    options,
    placeholder = 'Select Instructor',
    optionKeyPrefix,
    disabled = false,
    onChange,
}: InstructorSelectProps) {
    return (
        <select
            className={selectClass}
            value={value}
            onChange={event => onChange(event.target.value)}
            disabled={disabled}
        >
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
