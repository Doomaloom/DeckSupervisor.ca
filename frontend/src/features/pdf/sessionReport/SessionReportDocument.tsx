import React from 'react'
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { SessionReportPdfRequest } from '../types'

const styles = StyleSheet.create({
  page: { padding: 72, fontFamily: 'Liberation Serif', color: '#000000', fontSize: 12, lineHeight: 1.45 },
  titleBlock: { marginBottom: 14 },
  title: { fontSize: 20, fontWeight: 700, textAlign: 'center' },
  subtitle: { fontStyle: 'italic', color: '#444444', textAlign: 'center', marginTop: 4 },
  metaGrid: { marginBottom: 10 },
  metaCard: { marginBottom: 4 },
  metaLabel: { fontSize: 11, fontWeight: 700 },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 14, fontWeight: 700, marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1 },
  subsection: { marginTop: 8 },
  subsectionTitle: { fontSize: 12, fontWeight: 700, marginBottom: 4 },
  entry: { marginTop: 6, marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1.5 },
  entryTitle: { fontWeight: 700, marginBottom: 3 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flexGrow: 1, flexBasis: 0 },
  smallLabel: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
  pair: { marginTop: 3 },
  muted: { color: '#444444', fontStyle: 'italic' },
  paragraph: { marginBottom: 6 },
  bullet: { marginLeft: 20, marginBottom: 2 },
})

const clean = (value: string | undefined) => value?.trim() ?? ''
const Optional = ({ value, list = false }: { value?: string; list?: boolean }) => (
  <Text style={!clean(value) ? styles.muted : undefined}>{clean(value) || (list ? 'None listed.' : 'Not provided.')}</Text>
)
const formatTimestamp = (value: string) => {
  const trimmed = clean(value)
  if (!trimmed) return 'Not provided'
  if (!/^\d{4}-\d\d-\d\dT/.test(trimmed)) return trimmed
  const date = new Date(trimmed)
  if (Number.isNaN(date.valueOf())) return trimmed
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const hour = date.getUTCHours() % 12 || 12
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  const period = date.getUTCHours() < 12 ? 'AM' : 'PM'
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()} ${hour}:${minute} ${period}`
}
const Subsection = ({ title, children, empty }: React.PropsWithChildren<{ title: string; empty?: boolean }>) => (
  <View style={styles.subsection}>
    <Text style={styles.subsectionTitle}>{title}</Text>
    {empty ? <Text style={styles.muted}>None reported.</Text> : children}
  </View>
)
const Pair = ({ leftLabel, left, rightLabel, right }: { leftLabel: string; left?: string; rightLabel: string; right?: string }) => (
  <View style={styles.row}>
    <View style={styles.half}><Text style={styles.smallLabel}>{leftLabel}</Text><Optional value={left} /></View>
    <View style={styles.half}><Text style={styles.smallLabel}>{rightLabel}</Text><Optional value={right} /></View>
  </View>
)
const Entries = ({ entries }: { entries: Array<{ title: string; text: string }> }) => <>
  {entries.map((entry, index) => <View key={index} style={styles.entry} wrap={false}>
    <Text style={styles.entryTitle}>{entry.title}</Text><Optional value={entry.text} />
  </View>)}
</>

export function SessionReportDocument({ request }: { request: SessionReportPdfRequest }) {
  const title = clean(request.title) || 'Session Report'
  const instructorEntries = (heading: string, entries: typeof request.staff.performance) => (
    <Subsection title={heading} empty={!entries.some(entry => clean(entry.instructor))}>
      <Entries entries={entries.filter(entry => clean(entry.instructor)).map(entry => ({ title: entry.instructor, text: entry.text }))} />
    </Subsection>
  )
  return <Document title={title} author="DeckSupervisor" creator="DeckSupervisor" producer="DeckSupervisor" creationDate={new Date()}>
    <Page size="LETTER" style={styles.page} wrap>
      <View style={styles.titleBlock} wrap={false}><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>Formal Session Report</Text></View>
      <View style={styles.metaGrid} wrap={false}>
        {([['Author', request.authorName], ['Session', request.sessionContext], ['Created', formatTimestamp(request.createdAt)], ['Last Updated', formatTimestamp(request.updatedAt)]] as const).map(([label, value]) =>
          <Text key={label} style={styles.metaCard}><Text style={styles.metaLabel}>{label}: </Text>{clean(value) || 'Not provided'}</Text>)}
      </View>

      <View style={styles.section}><Text style={styles.sectionTitle}>1) Staff</Text>
        {instructorEntries('Performance', request.staff.performance)}
        <Subsection title="Strengths / Weaknesses" empty={!request.staff.strengthWeakness.some(e => clean(e.instructor) && [...e.strengths, ...e.weaknesses].some(clean))}>
          {request.staff.strengthWeakness.filter(e => clean(e.instructor) && [...e.strengths, ...e.weaknesses].some(clean)).map((entry, index) => <View key={index} style={styles.entry} wrap={false}>
            <Text style={styles.entryTitle}>{entry.instructor}</Text><View style={styles.row}>
              {[['Strengths', entry.strengths], ['Weaknesses', entry.weaknesses]].map(([label, values]) => <View key={label as string} style={styles.half}>
                <Text style={styles.smallLabel}>{label as string}</Text>{(values as string[]).filter(clean).length ? (values as string[]).filter(clean).map((v, i) => <Text key={i} style={styles.bullet}>• {v.trim()}</Text>) : <Optional list />}
              </View>)}
            </View>
          </View>)}
        </Subsection>
        {instructorEntries('Succession Plans', request.staff.successionPlans)}
        <Subsection title="Instructor Covers" empty={!request.staff.instructorCovers.some(e => clean(e.instructor) || clean(e.coveredBy) || clean(e.details))}>
          {request.staff.instructorCovers.filter(e => clean(e.instructor) || clean(e.coveredBy) || clean(e.details)).map((entry, index) => <View key={index} style={styles.entry} wrap={false}>
            <Pair leftLabel="Instructor" left={entry.instructor} rightLabel="Covered By" right={entry.coveredBy} />
            <View style={styles.pair}><Text style={styles.smallLabel}>Details</Text><Optional value={entry.details} /></View>
          </View>)}
        </Subsection>
      </View>

      <View style={styles.section}><Text style={styles.sectionTitle}>2) Lesson Structure</Text>
        <Subsection title="Challenging Times for Lesson Layouts" empty={!request.lessonStructure.challengingTimes.some(e => clean(e.time) || clean(e.lessons) || clean(e.description))}>
          {request.lessonStructure.challengingTimes.filter(e => clean(e.time) || clean(e.lessons) || clean(e.description)).map((e, i) => <View key={i} style={styles.entry} wrap={false}><Pair leftLabel="Time" left={e.time} rightLabel="Lessons" right={e.lessons} /><View style={styles.pair}><Text style={styles.smallLabel}>Description</Text><Optional value={e.description} /></View></View>)}
        </Subsection>
        <Subsection title="New Class Layouts" empty={!request.lessonStructure.newClassLayouts.some(e => clean(e.level) || clean(e.description))}>
          {request.lessonStructure.newClassLayouts.filter(e => clean(e.level) || clean(e.description)).map((e, i) => <View key={i} style={styles.entry} wrap={false}><Pair leftLabel="Level" left={e.level} rightLabel="Layout / Location" right={e.description} /></View>)}
        </Subsection>
      </View>

      <View style={styles.section}><Text style={styles.sectionTitle}>3) Safety and Facility Observations</Text>
        <Subsection title="Safety Concerns" empty={!request.safetyFacility.safetyConcerns.some(e => clean(e.concernType) || clean(e.description))}>
          {request.safetyFacility.safetyConcerns.filter(e => clean(e.concernType) || clean(e.description)).map((e, i) => <View key={i} style={styles.entry} wrap={false}><Pair leftLabel="Concern Type" left={e.concernType} rightLabel="Description" right={e.description} /></View>)}
        </Subsection>
        {([['Recurring Equipment / Maintenance Issues', request.safetyFacility.maintenanceIssues], ['Pool Deck Setup - What Works Well', request.safetyFacility.poolDeckWorksWell], ['Pool Deck Setup - What Can Improve', request.safetyFacility.poolDeckImprovements]] as const).map(([heading, entries]) => <Subsection key={heading} title={heading} empty={!entries.some(e => clean(e.item) || clean(e.description))}>{entries.filter(e => clean(e.item) || clean(e.description)).map((e, i) => <View key={i} style={styles.entry} wrap={false}><Pair leftLabel="Item" left={e.item} rightLabel="Description" right={e.description} /></View>)}</Subsection>)}
      </View>

      <View style={styles.section}><Text style={styles.sectionTitle}>4) Parent / Customer Feedback</Text>
        {!request.parentCustomerFeedback.some(e => clean(e.feedbackType) || clean(e.description)) ? <Text style={styles.muted}>None reported.</Text> : request.parentCustomerFeedback.filter(e => clean(e.feedbackType) || clean(e.description)).map((e, i) => <View key={i} style={styles.entry} wrap={false}><Pair leftLabel="Type" left={e.feedbackType} rightLabel="Description" right={e.description} /></View>)}
      </View>

      <View style={styles.section}><Text style={styles.sectionTitle}>5) Projects and/or Initiatives</Text>
        <Subsection title="Admin Work" empty={!request.projectsInitiatives.adminWork.some(e => clean(e.work) || clean(e.description))}>{request.projectsInitiatives.adminWork.filter(e => clean(e.work) || clean(e.description)).map((e, i) => <View key={i} style={styles.entry} wrap={false}><Pair leftLabel="Work Item" left={e.work} rightLabel="Description" right={e.description} /></View>)}</Subsection>
        <Subsection title="Projects to Initiate" empty={!request.projectsInitiatives.initiatives.some(e => clean(e.title) || clean(e.brief))}>{request.projectsInitiatives.initiatives.filter(e => clean(e.title) || clean(e.brief)).map((e, i) => <View key={i} style={styles.entry} wrap={false}><Pair leftLabel="Title" left={e.title} rightLabel="Brief" right={e.brief} /></View>)}</Subsection>
      </View>
    </Page>
  </Document>
}

export { formatTimestamp }
