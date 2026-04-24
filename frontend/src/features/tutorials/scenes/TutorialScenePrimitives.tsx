import React from 'react'

type MockBrowserFrameProps = {
  children: React.ReactNode
  title: string
  activePath?: string
  sessionName?: string
}

export function MockBrowserFrame({ children, title, activePath = '/', sessionName }: MockBrowserFrameProps) {
  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Manage Session', path: '/manage-sessions' },
    { label: 'Schematic', path: '/schematic' },
    { label: 'Rosters', path: '/rosters' },
    { label: 'Print', path: '/print' },
  ]

  return (
    <div className="flex h-full w-full overflow-hidden rounded-[2rem] border border-secondary/20 bg-white shadow-2xl">
      {/* Sidebar */}
      <aside className="flex w-40 flex-col gap-4 bg-primary p-4 text-accent">
        <h1 className="text-[0.8rem] font-bold">DeckSupervisor.ca</h1>
        <div className="flex flex-col gap-1">
          <p className="text-[0.55rem] font-semibold opacity-70">Current Session</p>
          <div className="rounded-xl border border-secondary/30 bg-accent px-2 py-1 text-[0.6rem] text-secondary line-clamp-1">
            {sessionName || 'No session selected'}
          </div>
        </div>
        <nav className="mt-2 flex flex-col gap-1.5">
          {navItems.map(item => (
            <div
              key={item.path}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.65rem] font-semibold ${
                activePath === item.path ? 'bg-accent text-secondary' : 'opacity-80'
              }`}
            >
              {item.label}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden bg-bg">
        <header className="flex h-10 items-center border-b border-secondary/10 bg-accent px-5">
          <h2 className="text-[0.7rem] font-bold text-secondary">{title}</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </main>
    </div>
  )
}

export function MockButton({
  children,
  variant = 'secondary',
  className = '',
}: {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'accent' | 'danger'
  className?: string
}) {
  const variants = {
    primary: 'bg-primary text-white hover:bg-secondary',
    secondary: 'bg-secondary text-accent hover:bg-primary',
    accent: 'border-2 border-secondary/20 bg-accent text-secondary hover:border-secondary',
    danger: 'bg-danger text-accent',
  }

  return (
    <div
      className={`rounded-xl px-3 py-1.5 text-center text-[0.65rem] font-semibold shadow-sm transition ${variants[variant]} ${className}`}
    >
      {children}
    </div>
  )
}

export function MockInput({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[0.55rem] font-bold text-secondary/70 uppercase tracking-wide">{label}</label>
      <div className="rounded-lg border-2 border-secondary/10 bg-accent px-2 py-1.5 text-[0.65rem] text-secondary">
        {value}
      </div>
    </div>
  )
}

export function MockSelect({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[0.55rem] font-bold text-secondary/70 uppercase tracking-wide">{label}</label>
      <div className="flex items-center justify-between rounded-lg border-2 border-secondary bg-bg px-2 py-1.5 text-[0.65rem] text-secondary">
        {value}
        <span className="text-[0.5rem]">▼</span>
      </div>
    </div>
  )
}

export function TutorialCalloutPin({ index, x, y }: { index: number; x: number; y: number }) {
  return (
    <span
      className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-secondary text-xs font-bold text-accent shadow-md z-[60]"
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-hidden="true"
    >
      {index}
    </span>
  )
}

export function TutorialHighlightBox({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return (
    <span
      className="pointer-events-none absolute rounded-2xl border-2 border-dashed border-secondary/80 bg-secondary/10 z-[50]"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
      aria-hidden="true"
    />
  )
}
