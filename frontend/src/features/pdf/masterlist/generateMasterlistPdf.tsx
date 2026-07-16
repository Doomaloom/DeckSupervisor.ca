import { renderPdfArtifact } from '../renderPdf'
import type { MasterlistPdfRequest } from '../types'
import { MasterlistDocument } from './MasterlistDocument'

export async function generateMasterlistPdf(request: MasterlistPdfRequest) {
  if (!request.rosters.length) throw new Error('No roster data found for the masterlist.')
  const now = new Date()
  const filename = `MasterList_${now.getMonth() + 1}_${now.getDate()}_${now.getFullYear()}.pdf`
  return renderPdfArtifact(<MasterlistDocument request={request} />, { title: 'Masterlist', filename })
}
