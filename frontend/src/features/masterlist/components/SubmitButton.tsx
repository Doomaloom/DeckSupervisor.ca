import React from 'react'

type SubmitButtonProps = {
  isSubmitting: boolean
}

function SubmitButton({ isSubmitting }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      className="w-full rounded-2xl bg-secondary px-4 py-3 text-2xl font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-primary disabled:opacity-70"
      disabled={isSubmitting}
    >
      {isSubmitting ? 'Processing...' : 'Create Master List'}
    </button>
  )
}

export default SubmitButton
