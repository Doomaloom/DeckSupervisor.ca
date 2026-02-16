function RequestsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="relative overflow-hidden rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-md">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-secondary/15" />
        <div className="absolute -bottom-12 left-10 h-24 w-24 rounded-full bg-secondary/10" />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary/70">Requests</p>
          <h2 className="mt-3 text-2xl font-semibold">Requests</h2>
          <p className="mt-2 max-w-2xl text-secondary">
            Request management is coming next. This page will hold incoming team requests and actions.
          </p>
        </div>
      </div>
    </div>
  )
}

export default RequestsPage
