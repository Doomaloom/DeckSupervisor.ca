import { describe, expect, it } from 'vitest'
import type { PlannerDataset } from '../types/app'
import {
    applyPlannerSaveState,
    buildPlannerSaveState,
    getPlannerCallScriptKey,
    markPlannerDayClosureCalls,
    renderPlannerCallScript,
    updatePlannerCallScripts,
} from './sessionPlanner'

function buildDataset(): PlannerDataset {
    return {
        sourceFileName: 'planner.csv',
        importedAt: '2026-04-24T00:00:00.000Z',
        callScripts: {
            cancellation_live: '',
            cancellation_voicemail: '',
            planned_move_live: '',
            planned_move_voicemail: '',
            pool_closure: 'Hi {studentName}, {className} at {time} on {day} is closed. Call {callbackPhone}. {unknownToken}',
        },
        sessions: [
            {
                sessionKey: 'Sa|Spring|2026|Main Pool',
                dayOfWeek: 'Sa',
                sessionSeason: 'Spring',
                sessionYear: 2026,
                facility: 'Main Pool',
                classKeys: ['class-1', 'class-2'],
            },
            {
                sessionKey: 'Su|Spring|2026|Main Pool',
                dayOfWeek: 'Su',
                sessionSeason: 'Spring',
                sessionYear: 2026,
                facility: 'Main Pool',
                classKeys: ['class-3'],
            },
        ],
        classes: [
            {
                classKey: 'class-1',
                eventId: 'A1',
                sessionKey: 'Sa|Spring|2026|Main Pool',
                serviceName: 'Splash 1',
                dayOfWeek: 'Sa',
                eventTime: '09:00 AM - 09:30 AM',
                facility: 'Main Pool',
                sessionSeason: 'Spring',
                sessionYear: 2026,
                minimumCapacity: 4,
                maximumCapacity: 8,
                bookedCount: 1,
                waitlistCount: 1,
                participantIds: ['p1'],
                waitingParticipantIds: ['p2'],
                laneIndex: 0,
                planningStatus: 'active',
                plannedMoveType: '',
                plannedMoveTime: '',
                plannedMoveTargetClassKey: '',
                barcodeCancelledAt: '',
            },
            {
                classKey: 'class-2',
                eventId: 'A2',
                sessionKey: 'Sa|Spring|2026|Main Pool',
                serviceName: 'Splash 2',
                dayOfWeek: 'Sa',
                eventTime: '10:00 AM - 10:30 AM',
                facility: 'Main Pool',
                sessionSeason: 'Spring',
                sessionYear: 2026,
                minimumCapacity: 4,
                maximumCapacity: 8,
                bookedCount: 0,
                waitlistCount: 1,
                participantIds: [],
                waitingParticipantIds: ['p3'],
                laneIndex: 0,
                planningStatus: 'active',
                plannedMoveType: '',
                plannedMoveTime: '',
                plannedMoveTargetClassKey: '',
                barcodeCancelledAt: '',
            },
            {
                classKey: 'class-3',
                eventId: 'A3',
                sessionKey: 'Su|Spring|2026|Main Pool',
                serviceName: 'Splash 1',
                dayOfWeek: 'Su',
                eventTime: '09:00 AM - 09:30 AM',
                facility: 'Main Pool',
                sessionSeason: 'Spring',
                sessionYear: 2026,
                minimumCapacity: 4,
                maximumCapacity: 8,
                bookedCount: 1,
                waitlistCount: 0,
                participantIds: ['p4'],
                waitingParticipantIds: [],
                laneIndex: 0,
                planningStatus: 'active',
                plannedMoveType: '',
                plannedMoveTime: '',
                plannedMoveTargetClassKey: '',
                barcodeCancelledAt: '',
            },
        ],
        participants: [
            {
                id: 'p1',
                classKey: 'class-1',
                eventId: 'A1',
                serviceName: 'Splash 1',
                name: 'Alex Doe',
                phone: '555',
                email: 'alex@example.test',
                age: '7',
                attendeeStatus: 'booked',
            },
        ],
        callRecords: {
            p1: {
                participantId: 'p1',
                classKey: 'class-1',
                status: 'not_started',
                notes: '',
                offeredAlternativeClassKey: '',
                acceptedAlternativeClassKey: '',
                completedAt: '',
                emailSentAt: '',
                withdrawRefundAt: '',
                refundReceiptSentAt: '',
                reRegisteredAt: '',
                registrationConfirmationSentAt: '',
            },
        },
    }
}

describe('session planner closure calls', () => {
    it('marks only booked classes in the selected day and location for closure calls', () => {
        const next = markPlannerDayClosureCalls(buildDataset(), 'Sa', 'Main Pool')

        expect(next.classes.find(plannerClass => plannerClass.classKey === 'class-1')?.planningStatus).toBe(
            'pending_closure_calls',
        )
        expect(next.classes.find(plannerClass => plannerClass.classKey === 'class-2')?.planningStatus).toBe('active')
        expect(next.classes.find(plannerClass => plannerClass.classKey === 'class-3')?.planningStatus).toBe('active')
        expect(next.callRecords.p1.status).toBe('not_started')
    })

    it('renders custom closure call scripts with supported tokens and leaves unknown tokens visible', () => {
        const dataset = buildDataset()
        const rendered = renderPlannerCallScript({
            callScripts: dataset.callScripts,
            scriptKey: 'pool_closure',
            participant: dataset.participants[0],
            plannerClass: dataset.classes[0],
            callerName: 'Sam',
            locationName: 'Community Pool',
            callbackPhoneNumber: '905-555-1234',
            moveDestination: '',
        })

        expect(rendered).toContain('Alex Doe')
        expect(rendered).toContain('Splash 1')
        expect(rendered).toContain('09:00 AM - 09:30 AM')
        expect(rendered).toContain('Saturday')
        expect(rendered).toContain('905-555-1234')
        expect(rendered).toContain('{unknownToken}')
    })

    it('round trips closure status and script through planner save state', () => {
        const dataset = updatePlannerCallScripts(
            markPlannerDayClosureCalls(buildDataset(), 'Sa', 'Main Pool'),
            {
                cancellation_live: '',
                cancellation_voicemail: '',
                planned_move_live: '',
                planned_move_voicemail: '',
                pool_closure: 'Closure script {studentName}',
            },
        )
        const state = buildPlannerSaveState({
            dataset,
            shareDisplayName: 'Host',
            locationOverrides: {},
            callbackPhoneNumber: '',
            selectedDay: 'Sa',
            selectedLocation: 'Main Pool',
            selectedClassKey: 'class-1',
        })
        const restored = applyPlannerSaveState(buildDataset(), state)

        expect(restored.dataset.callScripts.pool_closure).toBe('Closure script {studentName}')
        expect(restored.dataset.classes.find(plannerClass => plannerClass.classKey === 'class-1')?.planningStatus).toBe(
            'pending_closure_calls',
        )
    })

    it('selects editable scripts for each call workflow and mode', () => {
        const dataset = buildDataset()
        const cancellationClass = dataset.classes[0]
        const closureClass = { ...dataset.classes[0], planningStatus: 'pending_closure_calls' as const }
        const moveClass = { ...dataset.classes[0], planningStatus: 'planned_move' as const }

        expect(getPlannerCallScriptKey(cancellationClass, 'live')).toBe('cancellation_live')
        expect(getPlannerCallScriptKey(cancellationClass, 'voicemail')).toBe('cancellation_voicemail')
        expect(getPlannerCallScriptKey(moveClass, 'live')).toBe('planned_move_live')
        expect(getPlannerCallScriptKey(moveClass, 'voicemail')).toBe('planned_move_voicemail')
        expect(getPlannerCallScriptKey(closureClass, 'live')).toBe('pool_closure')
        expect(getPlannerCallScriptKey(closureClass, 'voicemail')).toBe('pool_closure')
    })
})
