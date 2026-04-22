import SourceLocationsInput from '../../../components/SourceLocationsInput'
import { MANUAL_SESSION_DAY_OPTIONS } from '../../../shared/session/sessionDays'
import type { TeamRecord } from '../../../app/useCurrentTeam'
import { NO_TEAM_VALUE } from '../types'

type SessionFormFieldsProps = {
    seasonOptions: string[]
    sessionDay: string
    sessionSeason: string
    sessionYear: string
    startDate: string
    endDate: string
    sessionStartTime24: string
    sessionEndTime24: string
    location: string
    sourceLocations: string[]
    sourceLocationOptions?: string[]
    availableLocations: string[]
    rosterFileLabel: string
    timeMessage?: string
    isInspectingRosterFile?: boolean
    teamId?: string
    teams?: TeamRecord[]
    teamsLoading?: boolean
    showTeamSelect?: boolean
    disabled?: boolean
    locationListId: string
    sourceLocationsInputId: string
    onSessionDayChange: (value: string) => void
    onSessionSeasonChange: (value: string) => void
    onSessionYearChange: (value: string) => void
    onStartDateChange: (value: string) => void
    onEndDateChange: (value: string) => void
    onSessionStartTimeChange: (value: string) => void
    onSessionEndTimeChange: (value: string) => void
    onTeamIdChange?: (value: string) => void
    onLocationChange: (value: string) => void
    onSourceLocationsChange: (value: string[]) => void
    onRosterFileChange: (file: File | null) => void
}

function SessionFormFields({
    seasonOptions,
    sessionDay,
    sessionSeason,
    sessionYear,
    startDate,
    endDate,
    sessionStartTime24,
    sessionEndTime24,
    location,
    sourceLocations,
    sourceLocationOptions = [],
    availableLocations,
    timeMessage = '',
    isInspectingRosterFile = false,
    teamId = '',
    teams = [],
    teamsLoading = false,
    showTeamSelect = false,
    disabled = false,
    locationListId,
    sourceLocationsInputId,
    onSessionDayChange,
    onSessionSeasonChange,
    onSessionYearChange,
    onStartDateChange,
    onEndDateChange,
    onSessionStartTimeChange,
    onSessionEndTimeChange,
    onTeamIdChange,
    onLocationChange,
    onSourceLocationsChange,
}: SessionFormFieldsProps) {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 font-semibold text-secondary">
                Session Day
                <select
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    value={sessionDay}
                    onChange={event => onSessionDayChange(event.target.value)}
                    disabled={disabled}
                >
                    <option value="">Select a day</option>
                    {MANUAL_SESSION_DAY_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </label>
            <label className="flex flex-col gap-2 font-semibold text-secondary">
                Session Season
                <select
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    value={sessionSeason}
                    onChange={event => onSessionSeasonChange(event.target.value)}
                    disabled={disabled}
                >
                    <option value="">Select a season</option>
                    {seasonOptions.map(season => (
                        <option key={season} value={season}>
                            {season}
                        </option>
                    ))}
                </select>
            </label>
            <label className="flex flex-col gap-2 font-semibold text-secondary">
                Session Year
                <input
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    type="number"
                    min={2000}
                    max={2100}
                    value={sessionYear}
                    onChange={event => onSessionYearChange(event.target.value)}
                    placeholder="e.g. 2026"
                    disabled={disabled}
                />
            </label>
            <label className="flex flex-col gap-2 font-semibold text-secondary">
                Start Date
                <input
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    type="date"
                    value={startDate}
                    onChange={event => onStartDateChange(event.target.value)}
                    disabled={disabled}
                />
            </label>
            <label className="flex flex-col gap-2 font-semibold text-secondary">
                End Date
                <input
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    type="date"
                    value={endDate}
                    onChange={event => onEndDateChange(event.target.value)}
                    disabled={disabled}
                />
            </label>
            <label className="flex flex-col gap-2 font-semibold text-secondary">
                Session Start Time
                <input
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    type="time"
                    value={sessionStartTime24}
                    onChange={event => onSessionStartTimeChange(event.target.value)}
                    disabled={disabled}
                />
            </label>
            <label className="flex flex-col gap-2 font-semibold text-secondary">
                Session End Time
                <input
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    type="time"
                    value={sessionEndTime24}
                    onChange={event => onSessionEndTimeChange(event.target.value)}
                    disabled={disabled}
                />
            </label>
            {showTeamSelect ? (
                <label className="flex flex-col gap-2 font-semibold text-secondary">
                    Team
                    <select
                        className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                        value={teamId}
                        onChange={event => onTeamIdChange?.(event.target.value)}
                        disabled={disabled || teamsLoading}
                    >
                        <option value="">Select a team</option>
                        <option value={NO_TEAM_VALUE}>No team</option>
                        {teams.map(team => (
                            <option key={team.id} value={team.id}>
                                {team.name}
                            </option>
                        ))}
                    </select>
                </label>
            ) : null}
            <label className="flex flex-col gap-2 font-semibold text-secondary">
                Display Location
                <input
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    type="text"
                    value={location}
                    onChange={event => onLocationChange(event.target.value)}
                    list={availableLocations.length > 0 ? locationListId : undefined}
                    placeholder="Shown across the app"
                    disabled={disabled}
                />
                {availableLocations.length > 0 ? (
                    <datalist id={locationListId}>
                        {availableLocations.map(option => (
                            <option key={option} value={option} />
                        ))}
                    </datalist>
                ) : null}
            </label>
            <SourceLocationsInput
                values={sourceLocations}
                options={sourceLocationOptions}
                helperText="These raw CSV locations will be treated as one session."
                onChange={onSourceLocationsChange}
            />
            {availableLocations.length > 0 ? (
                <span className="text-xs font-medium text-secondary/70">
                    Team locations are suggestions only. The display location and raw locations are saved independently.
                </span>
            ) : null}
            {isInspectingRosterFile ? (
                <p className="text-sm font-medium text-secondary/70">
                    Inspecting roster CSV for session times...
                </p>
            ) : null}
            {timeMessage ? <p className="text-sm font-medium text-secondary/70">{timeMessage}</p> : null}
        </div>
    )
}

export default SessionFormFields
