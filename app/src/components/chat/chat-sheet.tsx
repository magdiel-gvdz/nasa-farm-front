import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp, Check, Loader2, MessageCircle, Sparkles, Sprout } from 'lucide-react'
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { getApi, isDemoMode } from '@/api/client'
import { ApiError } from '@/api/errors'
import type { Field, RotationResponse, Strategy, SuitabilityDetail } from '@/api/types'
import { useCrops } from '@/hooks/api'
import { Sheet } from '@/components/ui/sheet'
import { Chip, StatusPill } from '@/components/ui/status'
import { suitLabel, suitToLevel } from '@/lib/status'
import { cn } from '@/lib/cn'
import { monthName } from '@/lib/format'
import { type ChatCard, type ThreadMessage, useChat } from './chat-store'

/** Markdown mínimo: **negritas**, viñetas "- " y saltos de línea. */
function RichText({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <b key={i} className="font-semibold text-ink">{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>))
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={blocks.length} className="my-1.5 space-y-1">
          {list.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-muted" />
              <span>{inline(l)}</span>
            </li>
          ))}
        </ul>,
      )
      list = []
    }
  }
  for (const line of text.split('\n')) {
    if (line.startsWith('- ')) list.push(line.slice(2))
    else {
      flush()
      if (line.trim()) blocks.push(<p key={blocks.length} className="my-1.5">{inline(line)}</p>)
    }
  }
  flush()
  return <>{blocks}</>
}

function CardView({ card }: { card: ChatCard }) {
  const catalog = useCrops()
  const CROP_BY_ID = new Map((catalog.data ?? []).map((c) => [c.id, c]))
  if (card.card === 'suitability') {
    const d = card.payload as SuitabilityDetail
    const crop = CROP_BY_ID.get(d.crop_id)
    return (
      <div className="mt-2 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
        <span className="text-2xl" aria-hidden>
          {crop?.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">
            {crop?.name.en} · {d.perennial ? 'plant in ' : ''}
            <span className={d.perennial ? '' : 'capitalize'}>{monthName(d.planting_month)}</span>
          </div>
          <div className="text-xs text-muted">{d.score}/100</div>
        </div>
        <StatusPill level={suitToLevel(d.status)} label={suitLabel(d.status)} />
      </div>
    )
  }
  if (card.card === 'rotations') {
    const payload = card.payload as Strategy | RotationResponse
    const s = 'strategies' in payload ? payload.strategies.find((s) => s.id === payload.recommended_id) : payload
    if (!s) return null
    return (
      <div className="mt-2 rounded-2xl border border-line bg-surface p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Sparkles className="h-4 w-4 text-accent" /> {s.name}
          <span className="ml-auto text-xs font-normal text-muted">{s.scores.overall}/100</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {s.sequence
            .filter((x) => x.year <= 2)
            .map((x, i) => (
              <Chip key={i}>{x.crop_id ? `${CROP_BY_ID.get(x.crop_id)?.emoji} ${CROP_BY_ID.get(x.crop_id)?.name.en.split(' ')[0]}` : 'Fallow'}</Chip>
            ))}
        </div>
      </div>
    )
  }
  if (card.card === 'suitability_matrix') return <div className="mt-2 rounded-xl border border-line p-3 text-sm">Crop assessment: {card.payload.crops.length} crops across {card.payload.months.length} planting months. Open the What to plant tab for the full matrix.</div>
  return null
}

// Referencia estable: un `[]` nuevo en el selector de zustand provoca renders infinitos.
const NO_MESSAGES: ThreadMessage[] = []

function suggestions(field: Field) {
  if (!isDemoMode) return ['When do I plant beans?', 'Which rotation is best for me?', 'How much risk of frost is there?', 'How is my soil?', 'What happens with 2 degrees more heat and 20% less rain?']
  if (field.kind === 'greenhouse') return ['Can my greenhouse withstand the wind?', 'When do I plant tomatoes?', 'How much risk of frost is there?', 'How will the climate change by 2040?']
  return ['When do I plant beans?', 'Which rotation is best for me?', 'How will the climate change by 2040?', 'How much risk of frost is there?', 'How is my soil?', ...(field.livestock ? ['Is the water safe for my cows?'] : [])]
}

function ChatBody({ field }: { field: Field; ready: boolean }) {
  const msgs = useChat((s) => s.threads[field.id] ?? NO_MESSAGES)
  const update = useChat((s) => s.update)
  const consume = useChat((s) => s.consume)
  const pending = useChat((s) => s.pending)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(!isDemoMode)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [status, setStatus] = useState('Thinking...')
  const [retryAt, setRetryAt] = useState<number | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    void getApi().then(async (api) => {
      if (useChat.getState().threads[field.id]?.length) return
      const history = await api.getChatHistory?.(field.id, controller.signal)
      if (!active || !history) return
      update(field.id, (existing) => existing.length ? existing : history.messages.map((m, i) => ({
        id: m.message_id ?? `history-${i}`, role: m.role === 'user' ? 'user' : 'assistant', content: m.text,
        cards: m.cards.map((c) => ({ card: c.type, payload: c.payload }) as ChatCard), citations: m.citations,
        error: m.status === 'failed' ? 'This response did not finish.' : undefined,
      })))
    }).catch((error: Error) => { if (active) setHistoryError(error.message) }).finally(() => { if (active) setLoadingHistory(false) })
    return () => { active = false; controller.abort() }
  }, [field.id, update])

  useEffect(() => {
    if (retryAt == null) return
    const timer = setTimeout(() => setRetryAt(null), Math.max(0, retryAt - Date.now()))
    return () => clearTimeout(timer)
  }, [retryAt])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [msgs])

  const send = useCallback(
    async (text: string) => {
      const q = text.trim()
      if (!q || busy || loadingHistory || retryAt != null || q.length > 2000) return
      setInput('')
      setBusy(true)
      const id = crypto.randomUUID()
      update(field.id, (m) => [...m, { id: crypto.randomUUID(), role: 'user', content: q }, { id, role: 'assistant', content: '', tools: [], citations: [], cards: [] }])
      const patch = (fn: (m: ThreadMessage) => ThreadMessage) => update(field.id, (ms) => ms.map((m) => (m.id === id ? fn(m) : m)))
      abort.current = new AbortController()
      try {
        const api = await getApi()
        await api.chat(
          field.id,
          q,
          (e) => {
            if (e.type === 'status') setStatus(e.label ?? 'Thinking...')
            else if (e.type === 'tool')
              patch((m) => {
                const tools = [...(m.tools ?? [])]
                const i = tools.findIndex((t) => t.name === e.name)
                if (i >= 0) tools[i] = { ...tools[i], state: e.state }
                else tools.push({ name: e.name, label: e.label, state: e.state })
                return { ...m, tools }
              })
            else if (e.type === 'text') patch((m) => ({ ...m, content: m.content + e.delta }))
            else if (e.type === 'citation') patch((m) => ({ ...m, citations: [...(m.citations ?? []), { source_id: e.source_id, label: e.label }] }))
            else if (e.type === 'card') patch((m) => ({ ...m, cards: [...(m.cards ?? []), { card: e.card, payload: e.payload } as ChatCard] }))
            else if (e.type === 'error') patch((m) => ({ ...m, error: e.message }))
          },
          abort.current.signal,
        )
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          const message = err instanceof Error ? err.message : 'Could not respond. Try again.'
          if (err instanceof ApiError && err.retryAfter) setRetryAt(Date.now() + err.retryAfter * 1000)
          patch((m) => ({ ...m, error: err instanceof ApiError && err.code === 'conversation_full' ? `${message} Start a new conversation below.` : message }))
        }
      } finally {
        setBusy(false)
      }
    },
    [busy, field.id, loadingHistory, retryAt, update],
  )

  // Pregunta enviada desde otra parte de la app (p. ej. "Preguntar al agrónomo").
  useEffect(() => {
    if (!pending || busy || loadingHistory || retryAt != null) return
    const t = setTimeout(() => {
      const q = consume()
      if (q) void send(q)
    }, 0)
    return () => clearTimeout(t)
  }, [pending, busy, loadingHistory, retryAt, consume, send])

  useEffect(() => () => abort.current?.abort(), [])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-2 text-xs text-muted">
        <span>{loadingHistory ? 'Loading conversation...' : busy ? status : retryAt != null ? 'Message limit reached. Please wait before sending again.' : 'Agronomy assistant'}</span>
        <button disabled={busy || loadingHistory} className="cursor-pointer underline disabled:opacity-50" onClick={async () => { const api = await getApi(); api.newConversation?.(field.id); update(field.id, () => []); setHistoryError(null) }}>New conversation</button>
      </div>
      {historyError && <p role="alert" className="px-5 py-2 text-xs text-bad">{historyError}</p>}
      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {msgs.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
                <Sprout className="h-4 w-4" />
              </div>
              <div className="rounded-2xl rounded-tl-md bg-surface-2 px-4 py-3 text-[15px] text-ink-2">
                Hello! I am your virtual agronomist. I have already reviewed the data for <b className="text-ink">{field.name}</b>. Ask me anything you want about planting, frost, water or rotations.
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-12">
              {suggestions(field).map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.06 }}
                  onClick={() => send(s)}
                  className="cursor-pointer rounded-full border border-line bg-surface px-3 py-1.5 text-left text-sm text-ink-2 transition-colors hover:border-accent hover:text-ink"
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
        <AnimatePresence initial={false}>
          {msgs.map((m) =>
            m.role === 'user' ? (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-ink px-4 py-2.5 text-[15px] text-page">{m.content}</div>
              </motion.div>
            ) : (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
                  <Sprout className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  {!!m.tools?.length && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {m.tools.map((t) => (
                        <motion.span key={t.name} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
                          {t.state === 'running' ? <Loader2 className="h-3 w-3 animate-spin" /> : t.state === 'failed' ? <span className="text-bad">Failed</span> : <Check className="h-3 w-3 text-good" />}
                          {t.label ?? t.name}
                        </motion.span>
                      ))}
                    </div>
                  )}
                  {m.content ? (
                    <div className="rounded-2xl rounded-tl-md bg-surface-2 px-4 py-2 text-[15px] leading-relaxed text-ink-2">
                      <RichText text={m.content} />
                    </div>
                  ) : (
                    !m.error && (
                      <div className="inline-flex gap-1 rounded-2xl bg-surface-2 px-4 py-3.5">
                        {[0, 1, 2].map((i) => (
                          <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-muted" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12 }} />
                        ))}
                      </div>
                    )
                  )}
                  {m.cards?.map((c, i) => <CardView key={i} card={c} />)}
                  {!!m.citations?.length && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.citations.map((c) => (
                        <Chip key={c.source_id}>Source: {c.label}</Chip>
                      ))}
                    </div>
                  )}
                  {m.error && <p className="mt-1 text-sm text-bad">{m.error}</p>}
                </div>
              </motion.div>
            ),
          )}
        </AnimatePresence>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
        className="border-t border-line p-4"
      >
        <div className="flex items-end gap-2 rounded-[1.25rem] border border-line-strong bg-surface p-1.5 pl-4 focus-within:border-accent">
          <textarea
            maxLength={2000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
            rows={1}
            placeholder="Write your question…"
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-muted"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="submit"
            disabled={!input.trim() || busy || loadingHistory || retryAt != null}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-accent text-accent-ink transition-opacity disabled:opacity-30"
            aria-label="Send"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </motion.button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">
          {isDemoMode ? 'Demo mode: answers with rules about your data. ' : ''}Always validate with your local agronomist.
        </p>
      </form>
    </div>
  )
}

/** Botón flotante + hoja del chat. Con `fab={false}` solo monta la hoja (se abre con `useChat().setOpen`). */
export function ChatLauncher({ field, ready, fab = true }: { field: Field; ready: boolean; fab?: boolean }) {
  const open = useChat((s) => s.open)
  const setOpen = useChat((s) => s.setOpen)
  return (
    <>
      {fab && <motion.button
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.4 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen(true)}
        className={cn('no-print fixed right-5 bottom-5 z-40 inline-flex h-14 cursor-pointer items-center gap-2.5 rounded-full bg-ink pr-5 pl-4 text-page shadow-2xl shadow-black/20', open && 'pointer-events-none opacity-0')}
      >
        <span className="relative grid h-8 w-8 place-items-center rounded-full bg-accent text-accent-ink">
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent" />
          <MessageCircle className="relative h-4 w-4" />
        </span>
        <span className="text-sm font-semibold">Ask the agronomist</span>
      </motion.button>}
      <Sheet open={open} onOpenChange={setOpen} title="Virtual agronomist" description={field.name} wide>
        <ChatBody key={field.id} field={field} ready={ready} />
      </Sheet>
    </>
  )
}
