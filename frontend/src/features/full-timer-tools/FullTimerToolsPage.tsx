import React, { useState } from 'react'

function FullTimerToolsPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastFilename, setLastFilename] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!selectedFile) {
      alert('Please upload the schematic maker CSV file.')
      return
    }

    setIsGenerating(true)
    try {
      const formData = new FormData()
      formData.append('csv_file', selectedFile)

      const response = await fetch('/api/schematic-maker', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Failed to generate schematic maker workbook.')
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition') ?? ''
      const match = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition)
      const filename = match?.[1] ?? 'schematic-maker-output.zip'

      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)
      setLastFilename(filename)
    } catch (error) {
      console.error(error)
      alert('Unable to generate the schematic maker output. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="relative overflow-hidden rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-md">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-secondary/15" />
        <div className="absolute -bottom-12 left-10 h-24 w-24 rounded-full bg-secondary/10" />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary/70">
            Full Timer Tools
          </p>
          <h2 className="mt-3 text-2xl font-semibold">Full Timer Tools</h2>
          <p className="mt-2 max-w-2xl text-secondary">
            Your toolbox for running sessions. The schematic maker is ready; more tools are coming next.
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70">
            Tool 1
          </p>
          <h3 className="mt-2 text-lg font-semibold">Schematic Maker</h3>
          <p className="mt-2 text-secondary">
            Upload the schematic maker CSV file to generate location-based schedule workbooks.
          </p>
        </div>

        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-secondary">Upload CSV</p>
              <p className="mt-1 text-sm text-secondary/80">
                Required columns: GroupName, ID, MainFacility, Day, Starts, Ends, Max, Min,
                RegTotal, PercentFilled.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="relative inline-flex items-center gap-2 rounded-2xl border border-secondary/40 bg-bg px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-accent">
                <span>{selectedFile ? selectedFile.name : 'Choose CSV File'}</span>
                <input
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  type="file"
                  accept=".csv"
                  onChange={event => {
                    const file = event.target.files?.[0] ?? null
                    setSelectedFile(file)
                    setLastFilename(null)
                  }}
                />
              </label>

              <button
                type="button"
                className="rounded-2xl bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? 'Generating...' : 'Generate Workbook'}
              </button>
            </div>

            {lastFilename && (
              <p className="text-sm text-secondary">
                Downloaded: <span className="font-semibold">{lastFilename}</span>
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
        <h3 className="text-lg font-semibold">Next Tools</h3>
        <p className="mt-2 text-secondary">
          Tell me what should come next and I will wire it in here.
        </p>
      </div>
    </div>
  )
}

export default FullTimerToolsPage
