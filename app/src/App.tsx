import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { createBrowserRouter, Link, RouterProvider } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { FieldPage } from '@/pages/field/field-page'
import { HomePage } from '@/pages/home'
import { MapPage } from '@/pages/map-page'
import { NewFieldPage } from '@/pages/new-field'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
})

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-ink">This page does not exist</h1>
      <Link to="/" className="mt-6 inline-block">
        <Button variant="outline">Back to home</Button>
      </Link>
    </div>
  )
}

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/nueva', element: <NewFieldPage /> },
      { path: '/mapa', element: <MapPage /> },
      { path: '/parcela/:id', element: <FieldPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
      </MotionConfig>
    </QueryClientProvider>
  )
}
