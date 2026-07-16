import React from 'react'
import type {
  BooleanFormatOptionKey,
  FormatOptions,
  MasterlistAlphabeticalNameBasis,
  MasterlistLayout,
} from '../../../types/app'
import {
  courseHeaderStyleOptions,
  formatOptionItems,
  masterlistFontSizeMax,
  masterlistFontSizeMin,
  timeHeaderStyleOptions,
} from '../../masterlist/constants'
import PrintModalShell from './PrintModalShell'
import SchematicScaleControl from './SchematicScaleControl'
import MasterlistLayoutControls from '../../masterlist/components/MasterlistLayoutControls'

type MasterlistExtras = {
  schematicCoverPage: boolean
}

type MasterlistOptionsModalProps = {
  open: boolean
  extras: MasterlistExtras
  coverOrientation: 'portrait' | 'landscape'
  schematicScalePercent: number
  scaleMin: number
  scaleMax: number
  scaleStep: number
  formatOptions: FormatOptions
  notice?: React.ReactNode
  previewUrl: string | null
  isPreviewLoading: boolean
  previewError: string | null
  onToggleFormat: (key: BooleanFormatOptionKey) => void
  onChangeLayout: (layout: MasterlistLayout) => void
  onChangeAlphabeticalNameBasis: (basis: MasterlistAlphabeticalNameBasis) => void
  onChangeFontSize: (value: string) => void
  onClose: () => void
  onToggle: (key: keyof MasterlistExtras) => void
  onSelectCoverOrientation: (value: 'portrait' | 'landscape') => void
  onChangeSchematicScale: (value: number) => void
  onResetSchematicScale: () => void
  onPrint: () => void
}

function MasterlistOptionsModal({
  open,
  extras,
  coverOrientation,
  schematicScalePercent,
  scaleMin,
  scaleMax,
  scaleStep,
  formatOptions,
  notice,
  previewUrl,
  isPreviewLoading,
  previewError,
  onToggleFormat,
  onChangeLayout,
  onChangeAlphabeticalNameBasis,
  onChangeFontSize,
  onClose,
  onToggle,
  onSelectCoverOrientation,
  onChangeSchematicScale,
  onResetSchematicScale,
  onPrint,
}: MasterlistOptionsModalProps) {
  if (!open) {
    return null
  }

  return (
    <PrintModalShell
      title="Masterlist Options"
      description="Choose formatting options and add a schematic coverpage to the masterlist."
      notice={notice}
      onClose={onClose}
      panelClassName="max-w-7xl"
    >
      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <fieldset className="flex flex-col gap-2 rounded-2xl border-2 border-secondary p-3">
            <legend className="px-2 text-xs font-semibold">Format Options</legend>
            <MasterlistLayoutControls
              layout={formatOptions.layout}
              alphabeticalNameBasis={formatOptions.alphabetical_name_basis}
              onChangeLayout={onChangeLayout}
              onChangeAlphabeticalNameBasis={onChangeAlphabeticalNameBasis}
              compact
            />
            <label className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-3 py-2 text-xs font-semibold text-secondary">
              <input
                type="checkbox"
                checked={extras.schematicCoverPage}
                onChange={() => onToggle('schematicCoverPage')}
              />
              Schematic Coverpage
            </label>
            {extras.schematicCoverPage && (
              <>
                <label
                  className="flex flex-col gap-2 rounded-2xl border border-secondary/20 bg-bg px-3 py-2 text-xs font-semibold text-secondary"
                >
                  Cover Orientation
                  <select
                    className="rounded-2xl border-2 border-secondary bg-accent px-3 py-2 text-primary"
                    value={coverOrientation}
                    onChange={event =>
                      onSelectCoverOrientation(
                        event.target.value === 'landscape' ? 'landscape' : 'portrait',
                      )
                    }
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </label>
                <SchematicScaleControl
                  value={schematicScalePercent}
                  min={scaleMin}
                  max={scaleMax}
                  step={scaleStep}
                  onChange={onChangeSchematicScale}
                  onReset={onResetSchematicScale}
                  compact
                />
              </>
            )}
            {formatOptionItems
              .filter(option => formatOptions.layout === 'class-time' || option.key === 'borders')
              .map(option => (
                <label
                  key={option.key}
                  className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-3 py-2 text-xs font-semibold text-secondary"
                >
                  <input
                    type="checkbox"
                    checked={formatOptions[option.key]}
                    onChange={() => onToggleFormat(option.key)}
                  />
                  {option.label}
                </label>
              ))}
            <label className="flex flex-col gap-2 rounded-2xl border border-secondary/20 bg-bg px-3 py-2 text-xs font-semibold text-secondary">
              Font Size
              <input
                type="number"
                min={masterlistFontSizeMin}
                max={masterlistFontSizeMax}
                step={1}
                className="rounded-2xl border-2 border-secondary bg-accent px-3 py-2 text-primary"
                value={formatOptions.font_size}
                onChange={event => onChangeFontSize(event.target.value)}
              />
            </label>
          </fieldset>

          {formatOptions.layout === 'class-time' ? (
            <div className="flex flex-col gap-3">
              <fieldset className="flex flex-col gap-2 rounded-2xl border-2 border-secondary p-3">
                <legend className="px-2 text-xs font-semibold">Time Header Style</legend>
                {timeHeaderStyleOptions.map(option => (
                  <label
                    key={option.key}
                    className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-3 py-2 text-xs font-semibold text-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={formatOptions[option.key]}
                      onChange={() => onToggleFormat(option.key)}
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>

              <fieldset className="flex flex-col gap-2 rounded-2xl border-2 border-secondary p-3">
                <legend className="px-2 text-xs font-semibold">Course Header Style</legend>
                {courseHeaderStyleOptions.map(option => (
                  <label
                    key={option.key}
                    className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-3 py-2 text-xs font-semibold text-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={formatOptions[option.key]}
                      onChange={() => onToggleFormat(option.key)}
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
            </div>
          ) : null}
        </div>

        <section className="flex min-h-[24rem] flex-col rounded-2xl border-2 border-secondary p-3">
          <div className="flex items-center justify-between gap-3 px-1 pb-3">
            <div>
              <h4 className="text-sm font-semibold">Live Preview</h4>
              <p className="text-xs text-secondary/70">
                Updates automatically as you change formatting.
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
                title="Masterlist preview"
                className="h-full w-full bg-white"
                src={previewUrl}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-secondary/80">
                {isPreviewLoading
                  ? 'Loading preview...'
                  : 'Select a day with roster data to preview the masterlist.'}
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

export default MasterlistOptionsModal
