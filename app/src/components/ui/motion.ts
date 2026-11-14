export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 28 } },
}

export const stagger = (step = 0.06) => ({
  hidden: {},
  show: { transition: { staggerChildren: step } },
})
