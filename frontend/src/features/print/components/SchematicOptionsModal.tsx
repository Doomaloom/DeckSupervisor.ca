import React from 'react'
import PrintModalShell from './PrintModalShell'
import SchematicScaleControl from './SchematicScaleControl'

type SchematicOptions = {
  highlightInstructor: boolean
  selectedInstructor: string
  orientation: 'portrait' | 'landscape'
}

type SchematicOptionsModalProps = {
  open: boolean
  options: SchematicOptions
  instructorNames: string[]
  scalePercent: number
  scaleMin: number
  scaleMax: number
  scaleStep: number
  notice?: React.ReactNode
  previewUrl: string | null
  isPreviewLoading: boolean
  previewError: string | null
  onClose: () => void
  onToggleHighlight: () => void
  onSelectInstructor: (value: string) => void
  onSelectOrientation: (value: 'portrait' | 'landscape') => void
  onChangeScale: (value: number) => void
  onResetScale: () => void
  onPrint: () => void
}

function SchematicOptionsModal({
  open,
  options,
  instructorNames,
  scalePercent,
  scaleMin,
  scaleMax,
  scaleStep,
  notice,
  previewUrl,
  isPreviewLoading,
  previewError,
  onClose,
  onToggleHighlight,
  onSelectInstructor,
  onSelectOrientation,
  onChangeScale,
  onResetScale,
  onPrint,
}: SchematicOptionsModalProps) {
  if (!open) {
    return null
  }

  return (
    <PrintModalShell
      title="Schematic Options"
      description="Highlight a specific instructor or generate one for each."
      notice={notice}
      onClose={onClose}
      panelClassName="max-w-7xl"
    >
      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.6fr)]">
        <div className="grid content-start gap-4 md:grid-cols-2 xl:grid-cols-1">
          <label className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-4 py-3 text-sm font-semibold text-secondary">
            <input
              type="checkbox"
              checked={options.highlightInstructor}
              onChange={onToggleHighlight}
            />
            Highlight Instructor Name
          </label>
          <label className="flex flex-col gap-2 rounded-2xl border border-secondary/20 bg-bg px-4 py-3 text-sm font-semibold text-secondary">
            Orientation
            <select
              className="rounded-2xl border-2 border-secondary bg-accent px-3 py-2 text-primary"
              value={options.orientation}
              onChange={event =>
                onSelectOrientation(event.target.value === 'landscape' ? 'landscape' : 'portrait')
              }
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 rounded-2xl border border-secondary/20 bg-bg px-4 py-3 text-sm font-semibold text-secondary">
            Instructor
            <select
              className="rounded-2xl border-2 border-secondary bg-accent px-3 py-2 text-primary disabled:cursor-not-allowed disabled:opacity-60"
              value={options.selectedInstructor}
              disabled={!options.highlightInstructor}
              onChange={event => onSelectInstructor(event.target.value)}
            >
              {!options.highlightInstructor ? (
                <option value="none">None</option>
              ) : (
                <>
                  <option value="one-each">One Each</option>
                  {instructorNames.map(name => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </label>
          <SchematicScaleControl
            value={scalePercent}
            min={scaleMin}
            max={scaleMax}
            step={scaleStep}
            onChange={onChangeScale}
            onReset={onResetScale}
          />
        </div>

        <section className="flex min-h-[32rem] flex-col rounded-2xl border-2 border-secondary p-3">
          <div className="flex items-center justify-between gap-3 px-1 pb-3">
            <div>
              <h4 className="text-sm font-semibold">PDF Preview</h4>
              <p className="text-xs text-secondary/70">
                {options.highlightInstructor && options.selectedInstructor === 'one-each'
                  ? 'One Each will print one highlighted copy per instructor. Preview shows the base schematic.'
                  : 'Updates automatically as you change options.'}
              </p>
            </div>
            {isPreviewLoading ? (
              <span className="text-xs font-semibold text-secondary/70">Refreshing...</span>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-secondary/20 bg-bg">
            {previewError ? (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-secondary/80">
                {previewError}
              </div>
            ) : previewUrl ? (
              <iframe
                title="Schematic PDF preview"
                className="h-full w-full bg-white"
                src={previewUrl}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-secondary/80">
                {isPreviewLoading
                  ? 'Loading preview...'
                  : 'Select a day with schematic data to preview the PDF.'}
              </div>
            )}
          </div>
        </section>
      </div>
      <div className="mt-8 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          className="rounded-2xl border border-secondary/40 px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
          onClick={onClose}
        >
          Close
        </button>
        <button
          type="button"
          className="rounded-2xl bg-secondary px-5 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
          onClick={onPrint}
        >
          Print
        </button>
      </div>
    </PrintModalShell>
  )
}

export default SchematicOptionsModal
