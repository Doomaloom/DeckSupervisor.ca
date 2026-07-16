import React from 'react'
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { AttendancePdfItem } from '../types'
import { getAttendanceTemplate } from './attendanceTemplates'

const styles = StyleSheet.create({
  page: {
    padding: 12,
    fontFamily: 'Helvetica',
    color: '#111111',
    backgroundColor: '#ffffff',
  },
  slot: {
    flexGrow: 1,
    borderBottomWidth: 0.6,
    borderBottomColor: '#888888',
    paddingBottom: 5,
    marginBottom: 5,
  },
  lastSlot: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  frontHeader: {
    flexDirection: 'row',
    borderWidth: 0.7,
    borderColor: '#111111',
    minHeight: 64,
  },
  details: {
    width: '39%',
    padding: 5,
    borderRightWidth: 0.7,
    borderRightColor: '#111111',
  },
  title: { fontSize: 11, fontWeight: 700, marginBottom: 3 },
  detail: { fontSize: 6.5, lineHeight: 1.25 },
  skillArea: { width: '61%', flexDirection: 'row' },
  skillColumn: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 12,
    borderRightWidth: 0.4,
    borderRightColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  skillText: {
    width: 78,
    fontSize: 4.3,
    textAlign: 'center',
    transform: 'rotate(-90deg)',
  },
  students: { borderLeftWidth: 0.7, borderLeftColor: '#111111' },
  studentRow: {
    minHeight: 18,
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderRightWidth: 0.7,
    borderColor: '#111111',
  },
  studentName: {
    width: '39%',
    borderRightWidth: 0.7,
    borderRightColor: '#111111',
    padding: 3,
    fontSize: 6.5,
  },
  attendanceDays: { marginTop: 2, fontSize: 4.6, color: '#4b5563' },
  markCell: { flexGrow: 1, flexBasis: 0, borderRightWidth: 0.35, borderRightColor: '#777777' },
  backTitle: { fontSize: 9, fontWeight: 700, textAlign: 'center', marginBottom: 5 },
  backColumns: { flexDirection: 'row', gap: 8, flexGrow: 1 },
  backColumn: { width: '50%' },
  backSection: { fontSize: 6.1, lineHeight: 1.16, marginBottom: 4 },
  compactBackSection: { fontSize: 5.3, lineHeight: 1.08, marginBottom: 2.5 },
})

const startDateFromSchedule = (schedule: string) => schedule.trim().split(/\s+/)[1] ?? ''

function FrontSheet({ item, compact, session }: { item: AttendancePdfItem; compact: boolean; session?: string }) {
  const template = getAttendanceTemplate(item.template)
  const specialColumns = [
    template.showPreviousLevel ? 'Previous Level' : '',
    template.showResult ? 'Result' : '',
    template.showRegisterIn ? 'Register In' : '',
  ].filter(Boolean)
  const headings = [...specialColumns.slice(0, 1), ...template.skills, ...specialColumns.slice(1)]
  const rows = item.roster.students.length > 0 ? item.roster.students : [{ name: '' }]

  return (
    <View style={[styles.slot, compact ? {} : styles.lastSlot]} wrap={false}>
      <View style={styles.frontHeader}>
        <View style={styles.details}>
          <Text style={styles.title}>{template.title}</Text>
          <Text style={styles.detail}>Session: {session?.trim() || ' '}</Text>
          <Text style={styles.detail}>Course: {item.roster.serviceName || item.roster.level || ' '}</Text>
          <Text style={styles.detail}>Instructor: {item.roster.instructor || ' '}</Text>
          <Text style={styles.detail}>
            Start Day/Time: {[startDateFromSchedule(item.roster.schedule), item.roster.time].filter(Boolean).join(' ')}
          </Text>
          <Text style={styles.detail}>Location: {item.roster.location || ' '}</Text>
          <Text style={styles.detail}>Barcode: {item.roster.code || ' '}</Text>
          <Text style={styles.detail}>Schedule: {item.roster.schedule || ' '}</Text>
        </View>
        <View style={styles.skillArea}>
          {headings.map((heading, index) => (
            <View key={`${heading}-${index}`} style={styles.skillColumn}>
              <Text style={styles.skillText}>{heading}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.students}>
        {rows.map((student, index) => (
          <View key={`${student.name}-${index}`} style={styles.studentRow}>
            <View style={styles.studentName}>
              <Text>{index + 1}. {student.name}</Text>
              <Text style={styles.attendanceDays}>A/P  [1] [2] [3] [4] [5] [6] [7] [8] [9] [10] [11] [12] [13] [14]</Text>
            </View>
            {headings.map((_, cellIndex) => (
              <View key={cellIndex} style={styles.markCell} />
            ))}
          </View>
        ))}
      </View>
    </View>
  )
}

function BackSheet({ item, compact }: { item: AttendancePdfItem; compact: boolean }) {
  const template = getAttendanceTemplate(item.template)
  const midpoint = Math.ceil(template.backSections.length / 2)
  const columns = [template.backSections.slice(0, midpoint), template.backSections.slice(midpoint)]
  return (
    <View style={[styles.slot, compact ? {} : styles.lastSlot]} wrap={false}>
      <Text style={styles.backTitle}>{template.title} — Assessment Criteria</Text>
      <View style={styles.backColumns}>
        {columns.map((sections, columnIndex) => (
          <View key={columnIndex} style={styles.backColumn}>
            {sections.map((section, index) => (
              <Text
                key={`${columnIndex}-${index}`}
                style={template.compactBackPage ? styles.compactBackSection : styles.backSection}
              >
                {section}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  )
}

export function groupAttendanceItems(items: AttendancePdfItem[]) {
  const groups: AttendancePdfItem[][] = []
  for (let index = 0; index < items.length;) {
    const next = items[index + 1]
    if (next && next.roster.code === items[index].roster.code) {
      groups.push([items[index], next])
      index += 2
    } else {
      groups.push([items[index]])
      index += 1
    }
  }
  return groups
}

export function AttendanceDocument({
  items,
  title,
  session,
}: {
  items: AttendancePdfItem[]
  title: string
  session?: string
}) {
  const groups = groupAttendanceItems(items)
  return (
    <Document title={title} author="DeckSupervisor" creator="DeckSupervisor" producer="DeckSupervisor" creationDate={new Date()}>
      {groups.flatMap((group, groupIndex) => {
        const compact = group.length === 2
        return [
          <Page key={`front-${groupIndex}`} size="LETTER" orientation="landscape" style={styles.page}>
            {group.map((item, index) => (
              <FrontSheet key={`${item.roster.code}-${item.template}-${index}`} item={item} compact={compact} session={session} />
            ))}
          </Page>,
          <Page key={`back-${groupIndex}`} size="LETTER" orientation="landscape" style={styles.page}>
            {group.map((item, index) => (
              <BackSheet key={`${item.roster.code}-${item.template}-${index}`} item={item} compact={compact} />
            ))}
          </Page>,
        ]
      })}
    </Document>
  )
}
