# General Components

Portable React and Tailwind components gathered from the COB Aquatics app style. This folder is intentionally independent from app-specific data such as sessions, rosters, teams, instructors, or CSV imports.

## Reuse In Another Project

1. Copy `src/general-components` into the target React project.
2. Ensure Tailwind is installed and configured.
3. Add the theme tokens from `theme.ts` to the target Tailwind config.
4. Import the Rubik font or replace the font token with the target project font.
5. Import components from the folder index.
6. Use the components with React and Tailwind only; there are no app business-logic dependencies.

## Tailwind Theme

Add these values to `theme.extend` in the target Tailwind config:

```js
extend: {
  colors: {
    primary: '#007acc',
    secondary: '#005f99',
    accent: '#ffffff',
    text: '#333333',
    bg: '#e6f7ff',
    header: '#c45300',
    hover: '#66d9ef',
    danger: '#d64545',
    dangerHover: '#c03636',
  },
  borderRadius: {
    card: '24px',
  },
  fontFamily: {
    sans: ['Rubik', 'sans-serif'],
  },
}
```

Import Rubik in global CSS if you want the same typography:

```css
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap');
```

## Basic Card Form

```tsx
import { ActionButton, Card, Field, TextInput } from './general-components'

export function ProfileForm() {
  return (
    <Card>
      <Field label="First name">
        <TextInput placeholder="First name" />
      </Field>
      <ActionButton>Save</ActionButton>
    </Card>
  )
}
```

## Basic Modal

```tsx
import { ModalShell, TextInput } from './general-components'

export function EditItemModal({
  name,
  handleClose,
  handleNameChange,
}: {
  name: string
  handleClose: () => void
  handleNameChange: React.ChangeEventHandler<HTMLInputElement>
}) {
  return (
    <ModalShell title="Edit item" onClose={handleClose}>
      <TextInput value={name} onChange={handleNameChange} />
    </ModalShell>
  )
}
```

## Available Exports

- `ActionButton`
- `Card`
- `EmptyState`
- `Field`
- `ModalShell`
- `Notice`
- `PageShell`
- `SelectableCard`
- `SegmentedTabs`
- `TextInput`
- `Select` — native select attributes with the same rounded, blue-bordered field style
- `Textarea`
- `cn`
- `generalTheme`
