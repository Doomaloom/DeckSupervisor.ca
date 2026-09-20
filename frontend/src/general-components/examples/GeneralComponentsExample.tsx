import { useState } from 'react'
import {
  ActionButton,
  Card,
  EmptyState,
  Field,
  ModalShell,
  Notice,
  PageShell,
  SelectableCard,
  SegmentedTabs,
  Textarea,
  TextInput,
} from '../index'

type ExampleTab = 'overview' | 'details' | 'review'

const tabItems: Array<{ key: ExampleTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'details', label: 'Details' },
  { key: 'review', label: 'Review' },
]

export function GeneralComponentsExample() {
  const [activeTab, setActiveTab] = useState<ExampleTab>('overview')
  const [selectedOption, setSelectedOption] = useState('standard')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <PageShell maxWidth="5xl">
      <Card>
        <h2 className="text-2xl font-semibold text-secondary">General Components</h2>
        <p className="mt-2 text-sm text-secondary/70">
          A standalone sample of the portable COB Aquatics component style.
        </p>
      </Card>

      <Card>
        <SegmentedTabs items={tabItems} activeKey={activeTab} onChange={setActiveTab} />

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Name" helperText="Use this for short text fields.">
            <TextInput value={name} onChange={event => setName(event.target.value)} placeholder="First name" />
          </Field>

          <Field label="Notes">
            <Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Add context" />
          </Field>
        </div>

        <Notice className="mt-6">Current tab: {activeTab}</Notice>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <SelectableCard
            selected={selectedOption === 'standard'}
            onClick={() => setSelectedOption('standard')}
          >
            Standard option
          </SelectableCard>
          <SelectableCard
            selected={selectedOption === 'expanded'}
            onClick={() => setSelectedOption('expanded')}
          >
            Expanded option
          </SelectableCard>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <ActionButton onClick={() => setIsModalOpen(true)}>Open Modal</ActionButton>
          <ActionButton variant="outline">Secondary Action</ActionButton>
          <ActionButton variant="danger">Delete</ActionButton>
        </div>
      </Card>

      <EmptyState title="No routed example">
        This component is intentionally not wired into the application routes.
      </EmptyState>

      {isModalOpen ? (
        <ModalShell
          title="Edit example"
          description="This modal uses the same shell style as the current app."
          onClose={() => setIsModalOpen(false)}
        >
          <div className="mt-6 flex flex-col gap-4">
            <Field label="Modal field">
              <TextInput value={name} onChange={event => setName(event.target.value)} />
            </Field>
            <ActionButton onClick={() => setIsModalOpen(false)}>Done</ActionButton>
          </div>
        </ModalShell>
      ) : null}
    </PageShell>
  )
}
