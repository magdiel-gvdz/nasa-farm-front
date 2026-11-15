import { AnimatePresence, motion } from 'motion/react'
import { Map as MapIcon, Plus, Sprout } from 'lucide-react'
import { Link, useLocation, useOutlet } from 'react-router'
import { isDemoMode } from '@/api/client'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2.5">
      <motion.span
        whileHover={{ rotate: -8, scale: 1.06 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        className="grid h-8 w-8 place-items-center rounded-[10px] bg-accent text-accent-ink"
      >
        <Sprout className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </motion.span>
      <span className="text-[15px] font-semibold tracking-tight text-ink">Field Shift</span>
    </Link>
  )
}

export function AppShell() {
  const location = useLocation()
  const outlet = useOutlet()
  const fullBleed = location.pathname.startsWith('/nueva')
  const onMap = location.pathname.startsWith('/mapa')
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print sticky top-0 z-40 border-b border-line bg-page/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Logo />
          {isDemoMode && (
            <span
              className="hidden items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-2 sm:inline-flex"
              title="Serverless: Weather comes from real NASA POWER; the rest are example estimates."
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              Demo mode
            </span>
          )}
          <div className="flex-1" />
          {!onMap && (
            <Link to="/mapa">
              <Button size="sm" variant="ghost">
                <MapIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Map</span>
              </Button>
            </Link>
          )}
          {!fullBleed && (
            <Link to="/nueva">
              <Button size="sm" variant="primary">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New field</span>
                <span className="sm:hidden">New</span>
              </Button>
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {outlet}
        </motion.main>
      </AnimatePresence>
    </div>
  )
}
