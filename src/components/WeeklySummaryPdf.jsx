// Renders a buildWeeklySummary() result (src/lib/weeklySummary.js) as a PDF
// document, styled to match the app's palette (src/styles.css :root).
// Loaded lazily via downloadSummaryPdf.js so @react-pdf/renderer never ends
// up in the main bundle.
//
// Per US19, status is always shown as a coloured pill *with a text label* —
// never colour alone. Emoji icons aren't used here because react-pdf's
// built-in Helvetica font can't render them.

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { TONE_COLORS } from '../lib/status.js'

const COLORS = {
  teal: '#0F766E',
  mint: '#D1FAE5',
  navy: '#1E293B',
  border: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  warmNeutral: '#FFF7ED',
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 48,
    paddingHorizontal: 32,
    fontSize: 10,
    color: COLORS.textPrimary,
    fontFamily: 'Helvetica',
  },
  header: {
    backgroundColor: COLORS.teal,
    marginHorizontal: -32,
    paddingHorizontal: 32,
    paddingVertical: 20,
    marginBottom: 16,
  },
  headerEyebrow: {
    color: COLORS.mint,
    fontSize: 10,
    marginBottom: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
  },
  headerMeta: {
    color: COLORS.mint,
    fontSize: 10,
    marginTop: 4,
  },
  safetyNotice: {
    backgroundColor: COLORS.warmNeutral,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 8,
    marginBottom: 16,
    fontSize: 9,
    color: COLORS.textSecondary,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.navy,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  overviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: COLORS.mint,
    color: COLORS.teal,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  attentionCard: {
    borderWidth: 1,
    borderColor: TONE_COLORS.attention.border,
    backgroundColor: TONE_COLORS.attention.bg,
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
  },
  attentionTitle: {
    fontFamily: 'Helvetica-Bold',
    color: TONE_COLORS.attention.text,
    fontSize: 10,
  },
  attentionMeta: {
    color: COLORS.textSecondary,
    fontSize: 9,
    marginTop: 2,
  },
  emptyState: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontStyle: 'italic',
  },
  dayBlock: {
    marginBottom: 8,
  },
  dayLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: COLORS.navy,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  rowTime: {
    width: 48,
    color: COLORS.textSecondary,
    fontSize: 9,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 10,
    color: COLORS.textPrimary,
  },
  rowSub: {
    fontSize: 8,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  pill: {
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  medCard: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  medName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  medSchedule: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  medCounts: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  careCircleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 32,
    right: 32,
    fontSize: 8,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
})

function Pill({ label, tone }) {
  const colors = TONE_COLORS[tone] || TONE_COLORS.normal
  return (
    <Text style={[styles.pill, { backgroundColor: colors.bg, color: colors.text }]}>
      {label}
    </Text>
  )
}

function summariseCounts(counts, labels) {
  return Object.entries(counts)
    .map(([status, count]) => `${count} ${labels?.[status] || status}`)
    .join(' · ')
}

function SectionHeading({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>
}

function NeedsAttentionSection({ needsAttention }) {
  return (
    <View style={styles.section} wrap={false}>
      <SectionHeading>Needs attention ({needsAttention.length})</SectionHeading>
      {needsAttention.length === 0 ? (
        <Text style={styles.emptyState}>Nothing outstanding was recorded this week.</Text>
      ) : (
        needsAttention.map((alert) => (
          <View key={alert.id} style={styles.attentionCard}>
            <Text style={styles.attentionTitle}>{alert.title}</Text>
            <Text style={styles.attentionMeta}>{alert.when}</Text>
            <Text style={styles.attentionMeta}>{alert.why}</Text>
          </View>
        ))
      )}
    </View>
  )
}

function MedicationSection({ medications }) {
  return (
    <View style={styles.section}>
      <SectionHeading>Medication</SectionHeading>
      {medications.length === 0 ? (
        <Text style={styles.emptyState}>No medication scheduled this week.</Text>
      ) : (
        medications.map((med) => (
          <View key={med.name} style={styles.medCard} wrap={false}>
            <Text style={styles.medName}>{med.name}</Text>
            {med.schedule && <Text style={styles.medSchedule}>{med.schedule}</Text>}
            <Text style={styles.medCounts}>
              {med.doseCount} doses recorded this week · {summariseCounts(med.counts)}
            </Text>
            {med.exceptions.map((exception, idx) => (
              <View key={idx} style={styles.row}>
                <Text style={styles.rowTime}>{exception.when.split(', ')[1]}</Text>
                <View style={styles.rowBody}>
                  <Text style={styles.rowSub}>{exception.when}{exception.why ? ` — ${exception.why}` : ''}</Text>
                </View>
                <Pill label={exception.label} tone={exception.tone} />
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  )
}

function DaySectionList({ title, days, emptyText }) {
  return (
    <View style={styles.section}>
      <SectionHeading>{title}</SectionHeading>
      {days.length === 0 ? (
        <Text style={styles.emptyState}>{emptyText}</Text>
      ) : (
        days.map((day) => (
          <View key={day.day} style={styles.dayBlock} wrap={false}>
            <Text style={styles.dayLabel}>{day.day}</Text>
            {day.items.map((item, idx) => (
              <View key={idx} style={styles.row}>
                <Text style={styles.rowTime}>{item.time}</Text>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowSub}>
                    {item.assignedTo ? `Assigned to ${item.assignedTo}` : ''}
                    {item.notes ? ` — ${item.notes}` : ''}
                  </Text>
                </View>
                <Pill label={item.label} tone={item.tone} />
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  )
}

function GoogleEventsSection({ events }) {
  if (events.length === 0) return null
  return (
    <View style={styles.section}>
      <SectionHeading>Google Calendar</SectionHeading>
      {events.map((event, idx) => (
        <View key={idx} style={styles.row}>
          <Text style={styles.rowTime}>{event.when.split(', ')[1]}</Text>
          <Text style={styles.rowBody}>{event.title}</Text>
        </View>
      ))}
    </View>
  )
}

function ActivitySection({ activity }) {
  return (
    <View style={styles.section}>
      <SectionHeading>Activity log</SectionHeading>
      {activity.length === 0 ? (
        <Text style={styles.emptyState}>No activity recorded this week.</Text>
      ) : (
        activity.map((entry, idx) => (
          <View key={idx} style={styles.row}>
            <Text style={styles.rowTime}>{entry.when.split(', ')[1]}</Text>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{entry.who}: {entry.what}</Text>
              {(entry.why || entry.outcome) && (
                <Text style={styles.rowSub}>{[entry.why, entry.outcome].filter(Boolean).join(' — ')}</Text>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  )
}

function CareCircleSection({ careCircle }) {
  if (!careCircle || careCircle.length === 0) return null
  return (
    <View style={styles.section}>
      <SectionHeading>Care circle</SectionHeading>
      {careCircle.map((person) => (
        <View key={person.id} style={styles.careCircleRow}>
          <Text>{person.name} · {person.role} ({person.relationship})</Text>
          <Text style={{ color: COLORS.textSecondary }}>{person.phone}</Text>
        </View>
      ))}
    </View>
  )
}

export default function WeeklySummaryPdf({ summary }) {
  const medicationLabels = { taken: 'taken', due: 'due', unknown: 'unrecorded', missed: 'missed', declined: 'declined' }
  const visitLabels = { complete: 'complete', scheduled: 'scheduled' }
  const taskLabels = { complete: 'complete', attention: 'need attention', normal: 'on track' }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.headerEyebrow}>CareShare · Weekly care summary</Text>
          <Text style={styles.headerTitle}>{summary.person?.name || 'Care plan'}'s week</Text>
          <Text style={styles.headerMeta}>
            {summary.range.label} · Generated {summary.generatedAt.toLocaleDateString('en-GB')} at{' '}
            {summary.generatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        <Text style={styles.safetyNotice}>
          This summary reflects only entries recorded in CareShare. It is not medical advice and does not diagnose,
          recommend, or interpret any condition. Review the original entries for full context.
        </Text>

        <View style={styles.section}>
          <SectionHeading>Overview</SectionHeading>
          <View style={styles.overviewRow}>
            <Text style={styles.chip}>Medication: {summariseCounts(summary.overview.medication, medicationLabels) || 'none scheduled'}</Text>
            <Text style={styles.chip}>Visits: {summariseCounts(summary.overview.visits, visitLabels) || 'none scheduled'}</Text>
            <Text style={styles.chip}>Tasks: {summariseCounts(summary.overview.tasks, taskLabels) || 'none scheduled'}</Text>
            <Text style={styles.chip}>Needs attention: {summary.overview.needsAttentionCount}</Text>
          </View>
        </View>

        <NeedsAttentionSection needsAttention={summary.needsAttention} />
        <MedicationSection medications={summary.medications} />
        <DaySectionList title="Visits & appointments" days={summary.visits} emptyText="No visits scheduled this week." />
        <DaySectionList title="Tasks" days={summary.tasks} emptyText="No tasks scheduled this week." />
        <GoogleEventsSection events={summary.googleEvents} />
        <ActivitySection activity={summary.activity} />
        <CareCircleSection careCircle={summary.careCircle} />

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `Generated by CareShare from recorded entries · Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}
