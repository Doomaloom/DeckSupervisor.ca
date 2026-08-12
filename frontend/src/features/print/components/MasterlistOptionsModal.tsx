import React, { useState } from 'react'
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

type OptionsGroupKey = 'cover' | 'format' | 'time' | 'course'

function OptionsGroup({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section
      className={`w-full shrink-0 overflow-hidden rounded-2xl border-2 border-secondary ${open ? '' : 'h-12'}`}
      data-options-group={title}
    >
      <button
        type="button"
        className="flex h-11 w-full items-center justify-between px-4 text-left text-xs font-semibold text-secondary transition hover:bg-bg"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>{title}</span>
        <span aria-hidden="true" className="text-base leading-none text-primary">
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? (
        <div className="flex flex-col gap-2 border-t border-secondary/20 p-3">
          {children}
        </div>
      ) : null}
    </section>
  )
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
  const [openGroups, setOpenGroups] = useState<Record<OptionsGroupKey, boolean>>({
    cover: false,
    format: true,
    time: true,
    course: true,
  })

  const toggleOptionsGroup = (group: OptionsGroupKey) => {
    setOpenGroups(current => {
      if (group === 'cover') {
        return current.cover
          ? { cover: false, format: true, time: true, course: true }
          : { cover: true, format: false, time: false, course: false }
      }
      return {
        ...current,
        cover: false,
        [group]: !current[group],
      }
    })
  }

  if (!open) {
    return null
  }

  return (
    <PrintModalShell
      title="Masterlist Options"
      description="Choose formatting options and add a schematic coverpage to the masterlist."
      notice={notice}
      onClose={onClose}
      panelClassName="flex h-[min(52rem,calc(100vh-3rem))] max-w-7xl flex-col overflow-hidden"
    >
      <div className="mt-6 grid min-h-0 flex-1 grid-rows-2 gap-4 overflow-hidden xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] xl:grid-rows-1">
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-2" data-component="masterlist-option-groups">
          <OptionsGroup
            title="Schematic Coverpage"
            open={openGroups.cover}
            onToggle={() => toggleOptionsGroup('cover')}
          >
            <label className="flex items-center gap-3 rounded-2xl border border-secondary/20 bg-bg px-3 py-2 text-xs font-semibold text-secondary">
              <input
                type="checkbox"
                checked={extras.schematicCoverPage}
                onChange={() => onToggle('schematicCoverPage')}
              />
              Include Schematic Coverpage
            </label>
            {extras.schematicCoverPage ? (
              <>
                <label className="flex flex-col gap-2 rounded-2xl border border-secondary/20 bg-bg px-3 py-2 text-xs font-semibold text-secondary">
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
            ) : null}
          </OptionsGroup>

          <OptionsGroup
            title="Format Options"
            open={openGroups.format}
            onToggle={() => toggleOptionsGroup('format')}
          >
            <MasterlistLayoutControls
              layout={formatOptions.layout}
              alphabeticalNameBasis={formatOptions.alphabetical_name_basis}
              onChangeLayout={onChangeLayout}
              onChangeAlphabeticalNameBasis={onChangeAlphabeticalNameBasis}
              compact
            />
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
          </OptionsGroup>

          {formatOptions.layout === 'class-time' ? (
            <>
              <OptionsGroup
                title="Time Header Style"
                open={openGroups.time}
                onToggle={() => toggleOptionsGroup('time')}
              >
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
              </OptionsGroup>

              <OptionsGroup
                title="Course Header Style"
                open={openGroups.course}
                onToggle={() => toggleOptionsGroup('course')}
              >
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
              </OptionsGroup>
            </>
          ) : null}
        </div>

        <section className="flex min-h-0 flex-col rounded-2xl border-2 border-secondary p-3">
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
      <div className="mt-4 flex shrink-0 flex-wrap justify-end gap-3">
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
