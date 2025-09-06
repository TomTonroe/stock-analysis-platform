/**
 * React Query Provider Wrapper
 * 
 * Provides React Query context to the entire app with devtools
 * for development environment.
 */

'use client'

import { QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { queryClient } from '../../lib/queryClient'
import { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export function ReactQueryProvider({ children }: Props) {
  const persister = typeof window !== 'undefined'
    ? createSyncStoragePersister({ storage: window.localStorage })
    : undefined as any

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persister ? { persister, maxAge: 1000 * 60 * 60 } : undefined}
    >
      {children}
      {/* Show devtools only in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </PersistQueryClientProvider>
  )
}
