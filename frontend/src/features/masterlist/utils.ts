export function optionClass(active: boolean) {
  return [
    'rounded-2xl px-3 py-2 text-base font-semibold transition',
    active
      ? 'border-2 border-dashed border-secondary bg-accent text-secondary'
      : 'bg-secondary text-accent',
    'hover:-translate-y-0.5 hover:bg-accent hover:text-secondary',
  ].join(' ')
}
