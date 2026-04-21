import SessionListCard from './SessionListCard'
import type { DbSessionEntry, LocalSessionEntry, SharedSessionEntry } from '../types'
import { groupSessionListItemsByTerm } from '../utils/sessionCollections'

type SessionSelectionPanelProps = {
    isGuest: boolean
    sessions: Array<LocalSessionEntry | DbSessionEntry>
    sharedSessions: SharedSessionEntry[]
    currentSessionId: string
    selectMessage: string
    onSelectLocalSession: (session: LocalSessionEntry) => void
    onSelectDbSession: (session: DbSessionEntry) => void
    onOpenSharedSession: (entry: SharedSessionEntry) => void
}

function SessionSelectionPanel({
    isGuest,
    sessions,
    sharedSessions,
    currentSessionId,
    selectMessage,
    onSelectLocalSession,
    onSelectDbSession,
    onOpenSharedSession,
}: SessionSelectionPanelProps) {
    const scrollContainerClassName =
        'mt-3 min-w-0 overflow-hidden rounded-card border-2 border-secondary/20 bg-accent p-4 shadow-md'
    const gridClassName = 'grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2'
    const scrollAreaClassName =
        'min-h-[20rem] max-h-[calc(100vh-14rem)] overflow-y-auto overflow-x-hidden pr-1'
    const groupedSessions = groupSessionListItemsByTerm(
        sessions.map(session =>
            isGuest
                ? ({ kind: 'local', session: session as LocalSessionEntry } as const)
                : ({ kind: 'db', session: session as DbSessionEntry } as const),
        ),
    )

    return (
        <div className="w-full max-w-5xl min-w-0">
            <h2 className="text-2xl font-semibold text-secondary">Select Existing Session</h2>
            {!isGuest && sharedSessions.length > 0 ? (
                <div className="mt-4">
                    <h3 className="text-lg font-semibold text-secondary">Covering Today</h3>
                    <div className={scrollContainerClassName}>
                        <div className={scrollAreaClassName}>
                            <div className={gridClassName}>
                                {sharedSessions.map(entry => {
                                    const session = entry.sessions
                                    if (!session) {
                                        return null
                                    }
                                    return (
                                        <SessionListCard
                                            key={entry.id}
                                            item={{ kind: 'shared', entry, session }}
                                            onClick={() => onOpenSharedSession(entry)}
                                        />
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {sessions.length === 0 ? (
                <p className="mt-4 font-semibold text-secondary">No existing sessions.</p>
            ) : (
                <div className={scrollContainerClassName}>
                    <div className={scrollAreaClassName}>
                        <div className="flex min-w-0 flex-col gap-6">
                            {groupedSessions.map(group => (
                                <section key={group.key} className="min-w-0">
                                    <h3 className="mb-3 text-lg font-semibold text-secondary">{group.label}</h3>
                                    <div className={gridClassName}>
                                        {group.items.map(item =>
                                            item.kind === 'local' ? (
                                                <SessionListCard
                                                    key={item.session.id}
                                                    item={item}
                                                    isCurrent={currentSessionId === item.session.id}
                                                    onClick={() => onSelectLocalSession(item.session)}
                                                />
                                            ) : (
                                                <SessionListCard
                                                    key={item.session.id}
                                                    item={item}
                                                    isCurrent={currentSessionId === item.session.id}
                                                    onClick={() => onSelectDbSession(item.session)}
                                                />
                                            ),
                                        )}
                                    </div>
                                </section>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {selectMessage ? <p className="mt-4 font-semibold text-secondary">{selectMessage}</p> : null}
        </div>
    )
}

export default SessionSelectionPanel
