import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { SchematicPdfRequest } from '../types'
import {
  buildSchematicMatrix,
  effectiveSchematicScale,
  formatSchematicTime,
} from './schematicModel'

const border = (scale: number) => ({ borderWidth: Math.max(0.35, scale), borderColor: '#000000' })

export function SchematicDocument({ request }: { request: SchematicPdfRequest }) {
  const orientation = request.orientation === 'landscape' ? 'landscape' : 'portrait'
  const model = buildSchematicMatrix(request)
  if (!model) return <Document />
  const scale = effectiveSchematicScale(orientation, model.totalRows, request.scalePercent)
  const printableWidth = orientation === 'landscape' ? 756 : 576
  const timeWeight = 16.5
  const classWeight = 26
  const totalWeight = timeWeight * 2 + classWeight * model.columnCount
  const timeWidth = printableWidth * scale * timeWeight / totalWeight
  const classWidth = printableWidth * scale * classWeight / totalWeight
  const highlighted = (index: number) => Boolean(
    request.highlightInstructor
      && request.selectedInstructor
      && !['none', 'one-each'].includes(request.selectedInstructor)
      && request.instructors?.[index]?.trim().toLowerCase() === request.selectedInstructor.trim().toLowerCase(),
  )
  const styles = StyleSheet.create({
    page: { padding: 18, fontFamily: 'Liberation Sans', color: '#111111' },
    table: { width: printableWidth * scale },
    band: { backgroundColor: '#000000', color: '#ffffff', alignItems: 'center', justifyContent: 'center' },
    row: { flexDirection: 'row' },
    centered: { alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  })
  const cellBorder = border(scale)
  return (
    <Document title="Schematic" author="DeckSupervisor" creator="DeckSupervisor" producer="DeckSupervisor" creationDate={new Date()}>
      <Page size="LETTER" orientation={orientation} style={styles.page}>
        <View style={styles.table}>
          <View style={[styles.band, { height: 30 * scale }, cellBorder]}>
            <Text style={{ fontSize: 20 * scale, fontWeight: 700 }}>{request.title?.trim() || 'Schematic'}</Text>
          </View>
          <View style={{ height: 3.75 * scale }} />
          <View style={[styles.band, { height: 30 * scale }, cellBorder]}>
            <Text style={{ fontSize: 16 * scale, fontWeight: 700 }}>{request.dateRange ?? ''}</Text>
          </View>
          <View style={[styles.row, { height: 30 * scale }]}>
            <View style={[styles.centered, { width: printableWidth * scale / 2 }, cellBorder]}>
              <Text style={{ fontSize: 11 * scale, fontWeight: 600 }}>
                Deck Supervisor:{request.deckSupervisorName?.trim() ? ` ${request.deckSupervisorName.trim()}` : ''}
              </Text>
            </View>
            <View style={[styles.centered, { width: printableWidth * scale / 2 }, cellBorder]}>
              <Text style={{ fontSize: 11 * scale, fontWeight: 600 }}>Cancelled Dates:</Text>
              {request.weeksLabel ? <Text style={{ fontSize: 10 * scale }}>{request.weeksLabel}</Text> : null}
            </View>
          </View>
          <View style={[styles.row, { height: 36 * scale }]}>
            <View style={[styles.centered, { width: timeWidth }, cellBorder]}>
              <Text style={{ fontSize: 11 * scale, fontWeight: 700 }}>TIME</Text>
            </View>
            <View style={{ width: classWidth * model.columnCount }}>
              <View style={[styles.centered, { height: 18 * scale }, cellBorder]}>
                <Text style={{ fontSize: 11 * scale, fontWeight: 700 }}>Instructors / Level</Text>
              </View>
              <View style={[styles.row, { height: 18 * scale }]}>
                {Array.from({ length: model.columnCount }, (_, index) => (
                  <View key={index} style={[
                    styles.centered,
                    { width: classWidth, backgroundColor: highlighted(index) ? '#FFEB3B' : '#ffffff' },
                    cellBorder,
                  ]}>
                    <Text style={{ fontSize: 11 * scale, fontWeight: 600 }}>
                      {request.instructors?.[index]?.trim() || `Instructor ${index + 1}`}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={[styles.centered, { width: timeWidth }, cellBorder]}>
              <Text style={{ fontSize: 11 * scale, fontWeight: 700 }}>TIME</Text>
            </View>
          </View>
          {model.matrix.map((row, rowIndex) => {
            const time = rowIndex % 4 === 0
              ? formatSchematicTime(model.baseMinutes + Math.floor(rowIndex / 4) * 30)
              : ''
            return (
              <View key={rowIndex} style={[styles.row, { height: 15 * scale }]} wrap={false}>
                <View style={[styles.centered, { width: timeWidth }, cellBorder]}>
                  <Text style={{ fontSize: 11 * scale }}>{time}</Text>
                </View>
                {row.map((cell, columnIndex) => (
                  <View
                    key={columnIndex}
                    style={[
                      styles.centered,
                      {
                        width: classWidth,
                        backgroundColor: highlighted(columnIndex)
                          ? '#FFEB3B'
                          : cell.kind === 'empty'
                            ? '#D9D9D9'
                            : cell.color ?? '#ffffff',
                        borderTopWidth: cell.border === 'middle' || cell.border === 'bottom' ? 0 : cellBorder.borderWidth,
                        borderBottomWidth: cell.border === 'middle' || cell.border === 'top' ? 0 : cellBorder.borderWidth,
                        borderLeftWidth: cell.kind === 'empty' ? 0 : cellBorder.borderWidth,
                        borderRightWidth: cell.kind === 'empty' ? 0 : cellBorder.borderWidth,
                        borderColor: '#000000',
                      },
                    ]}
                  >
                    {cell.text ? <Text style={{ fontSize: 11 * scale, lineHeight: 1 }}>{cell.text}</Text> : null}
                  </View>
                ))}
                <View style={[styles.centered, { width: timeWidth }, cellBorder]}>
                  <Text style={{ fontSize: 11 * scale }}>{time}</Text>
                </View>
              </View>
            )
          })}
        </View>
      </Page>
    </Document>
  )
}
