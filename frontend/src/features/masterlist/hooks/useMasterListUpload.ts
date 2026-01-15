import { useState } from 'react'

export function useMasterListUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [fileStatus, setFileStatus] = useState('No file selected.')

  const handleFileChange = (nextFile: File | null) => {
    setFile(nextFile)
    setFileStatus(nextFile ? `File Uploaded: ${nextFile.name}` : 'No file selected.')
  }

  const handleDrop: React.DragEventHandler<HTMLDivElement> = event => {
    event.preventDefault()
    const dropped = event.dataTransfer.files?.[0]
    if (dropped) {
      handleFileChange(dropped)
    }
  }

  const handleDragOver: React.DragEventHandler<HTMLDivElement> = event => {
    event.preventDefault()
  }

  return {
    file,
    fileStatus,
    handleFileChange,
    handleDrop,
    handleDragOver,
  }
}
