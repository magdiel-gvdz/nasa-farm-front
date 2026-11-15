import { AnimatePresence, motion } from 'motion/react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { type ThemeMode, useTheme } from '@/lib/theme'

const ORDER: ThemeMode[] = ['light', 'dark', 'system']
const META = {
  light: { icon: Sun, label: 'Light mode' },
  dark: { icon: Moon, label: 'Dark mode' },
  system: { icon: Monitor, label: 'Same as system' },
}

export function ThemeToggle() {
  const { mode, setMode } = useTheme()
  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]
  const Icon = META[mode].icon
  return (
    <button
      onClick={() => setMode(next)}
      className="relative grid h-10 w-10 cursor-pointer place-items-center overflow-hidden rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      aria-label={`${META[mode].label}. Change to ${META[next].label.toLowerCase()}`}
      title={META[mode].label}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={mode}
          initial={{ y: 18, rotate: -90, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          exit={{ y: -18, rotate: 90, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        >
          <Icon className="h-[18px] w-[18px]" />
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
