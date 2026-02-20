export type NoteTabKey = 'general' | 'recognition' | 'feedback' | 'coaching'
export type ReportTabKey = 'report'
export type TabKey = NoteTabKey | 'todo' | ReportTabKey

export type NoteItem = {
  id: string
  createdAt: string
  text: string
  employeeName?: string
  authorName?: string
  sessionContext?: string
}

export type TodoItem = {
  id: string
  createdAt: string
  text: string
  done: boolean
}

export type InstructorTextEntry = {
  instructor: string
  text: string
}

export type InstructorCoverEntry = {
  instructor: string
  coveredBy: string
  details: string
}

export type ChallengingTimeEntry = {
  time: string
  lessons: string
  description: string
}

export type NewClassLayoutEntry = {
  level: string
  description: string
}

export type SafetyConcernType = 'supervision' | 'guarding' | 'location' | 'equipment' | 'process'

export type SafetyConcernEntry = {
  concernType: SafetyConcernType
  description: string
}

export type DeckSetupEntry = {
  item: string
  description: string
}

export type ParentFeedbackType = 'complaint' | 'question' | 'comment' | 'praise'

export type ParentFeedbackEntry = {
  feedbackType: ParentFeedbackType
  description: string
}

export type AdminWorkEntry = {
  work: string
  description: string
}

export type InitiativeEntry = {
  title: string
  brief: string
}

export type SessionReportData = {
  staff: {
    performance: InstructorTextEntry[]
    strengthWeakness: InstructorTextEntry[]
    successionPlans: string
    instructorCovers: InstructorCoverEntry[]
  }
  lessonStructure: {
    challengingTimes: ChallengingTimeEntry[]
    newClassLayouts: NewClassLayoutEntry[]
  }
  safetyFacility: {
    safetyConcerns: SafetyConcernEntry[]
    maintenanceIssues: DeckSetupEntry[]
    poolDeckWorksWell: DeckSetupEntry[]
    poolDeckImprovements: DeckSetupEntry[]
  }
  parentCustomerFeedback: ParentFeedbackEntry[]
  projectsInitiatives: {
    adminWork: AdminWorkEntry[]
    initiatives: InitiativeEntry[]
  }
}

export type ReportItem = {
  id: string
  createdAt: string
  updatedAt: string
  title: string
  reportData: SessionReportData
  createdBy?: string
  authorName?: string
  sessionContext?: string
}

export type TabConfig = {
  key: TabKey
  label: string
  type: 'note' | 'todo' | 'report'
  showEmployee?: boolean
}
