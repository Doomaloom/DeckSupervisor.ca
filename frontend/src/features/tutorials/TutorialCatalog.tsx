import { tutorialRegistry } from './tutorialRegistry'
import { getRecommendedTutorialIds, routeToTutorialId } from './tutorialRoutes'
import type { TutorialCatalogMode, TutorialId } from './types'

type TutorialCatalogProps = {
  mode: TutorialCatalogMode
  pathname: string
  onOpenTutorial: (tutorialId: TutorialId) => void
}

function TutorialCatalog({ mode, pathname, onOpenTutorial }: TutorialCatalogProps) {
  const activeRouteTutorialId = routeToTutorialId(pathname)
  const recommendedIds = getRecommendedTutorialIds(pathname)
  const tutorials = Object.values(tutorialRegistry)
    .filter(tutorial => tutorial.visibleInCatalog !== false)
    .sort((left, right) => {
      if (left.id === 'prep-workflow') {
        return -1
      }
      if (right.id === 'prep-workflow') {
        return 1
      }
      return left.title.localeCompare(right.title)
    })

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-secondary/15 bg-bg p-5 text-sm text-secondary">
        <p className="font-semibold text-secondary">
          {mode === 'catalog'
            ? 'Browse the tutorial library.'
            : activeRouteTutorialId
              ? 'This page has a matching tutorial.'
              : 'No exact tutorial exists for this page yet.'}
        </p>
        <p className="mt-2 text-secondary/75">
          {mode === 'catalog'
            ? 'Open any workflow tutorial from here.'
            : activeRouteTutorialId
              ? 'Use the matching tutorial below, or open a related workflow if you need surrounding context.'
              : `Current page: ${pathname}. Start with one of the recommended part-time workflow tutorials below.`}
        </p>
      </div>

      {recommendedIds.length > 0 ? (
        <section>
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary/60">
            Recommended
          </h4>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
          {recommendedIds.map(tutorialId => {
            const tutorial = tutorialRegistry[tutorialId]
            if (!tutorial || tutorial.visibleInCatalog === false) {
              return null
            }
            return (
              <button
                key={`recommended-${tutorialId}`}
                  type="button"
                  className="rounded-2xl border border-secondary/20 bg-accent p-4 text-left transition hover:-translate-y-0.5 hover:border-secondary"
                  onClick={() => onOpenTutorial(tutorialId)}
                >
                  <p className="text-sm font-semibold text-secondary">{tutorial.title}</p>
                  <p className="mt-1 text-sm text-secondary/70">{tutorial.shortDescription}</p>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      <section>
        <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary/60">
          All Tutorials
        </h4>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tutorials.map(tutorial => {
            const isHighlighted = tutorial.id === activeRouteTutorialId
            return (
              <button
                key={tutorial.id}
                type="button"
                className={`rounded-[1.75rem] border p-5 text-left transition hover:-translate-y-0.5 hover:border-secondary ${
                  isHighlighted
                    ? 'border-secondary bg-secondary text-accent'
                    : 'border-secondary/15 bg-bg text-secondary'
                }`}
                onClick={() => onOpenTutorial(tutorial.id)}
              >
                <p className="text-base font-semibold">{tutorial.title}</p>
                <p className={`mt-2 text-sm ${isHighlighted ? 'text-accent/80' : 'text-secondary/70'}`}>
                  {tutorial.shortDescription}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {tutorial.keywords.slice(0, 3).map(keyword => (
                    <span
                      key={`${tutorial.id}-${keyword}`}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        isHighlighted
                          ? 'border border-white/20 bg-white/10 text-accent'
                          : 'border border-secondary/15 bg-accent text-secondary/70'
                      }`}
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export default TutorialCatalog
