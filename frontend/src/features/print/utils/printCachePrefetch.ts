import type { SessionRecord } from '../../../app/useCurrentSession'
import { ensureCachedSchematicPdf } from '../../../lib/printPdfCache'
import type { CustomRoster } from '../../../types/app'
import type { StoredCourseLayout } from '../../schematic/utils/layout'
import { fetchSchematicPdf } from './printApi'
import { buildSchematicPrefetchPayloads } from './printPayloads'

type PrefetchSchematicPdfsArgs = {
  day: string
  sessionId: string
  session: SessionRecord | null
  storedLayout?: StoredCourseLayout | null
  customRostersOverride?: CustomRoster[]
}

export async function prefetchSchematicPdfs({
  day,
  sessionId,
  session,
  storedLayout,
  customRostersOverride,
}: PrefetchSchematicPdfsArgs): Promise<void> {
  if (!day || !sessionId) {
    return
  }

  const payloads = buildSchematicPrefetchPayloads({
    day,
    sessionId,
    session,
    storedLayout,
    customRostersOverride,
  })

  await Promise.all(
    payloads.map(({ requestKey, payload }) =>
      ensureCachedSchematicPdf(sessionId, day, requestKey, () => fetchSchematicPdf(payload)),
    ),
  )
}
