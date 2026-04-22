import type { TeamRecord } from '../../../app/useCurrentTeam'
import InstructorListEditor from './InstructorListEditor'
import SessionFormFields from './SessionFormFields'

type NewSessionPanelProps = {
  form: {
    seasonOptions: string[]
    sessionDay: string
    sessionSeason: string
    sessionYear: string
    startDate: string
    endDate: string
    sessionStartTime24: string
    sessionEndTime24: string
    newSessionTimeMessage: string
    isInspectingRosterFile: boolean
    instructors: Array<{ name: string }>
    saveMessage: string
    rosterFile: File | null
    selectedTeamId: string
    availableLocations: string[]
    location: string
    sourceLocations: string[]
    sourceLocationOptions: string[]
    setSessionDay: (value: string) => void
    setSessionSeason: (value: string) => void
    setSessionYear: (value: string) => void
    setStartDate: (value: string) => void
    setEndDate: (value: string) => void
    setSelectedTeamId: (value: string) => void
    setLocation: (value: string) => void
    setSourceLocations: (values: string[]) => void
    handleRosterFileChange: (file: File | null) => void
    handleSaveSession: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
    addInstructor: () => void
    updateInstructor: (index: number, value: string) => void
    setSessionStartTime24: (value: string) => void
    setSessionEndTime24: (value: string) => void
  }
  isGuest: boolean
  teams: TeamRecord[]
}

function NewSessionPanel({ form, isGuest, teams }: NewSessionPanelProps) {
  return (
    <div className="w-full max-w-5xl">
      <h2 className="text-2xl font-semibold text-secondary">Start New Session</h2>
      <form className="mt-6 flex flex-col gap-6" onSubmit={form.handleSaveSession}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-card border-2 border-secondary/20 bg-accent p-6 shadow-md">
            <h3 className="text-base font-semibold text-secondary">Session Dates</h3>
            <SessionFormFields
              seasonOptions={form.seasonOptions}
              sessionDay={form.sessionDay}
              sessionSeason={form.sessionSeason}
              sessionYear={form.sessionYear}
              startDate={form.startDate}
              endDate={form.endDate}
              sessionStartTime24={form.sessionStartTime24}
              sessionEndTime24={form.sessionEndTime24}
              timeMessage={form.newSessionTimeMessage}
              isInspectingRosterFile={form.isInspectingRosterFile}
              teamId={form.selectedTeamId}
              teams={teams}
              showTeamSelect={!isGuest}
              location={form.location}
              sourceLocations={form.sourceLocations}
              sourceLocationOptions={form.sourceLocationOptions}
              availableLocations={form.availableLocations}
              rosterFileLabel={form.rosterFile ? form.rosterFile.name : 'Click or drop a .csv file'}
              locationListId="dashboard-session-location-options"
              sourceLocationsInputId="dashboard-source-location-options"
              onSessionDayChange={form.setSessionDay}
              onSessionSeasonChange={form.setSessionSeason}
              onSessionYearChange={form.setSessionYear}
              onStartDateChange={form.setStartDate}
              onEndDateChange={form.setEndDate}
              onSessionStartTimeChange={form.setSessionStartTime24}
              onSessionEndTimeChange={form.setSessionEndTime24}
              onTeamIdChange={form.setSelectedTeamId}
              onLocationChange={form.setLocation}
              onSourceLocationsChange={form.setSourceLocations}
              onRosterFileChange={form.handleRosterFileChange}
            />
          </div>
          <div className="flex flex-col gap-4 rounded-card border-2 border-secondary/20 bg-accent p-6 shadow-md">
            <h3 className="text-base font-semibold text-secondary">Instructors on Shift</h3>
            <InstructorListEditor
              instructors={form.instructors}
              onAddInstructor={form.addInstructor}
              onUpdateInstructor={form.updateInstructor}
            />
          </div>
        </div>
        <div className="flex items-center justify-center gap-4">
          <button
            type="submit"
            className="rounded-2xl bg-primary px-6 py-3 text-white transition hover:-translate-y-0.5 hover:bg-secondary"
          >
            Save Session
          </button>
          {form.saveMessage ? <span className="font-semibold text-secondary">{form.saveMessage}</span> : null}
        </div>
      </form>
    </div>
  )
}

export default NewSessionPanel
