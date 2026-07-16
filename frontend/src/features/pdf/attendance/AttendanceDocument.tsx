import React from 'react'
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { AttendancePdfItem } from '../types'
import { getAttendanceTemplate } from './attendanceTemplates'

const PAGE_WIDTH = 792
const MARGIN = 14.4
const PRINTABLE_WIDTH = PAGE_WIDTH - MARGIN * 2
const styles = StyleSheet.create({ page: { padding: MARGIN, fontFamily: 'Liberation Sans', color: '#000' } })
const startDate = (schedule: string) => schedule.trim().split(/\s+/)[1] ?? ''

function FrontSheet({ item, session }: { item: AttendancePdfItem; session?: string }) {
  const template = getAttendanceTemplate(item.template)
  const totalWidth = template.headerWidthPt + template.columns.reduce((sum, column) => sum + column.widthPt, 0)
  const scale = PRINTABLE_WIDTH / totalWidth
  const headerHeight = template.rotateHeightPx * .75 * scale
  const rows = item.roster.students.length ? item.roster.students : [{ name: '' }]
  return <View wrap={false} style={{ width: PRINTABLE_WIDTH }}>
    <View style={{ flexDirection: 'row', height: headerHeight, borderWidth: 1 }}>
      <View style={{ width: template.headerWidthPt * scale, padding: 9 * scale, borderRightWidth: 1 }}>
        <Text style={{ fontSize: 18 * scale, fontWeight: 700, marginBottom: 5 * scale }}>{template.title}</Text>
        <Text style={{ fontSize: 12 * scale, lineHeight: 1.2 }}><Text style={{ fontWeight: 700 }}>Instructor: </Text>{item.roster.instructor}</Text>
        <Text style={{ fontSize: 12 * scale, lineHeight: 1.2 }}><Text style={{ fontWeight: 700 }}>Start Day/Time: </Text>{[startDate(item.roster.schedule), item.roster.time].filter(Boolean).join(' ')}</Text>
        <Text style={{ fontSize: 12 * scale, lineHeight: 1.2 }}><Text style={{ fontWeight: 700 }}>Session: </Text>{session?.trim() ?? ''}</Text>
        <Text style={{ fontSize: 12 * scale, lineHeight: 1.2 }}><Text style={{ fontWeight: 700 }}>Location: </Text>{item.roster.location}</Text>
        <Text style={{ fontSize: 12 * scale, lineHeight: 1.2 }}><Text style={{ fontWeight: 700 }}>Barcode: </Text>{item.roster.code}</Text>
      </View>
      {template.columns.map((column, index) => <View key={index} style={{ width: column.widthPt * scale, borderRightWidth: index === template.columns.length - 1 ? 0 : 1, overflow: 'hidden' }}>
        <Text style={{ position: 'absolute', top: template.rotateTopPx * .75 * scale, left: 0, width: Math.max(60, template.rotateTranslatePx * .75 * scale), fontSize: 7.5 * scale, fontWeight: 700, transform: 'rotate(-90deg)' }}>{column.text || ' '}</Text>
      </View>)}
    </View>
    {rows.map((student, index) => <View key={index} style={{ flexDirection: 'row', minHeight: 42 * scale, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1 }}>
      <View style={{ width: template.headerWidthPt * scale, padding: 4 * scale, borderRightWidth: 1 }}>
        <Text style={{ fontSize: 10 * scale }}>{index + 1}. {student.name}</Text>
        <Text style={{ fontSize: 10 * scale }}><Text style={{ textDecoration: 'underline' }}>A</Text>bsent/<Text style={{ textDecoration: 'underline' }}>P</Text>resent</Text>
        <Text style={{ color: 'rgb(98,98,98)', fontSize: 8.25 * scale }}>[Day 1] [Day 2] [Day 3] [Day 4] [Day 5] [Day 6] [Day 7] [Day 8] [Day 9] [Day 10] [Day 11] [Day 12] [Day 13] [Day 14]</Text>
      </View>
      {template.columns.map((column, cell) => <View key={cell} style={{ width: column.widthPt * scale, borderRightWidth: cell === template.columns.length - 1 ? 0 : 1 }} />)}
    </View>)}
  </View>
}

function BackSheet({ item }: { item: AttendancePdfItem }) {
  const template = getAttendanceTemplate(item.template)
  const total = template.backColumns.reduce((sum, column) => sum + (column.widthPt || 1), 0)
  return <View wrap={false} style={{ width: PRINTABLE_WIDTH, flexDirection: 'row' }}>
    {template.backColumns.map((column, index) => <View key={index} style={{ width: PRINTABLE_WIDTH * (column.widthPt || 1) / total, paddingHorizontal: 4 }}>
      {column.blocks.map((block, blockIndex) => <Text key={blockIndex} style={{ fontFamily: 'Liberation Serif', fontSize: template.compactBackPage ? 6.75 : 7.5, lineHeight: template.compactBackPage ? 1.05 : 1.15, marginBottom: template.compactBackPage ? 2 : 5 }}>{block}</Text>)}
    </View>)}
  </View>
}

export function groupAttendanceItems(items: AttendancePdfItem[]) {
  const groups: AttendancePdfItem[][] = []
  for (let index = 0; index < items.length;) {
    const next = items[index + 1]
    if (next && next.roster.code === items[index].roster.code) { groups.push([items[index], next]); index += 2 }
    else { groups.push([items[index]]); index += 1 }
  }
  return groups
}

export function AttendanceDocument({ items, title, session }: { items: AttendancePdfItem[]; title: string; session?: string }) {
  return <Document title={title} author="DeckSupervisor" creator="DeckSupervisor" producer="DeckSupervisor" creationDate={new Date()}>
    {groupAttendanceItems(items).flatMap((group, groupIndex) => [
      <Page key={`front-${groupIndex}`} size="LETTER" orientation="landscape" style={styles.page}>{group.map((item, index) => <View key={index} style={index ? { marginTop: 15 } : undefined}><FrontSheet item={item} session={session} /></View>)}</Page>,
      <Page key={`back-${groupIndex}`} size="LETTER" orientation="landscape" style={styles.page}>{group.map((item, index) => <View key={index} style={index ? { marginTop: 15 } : undefined}><BackSheet item={item} /></View>)}</Page>,
    ])}
  </Document>
}
