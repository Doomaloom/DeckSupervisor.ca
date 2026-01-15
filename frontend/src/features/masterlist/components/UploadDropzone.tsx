import React from 'react'

type UploadDropzoneProps = {
  fileStatus: string
  onFileChange: (file: File | null) => void
  onDrop: React.DragEventHandler<HTMLDivElement>
  onDragOver: React.DragEventHandler<HTMLDivElement>
}

function UploadDropzone({ fileStatus, onFileChange, onDrop, onDragOver }: UploadDropzoneProps) {
  return (
    <>
      <div
        className="relative cursor-pointer rounded-card border-2 border-dashed border-secondary bg-accent p-4 text-center text-secondary transition hover:bg-bg"
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <p className="text-lg">Drag & Drop your .csv file here or click to select</p>
        <input
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          type="file"
          name="csv_file"
          accept=".csv"
          required
          onChange={event => onFileChange(event.target.files?.[0] ?? null)}
        />
      </div>
      <div className="text-base text-secondary">{fileStatus}</div>
    </>
  )
}

export default UploadDropzone
