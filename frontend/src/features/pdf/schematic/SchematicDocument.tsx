import React from 'react'
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { SchematicPdfRequest } from '../types'

const formatMinutes = (value = 0) => {
  const hour24 = Math.floor(value / 60) % 24
  const minutes = value % 60
  const suffix = hour24 >= 12 ? 'PM' : 'AM'
  const hour = hour24 % 12 || 12
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`
}

export function clampSchematicScale(value: number | undefined) {
  if (!Number.isFinite(value)) return 100
  return Math.min(120, Math.max(60, Math.round((value ?? 100) / 5) * 5))
}

export function SchematicDocument({ request }: { request: SchematicPdfRequest }) {
  const orientation = request.orientation === 'landscape' ? 'landscape' : 'portrait'
  const columns = request.columns ?? []
  const instructors = request.instructors ?? []
  const scale = clampSchematicScale(request.scalePercent) / 100
  const selected = request.highlightInstructor ? request.selectedInstructor : ''
  const styles = StyleSheet.create({
    page: { padding: 18, fontFamily: 'Helvetica', color: '#111111' },
    title: { fontSize: 12 * scale, fontWeight: 700, textAlign: 'center' },
    subtitle: { fontSize: 7 * scale, textAlign: 'center', marginTop: 2, marginBottom: 7 },
    board: { flexDirection: 'row', flexGrow: 1, borderWidth: 0.7, borderColor: '#111111' },
    column: { flexGrow: 1, flexBasis: 0, borderRightWidth: 0.5, borderRightColor: '#111111' },
    instructor: { fontSize: 7 * scale, fontWeight: 700, textAlign: 'center', padding: 3, backgroundColor: '#eeeeee' },
    highlighted: { backgroundColor: '#fff2a8' },
    course: { margin: 2, padding: 3, borderWidth: 0.5, borderColor: '#444444', minHeight: 34 * scale },
    code: { fontSize: 7 * scale, fontWeight: 700 },
    detail: { fontSize: 5.5 * scale, marginTop: 1 },
  })
  return (
    <Document title="Schematic" author="DeckSupervisor" creator="DeckSupervisor" producer="DeckSupervisor" creationDate={new Date()}>
      <Page size="LETTER" orientation={orientation} style={styles.page}>
        <Text style={styles.title}>{request.title?.trim() || 'Schematic'}</Text>
        <Text style={styles.subtitle}>{[request.dateRange, request.weeksLabel].filter(Boolean).join(' • ')}</Text>
        <View style={styles.board}>
          {columns.map((courses, columnIndex) => {
            const instructor = instructors[columnIndex] ?? `Instructor ${columnIndex + 1}`
            const highlighted = selected && selected !== 'one-each' && instructor === selected
            return (
              <View key={columnIndex} style={styles.column}>
                <Text style={[styles.instructor, highlighted ? styles.highlighted : {}]}>{instructor}</Text>
                {courses.map((course, courseIndex) => (
                  <View key={`${course.code}-${courseIndex}`} style={styles.course} wrap={false}>
                    <Text style={styles.code}>{course.level || course.code || 'Class'}</Text>
                    <Text style={styles.detail}>
                      {formatMinutes(course.startMinutes)} • {course.durationMinutes ?? 0} min
                    </Text>
                    <Text style={styles.detail}>{course.studentCount ?? 0} of {course.capacity ?? 0}</Text>
                  </View>
                ))}
              </View>
            )
          })}
        </View>
      </Page>
    </Document>
  )
}
