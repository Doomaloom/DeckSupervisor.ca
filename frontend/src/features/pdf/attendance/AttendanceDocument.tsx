import React from 'react'
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { AttendancePdfItem } from '../types'
import {
  ATTENDANCE_BACK_STYLE,
  ATTENDANCE_FRONT_STYLE,
  ATTENDANCE_PAGE,
  ATTENDANCE_PAIR,
  ATTENDANCE_PRINTABLE,
  ATTENDANCE_PRIVATE_STYLE,
} from './attendanceStyle'
import { buildAttendanceBackModel, buildAttendanceFrontModel } from './attendanceLayout'
import type {
  AttendanceAssessmentBackPage,
  AttendanceBackBlock,
  AttendancePrivateBackPage,
  AttendanceRichLine,
} from './attendanceTemplates'
import { getAttendanceTemplate } from './attendanceTemplates'

const styles = StyleSheet.create({
  page: {
    padding: ATTENDANCE_PAGE.margin,
    fontFamily: 'Liberation Sans',
    color: ATTENDANCE_PAGE.textColor,
    backgroundColor: ATTENDANCE_PAGE.backgroundColor,
  },
})

const startDate = (schedule: string) => schedule.trim().split(/\s+/)[1] ?? ''

function FrontSheet({ item, session, paired }: { item: AttendancePdfItem; session?: string; paired: boolean }) {
  const template = getAttendanceTemplate(item.template)
  const model = buildAttendanceFrontModel(item, template, paired)
  const typeScale = model.fit * model.densityScale
  const borderWidth = ATTENDANCE_FRONT_STYLE.borderWidth * model.fit

  return <View wrap={false} style={{ width: ATTENDANCE_PRINTABLE.width }}>
    <View style={{ flexDirection: 'row', height: model.headerHeight, borderWidth }}>
      <View style={{
        width: model.columnWidths.header,
        paddingHorizontal: ATTENDANCE_FRONT_STYLE.headerHorizontalPadding * model.fit,
        paddingTop: ATTENDANCE_FRONT_STYLE.detailsTop * model.densityScale,
        borderRightWidth: borderWidth,
      }}>
        <Text style={{ fontSize: ATTENDANCE_FRONT_STYLE.titleFontSize * typeScale, fontWeight: 700, lineHeight: ATTENDANCE_FRONT_STYLE.lineHeight, marginBottom: 5 * typeScale }}>
          {template.title}
        </Text>
        <MetadataLine label="Instructor" value={item.roster.instructor} fontSize={ATTENDANCE_FRONT_STYLE.metadataFontSize * typeScale} />
        <MetadataLine label="Start Day/Time" value={[startDate(item.roster.schedule), item.roster.time].filter(Boolean).join(' ')} fontSize={ATTENDANCE_FRONT_STYLE.metadataFontSize * typeScale} />
        <MetadataLine label="Session" value={session?.trim() ?? ''} fontSize={ATTENDANCE_FRONT_STYLE.metadataFontSize * typeScale} />
        <MetadataLine label="Location" value={item.roster.location} fontSize={ATTENDANCE_FRONT_STYLE.metadataFontSize * typeScale} />
        <MetadataLine label="Barcode" value={item.roster.code} fontSize={ATTENDANCE_FRONT_STYLE.metadataFontSize * typeScale} />
      </View>
      {template.columns.map((column, index) => <View key={`${column.text}-${index}`} style={{
        width: model.columnWidths.skills[index],
        borderRightWidth: index === template.columns.length - 1 ? 0 : borderWidth,
        overflow: 'hidden',
      }}>
        <Text style={{
          position: 'absolute',
          top: model.headingBaseline,
          left: 2 * model.fit,
          width: Math.max(1, model.headerHeight - 6 * typeScale),
          fontSize: ATTENDANCE_FRONT_STYLE.rotatedHeadingFontSize * typeScale,
          fontWeight: 700,
          lineHeight: ATTENDANCE_FRONT_STYLE.lineHeight,
          transform: 'rotate(-90deg)',
          transformOrigin: 'top left',
        }}>{column.text || ' '}</Text>
      </View>)}
    </View>
    {model.students.map((student, index) => <View key={`${student.name}-${index}`} style={{
      flexDirection: 'row',
      minHeight: model.rowHeight,
      borderLeftWidth: borderWidth,
      borderRightWidth: borderWidth,
      borderBottomWidth: borderWidth,
    }}>
      <View style={{ width: model.columnWidths.header, padding: 4 * typeScale, borderRightWidth: borderWidth }}>
        <Text style={{ fontSize: ATTENDANCE_FRONT_STYLE.studentFontSize * typeScale, fontWeight: 700, lineHeight: ATTENDANCE_FRONT_STYLE.lineHeight }}>
          {index + 1}. {student.name}
        </Text>
        <Text style={{ fontSize: ATTENDANCE_FRONT_STYLE.attendanceFontSize * typeScale, lineHeight: ATTENDANCE_FRONT_STYLE.lineHeight }}>
          <Text style={{ textDecoration: 'underline' }}>A</Text>bsent/<Text style={{ textDecoration: 'underline' }}>P</Text>resent
        </Text>
        <Text style={{ color: ATTENDANCE_FRONT_STYLE.dayLabelColor, fontSize: ATTENDANCE_FRONT_STYLE.dayLabelFontSize * typeScale, lineHeight: ATTENDANCE_FRONT_STYLE.lineHeight }}>
          [Day 1] [Day 2] [Day 3] [Day 4] [Day 5] [Day 6] [Day 7] [Day 8] [Day 9] [Day 10] [Day 11] [Day 12] [Day 13] [Day 14]
        </Text>
      </View>
      {template.columns.map((column, cell) => <View key={`${column.text}-${cell}`} style={{
        width: model.columnWidths.skills[cell],
        borderRightWidth: cell === template.columns.length - 1 ? 0 : borderWidth,
      }} />)}
    </View>)}
  </View>
}

function MetadataLine({ label, value, fontSize }: { label: string; value: string; fontSize: number }) {
  return <Text style={{ fontSize, lineHeight: ATTENDANCE_FRONT_STYLE.lineHeight }}>
    <Text style={{ fontWeight: 700 }}>{label}: </Text>{value}
  </Text>
}

function RichLine({ line, densityScale }: { line: AttendanceRichLine; densityScale: number }) {
  const marker = line.marker === 'bullet' ? '•' : line.marker === 'dash' ? '-' : ''
  const indent = line.indentLevel * ATTENDANCE_BACK_STYLE.bulletIndent * densityScale
  const markerWidth = marker ? ATTENDANCE_BACK_STYLE.bulletIndent * densityScale : 0
  return <View style={{ flexDirection: 'row', paddingLeft: indent }}>
    {marker ? <Text style={{ width: markerWidth }}>{marker}</Text> : null}
    <Text style={{ flex: 1 }}>
      {line.spans.map((span, index) => <Text key={index} style={{ fontWeight: span.bold ? 700 : 400 }}>{span.text}</Text>)}
    </Text>
  </View>
}

function AssessmentBlock({ block, densityScale }: { block: AttendanceBackBlock; densityScale: number }) {
  return <View wrap={false} style={{ marginBottom: ATTENDANCE_BACK_STYLE.blockMarginBottom * densityScale }}>
    {block.lines.map((line, index) => <RichLine key={index} line={line} densityScale={densityScale} />)}
  </View>
}

function AssessmentBackSheet({ page, paired }: { page: AttendanceAssessmentBackPage; paired: boolean }) {
  const { columns, densityScale } = buildAttendanceBackModel(page, paired)
  const columnWidth = (ATTENDANCE_PRINTABLE.width - ATTENDANCE_BACK_STYLE.columnGap * 2) / 3
  return <View wrap={false} style={{ width: ATTENDANCE_PRINTABLE.width, flexDirection: 'row' }}>
    {columns.map((blocks, columnIndex) => <View key={columnIndex} style={{
      width: columnWidth,
      marginRight: columnIndex < 2 ? ATTENDANCE_BACK_STYLE.columnGap : 0,
      paddingHorizontal: ATTENDANCE_BACK_STYLE.cellPadding * densityScale,
      fontSize: ATTENDANCE_BACK_STYLE.fontSize * densityScale,
      lineHeight: ATTENDANCE_BACK_STYLE.lineHeight,
    }}>
      {blocks.map((block, blockIndex) => <AssessmentBlock key={blockIndex} block={block} densityScale={densityScale} />)}
    </View>)}
  </View>
}

function PrivateCatalogBackSheet({ page, paired }: { page: AttendancePrivateBackPage; paired: boolean }) {
  const { columns, densityScale } = buildAttendanceBackModel(page, paired)
  const columnWidth = (ATTENDANCE_PRINTABLE.width - ATTENDANCE_PRIVATE_STYLE.columnGap * 2) / 3
  return <View wrap={false} style={{ width: ATTENDANCE_PRINTABLE.width, flexDirection: 'row' }}>
    {columns.map((blocks, columnIndex) => <View key={columnIndex} style={{
      width: columnWidth,
      marginRight: columnIndex < 2 ? ATTENDANCE_PRIVATE_STYLE.columnGap : 0,
      fontSize: ATTENDANCE_PRIVATE_STYLE.fontSize * densityScale,
      lineHeight: ATTENDANCE_PRIVATE_STYLE.lineHeight,
    }}>
      {blocks.map((block, blockIndex) => <View key={blockIndex} wrap={false} style={{ marginBottom: ATTENDANCE_PRIVATE_STYLE.blockMarginBottom * densityScale }}>
        <Text style={{ fontWeight: 700 }}>{block.title}</Text>
        {block.entries.map((entry, entryIndex) => <Text key={entryIndex}>- {entry}</Text>)}
      </View>)}
    </View>)}
  </View>
}

function BackSheet({ item, paired }: { item: AttendancePdfItem; paired: boolean }) {
  const backPage = getAttendanceTemplate(item.template).backPage
  return backPage.kind === 'private-catalog'
    ? <PrivateCatalogBackSheet page={backPage} paired={paired} />
    : <AssessmentBackSheet page={backPage} paired={paired} />
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

export function AttendanceDocument({ items, title, session }: { items: AttendancePdfItem[]; title: string; session?: string }) {
  return <Document title={title} author="DeckSupervisor" creator="DeckSupervisor" producer="DeckSupervisor" creationDate={new Date()}>
    {groupAttendanceItems(items).flatMap((group, groupIndex) => {
      const paired = group.length === 2
      return [
        <Page key={`front-${groupIndex}`} size={[ATTENDANCE_PAGE.width, ATTENDANCE_PAGE.height]} style={styles.page}>
          {group.map((item, index) => <View key={index} style={index ? { marginTop: ATTENDANCE_PAIR.gap } : undefined}><FrontSheet item={item} session={session} paired={paired} /></View>)}
        </Page>,
        <Page key={`back-${groupIndex}`} size={[ATTENDANCE_PAGE.width, ATTENDANCE_PAGE.height]} style={styles.page}>
          {group.map((item, index) => <View key={index} style={index ? { marginTop: ATTENDANCE_PAIR.gap } : undefined}><BackSheet item={item} paired={paired} /></View>)}
        </Page>,
      ]
    })}
  </Document>
}
