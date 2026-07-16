import React from 'react'
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { SessionReportPdfRequest } from '../types'

const styles = StyleSheet.create({
  page: { padding: 72, fontFamily: 'Times-Roman', color: '#111111', fontSize: 11, lineHeight: 1.4 },
  title: { fontFamily: 'Times-Bold', fontSize: 20, textAlign: 'center' },
  subtitle: { fontFamily: 'Times-Italic', fontSize: 11, textAlign: 'center', marginTop: 3, marginBottom: 14 },
  meta: { marginBottom: 3 },
  metaLabel: { fontFamily: 'Times-Bold' },
  section: { marginTop: 12 },
  sectionTitle: { fontFamily: 'Times-Bold', fontSize: 14, paddingBottom: 3, borderBottomWidth: 0.7, marginBottom: 6 },
  entry: { marginLeft: 8, paddingLeft: 7, borderLeftWidth: 1, marginTop: 5 },
  entryTitle: { fontFamily: 'Times-Bold', marginBottom: 2 },
  text: { marginBottom: 3 },
  empty: { fontFamily: 'Times-Italic', color: '#555555' },
})

const humanize = (value: string) => value
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replaceAll('_', ' ')
  .replace(/^./, first => first.toUpperCase())

const scalarText = (value: unknown) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function ValueBlock({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    if (!value.length) return <Text style={styles.empty}>None recorded.</Text>
    return (
      <View>
        {value.map((entry, index) => (
          <View key={index} style={styles.entry} wrap={false}>
            <ValueBlock value={entry} />
          </View>
        ))}
      </View>
    )
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, entry]) => {
      if (Array.isArray(entry)) return entry.length > 0
      if (entry && typeof entry === 'object') return Object.keys(entry as object).length > 0
      return Boolean(scalarText(entry))
    })
    if (!entries.length) return <Text style={styles.empty}>None recorded.</Text>
    return (
      <View>
        {entries.map(([key, entry]) => (
          <View key={key} style={styles.text}>
            <Text style={styles.entryTitle}>{humanize(key)}</Text>
            <ValueBlock value={entry} />
          </View>
        ))}
      </View>
    )
  }
  return <Text style={styles.text}>{scalarText(value) || '—'}</Text>
}

const metaKeys = ['authorName', 'sessionContext', 'createdAt', 'updatedAt']

export function SessionReportDocument({ request }: { request: SessionReportPdfRequest }) {
  const title = scalarText(request.title) || 'Session Report'
  const sections = Object.entries(request).filter(([key]) => key !== 'title' && !metaKeys.includes(key))
  return (
    <Document title={title} author="DeckSupervisor" creator="DeckSupervisor" producer="DeckSupervisor">
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Formal Session Report</Text>
        {metaKeys.map(key => {
          const value = scalarText(request[key])
          return value ? (
            <Text key={key} style={styles.meta}>
              <Text style={styles.metaLabel}>{humanize(key)}: </Text>{value}
            </Text>
          ) : null
        })}
        {sections.map(([key, value], index) => (
          <View key={key} style={styles.section}>
            <Text style={styles.sectionTitle}>{index + 1}) {humanize(key)}</Text>
            <ValueBlock value={value} />
          </View>
        ))}
      </Page>
    </Document>
  )
}
