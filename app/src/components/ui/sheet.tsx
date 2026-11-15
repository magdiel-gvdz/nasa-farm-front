import { Dialog } from 'radix-ui'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Panel lateral (escritorio) / hoja inferior (móvil) animado. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  wide,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
  wide?: boolean
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                initial={{ x: '100%', opacity: 0.6 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0.6 }}
                transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                className={cn(
                  'fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-2xl outline-none sm:inset-y-2 sm:right-2 sm:rounded-[1.5rem] sm:border',
                  wide ? 'sm:w-[34rem]' : 'sm:w-[28rem]',
                  className,
                )}
              >
                <div className="flex items-start gap-3 border-b border-line px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
                    {description ? <Dialog.Description className="mt-0.5 text-sm text-ink-2">{description}</Dialog.Description> : <Dialog.Description className="sr-only">Panel</Dialog.Description>}
                  </div>
                  <Dialog.Close className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-surface-2" aria-label="Cerrar">
                    <X className="h-4 w-4" />
                  </Dialog.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
