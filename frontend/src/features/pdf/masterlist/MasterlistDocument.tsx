import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { MasterlistPdfRequest } from '../types'
import { buildMasterlistRows, buildMasterlistTitle, normalizeMasterlistFontSize } from './masterlistModel'

export const masterlistColumnWeights = [11, 22, 14, 18, 24, 8, 20] as const
const weightTotal = masterlistColumnWeights.reduce((sum, weight) => sum + weight, 0)
const widths = masterlistColumnWeights.map(weight => `${(weight / weightTotal) * 100}%`)
const headers = ['EventID', 'EventTime', 'Instructor', 'ServiceName', 'AttendeeName', 'Age', 'AttendeePhone']
export const cssPixelsToPoints = (value: number) => value * 0.75

export function MasterlistDocument({ request }: { request: MasterlistPdfRequest }) {
  const rows = buildMasterlistRows(request.rosters, request.options)
  const title = buildMasterlistTitle(request)
  const fontSize = cssPixelsToPoints(normalizeMasterlistFontSize(request.options.font_size))
  const border = request.options.borders ? 1 : 0
  const styles = StyleSheet.create({
    page: { padding: 25.2, fontFamily: 'Liberation Sans', color: '#111111' },
    title: { fontSize: 10.5, fontWeight: 700, textAlign: 'center', marginBottom: 6 },
    row: { flexDirection: 'row' },
    header: { fontWeight: 700 },
    cell: {
      paddingTop: 2.25,
      paddingBottom: 2.25,
      paddingLeft: 4.5,
      paddingRight: 4.5,
      fontSize,
      lineHeight: 1.2,
      borderWidth: border,
      borderColor: '#000000',
    },
    group: {
      paddingTop: 2.25,
      paddingBottom: 2.25,
      paddingLeft: 4.5,
      paddingRight: 4.5,
      fontSize,
      lineHeight: 1.2,
      backgroundColor: '#f4f4f4',
      borderWidth: border,
      borderColor: '#000000',
    },
  })
  return (
    <Document title="Masterlist" author="DeckSupervisor" creator="DeckSupervisor" producer="DeckSupervisor" creationDate={new Date()}>
      <Page size="LETTER" style={styles.page} wrap>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <View style={[styles.row, styles.header]} fixed>
          {headers.map((header, index) => (
            <Text key={header} style={[styles.cell, { width: widths[index], textAlign: index === 5 ? 'center' : 'left' }]}>{header}</Text>
          ))}
        </View>
        {rows.map((row, rowIndex) => {
          if (row.kind === 'data') {
            return (
              <View key={rowIndex} style={styles.row} wrap={false}>
                {row.cells.map((cell, index) => (
                  <Text key={index} style={[styles.cell, { width: widths[index], textAlign: index === 5 ? 'center' : 'left' }]}>{cell}</Text>
                ))}
              </View>
            )
          }
          const isTime = row.kind === 'time'
          const isAlphabetical = row.kind === 'alphabetical'
          return (
            <Text
              key={rowIndex}
              minPresenceAhead={isAlphabetical ? fontSize * 2.3 : 0}
              style={[
                styles.group,
                {
                  fontWeight: isAlphabetical
                    ? 700
                    : isTime
                      ? (request.options.bold_time ? 700 : 400)
                      : (request.options.bold_course ? 700 : 400),
                  textAlign: isAlphabetical
                    ? 'left'
                    : isTime
                      ? (request.options.center_time ? 'center' : 'left')
                      : (request.options.center_course ? 'center' : 'left'),
                },
              ]}
              wrap={false}
            >
              {row.label}
            </Text>
          )
        })}
      </Page>
    </Document>
  )
}
