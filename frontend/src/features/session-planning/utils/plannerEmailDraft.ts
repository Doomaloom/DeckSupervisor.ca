import type { PlannerClass, PlannerDataset, PlannerParticipant, PlannerParticipantCallRecord } from '../../../types/app'
import { getPlannerMoveTargetLabel } from '../../../lib/sessionPlanner'
import { dayNames } from './plannerPresentation'

type PlannerEmailDraftArgs = {
    participant: PlannerParticipant
    plannerClass: PlannerClass
    callRecord: PlannerParticipantCallRecord
    dataset: PlannerDataset
    senderName: string
    locationName: string
    callbackPhoneNumber: string
    ccEmail: string
}

function buildPlannerEmailSubject(args: PlannerEmailDraftArgs) {
    return `Course Cancellation for ${args.participant.name}`
}

function buildVoicemailEmailBody(args: PlannerEmailDraftArgs, classDateTime: string, callbackLine: string) {
    return [
        `Hello,`,
        ``,
        `This is ${args.senderName} reaching out from ${args.locationName} about ${args.participant.name}'s ${args.plannerClass.serviceName} class.`,
        ``,
        `We attempted to reach you regarding this class, which is scheduled for ${classDateTime}. Unfortunately, due to low registration, the class has been cancelled. You will receive a full refund for this class.`,
        ``,
        `Please contact us if you need any assistance finding an alternative class that works for you.`,
        ``,
        callbackLine,
        ``,
    ].join('\n')
}

function buildAcceptedAccommodationEmailBody(
    args: PlannerEmailDraftArgs,
    classDateTime: string,
    callbackLine: string,
) {
    return [
        `Hello,`,
        ``,
        `This is ${args.senderName} reaching out from ${args.locationName} about ${args.participant.name}'s ${args.plannerClass.serviceName} class.`,
        ``,
        `Following our conversation about the class scheduled for ${classDateTime}, we have noted the accommodation that works for your child. They will be registered in the alternative class as discussed. If you have not already received it, you will receive a confirmation email for the new class shortly.`,
        ``,
        `Please contact us if you need any further assistance or have any questions.`,
        ``,
        callbackLine,
        ``,
    ].join('\n')
}

function buildNoAccommodationEmailBody(args: PlannerEmailDraftArgs, classDateTime: string, callbackLine: string) {
    return [
        `Hello,`,
        ``,
        `This is ${args.senderName} reaching out from ${args.locationName} about ${args.participant.name}'s ${args.plannerClass.serviceName} class.`,
        ``,
        `Following our conversation about the class scheduled for ${classDateTime}, we understand that the available accommodation options do not work for your child. You will receive a full refund for this class.`,
        ``,
        `Please contact us if you need any further assistance or have any questions.`,
        ``,
        callbackLine,
        ``,
    ].join('\n')
}

function buildPlannedMoveEmailBody(args: PlannerEmailDraftArgs, classDateTime: string, callbackLine: string) {
    const moveTarget = getPlannerMoveTargetLabel(args.dataset, args.plannerClass) || 'a new class time'
    return [
        `Hello,`,
        ``,
        `This is ${args.senderName} reaching out from ${args.locationName} about ${args.participant.name}'s aquatics program, ${args.plannerClass.serviceName}.`,
        ``,
        `This class, currently scheduled for ${classDateTime}, is planned to move to ${moveTarget}.`,
        ``,
        `Please let us know whether this updated class works for your child.`,
        ``,
        callbackLine,
        ``,
        `Thank you,`,
        `${args.locationName}`,
    ].join('\n')
}

function buildCancellationEmailBody(args: PlannerEmailDraftArgs, classDateTime: string, callbackLine: string) {
    const alternativeLine =
        args.callRecord.acceptedAlternativeClassKey || args.callRecord.offeredAlternativeClassKey
            ? `We have alternative class options available and can help review those with you.`
            : `If needed, staff at the centre can help review next steps for the registration.`

    return [
        `Hello,`,
        ``,
        `This is ${args.senderName} reaching out from ${args.locationName} about ${args.participant.name}'s aquatics program, ${args.plannerClass.serviceName}.`,
        ``,
        `Unfortunately, this class scheduled for ${classDateTime} has been cancelled due to low registration or staffing changes.`,
        ``,
        alternativeLine,
        ``,
        callbackLine,
        ``,
        `Thank you,`,
        `${args.locationName}`,
    ].join('\n')
}

function buildPlannerEmailBody(args: PlannerEmailDraftArgs) {
    const classDay = dayNames[args.plannerClass.dayOfWeek] ?? args.plannerClass.dayOfWeek
    const classDateTime = `${classDay} at ${args.plannerClass.eventTime}`
    const callbackLine = args.callbackPhoneNumber
        ? `You can reach us at ${args.callbackPhoneNumber}.`
        : 'You can reach us at the centre.'

    if (args.callRecord.status === 'voicemail') {
        return buildVoicemailEmailBody(args, classDateTime, callbackLine)
    }

    if (args.callRecord.status === 'accepted_alternative') {
        return buildAcceptedAccommodationEmailBody(args, classDateTime, callbackLine)
    }

    if (args.callRecord.status === 'declined_alternatives') {
        return buildNoAccommodationEmailBody(args, classDateTime, callbackLine)
    }

    if (args.plannerClass.planningStatus === 'planned_move') {
        return buildPlannedMoveEmailBody(args, classDateTime, callbackLine)
    }

    return buildCancellationEmailBody(args, classDateTime, callbackLine)
}

export function openPlannerEmailDraft(args: PlannerEmailDraftArgs) {
    const subject = buildPlannerEmailSubject(args)
    const body = buildPlannerEmailBody(args)
    const to = args.participant.email.trim()
    const params: string[] = []
    params.push(`subject=${encodeURIComponent(subject)}`)
    params.push(`body=${encodeURIComponent(body)}`)
    if (args.ccEmail.trim()) {
        params.push(`cc=${encodeURIComponent(args.ccEmail.trim())}`)
    }
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?${params.join('&')}`
    window.location.href = mailtoUrl
}
