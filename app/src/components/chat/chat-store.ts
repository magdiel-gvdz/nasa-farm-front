import { create } from 'zustand'
import type { ChatMessage, SuitabilityDetail, SuitabilityMatrix, Strategy, RotationResponse } from '@/api/types'

export type ChatCard = { card: 'suitability'; payload: SuitabilityDetail } | { card: 'rotations'; payload: Strategy | RotationResponse } | { card: 'suitability_matrix'; payload: SuitabilityMatrix } | { card: 'greenhouse' | 'water'; payload: unknown }
export type ThreadMessage = ChatMessage & { cards?: ChatCard[]; error?: string }

interface ChatState {
  open: boolean
  pending: string | null
  threads: Record<string, ThreadMessage[]>
  setOpen: (o: boolean) => void
  ask: (q: string) => void
  consume: () => string | null
  update: (fieldId: string, fn: (msgs: ThreadMessage[]) => ThreadMessage[]) => void
}

export const useChat = create<ChatState>((set, get) => ({
  open: false,
  pending: null,
  threads: {},
  setOpen: (open) => set({ open }),
  ask: (q) => set({ open: true, pending: q }),
  consume: () => {
    const p = get().pending
    if (p) set({ pending: null })
    return p
  },
  update: (fieldId, fn) => set((s) => ({ threads: { ...s.threads, [fieldId]: fn(s.threads[fieldId] ?? []) } })),
}))
