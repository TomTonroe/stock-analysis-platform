'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

interface ChatMessage {
  id: number
  message_type: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export function useChatSession() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ''

  const createSession = useMutation({
    mutationFn: async ({ ticker, period, sentimentAnalysisId }: { ticker: string; period: string; sentimentAnalysisId?: number }) => {
      const response = await fetch(`${base}/chat/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, period, sentiment_analysis_id: sentimentAnalysisId ?? null }),
      })
      if (!response.ok) throw new Error(`Failed to create session: HTTP ${response.status}`)
      const data = await response.json()
      return data.data.session_id as string
    },
    onSuccess: (sessionId) => setActiveSessionId(sessionId),
  })

  const sendMessage = useMutation({
    mutationFn: async ({ sessionId, message }: { sessionId: string; message: string }) => {
      const response = await fetch(`${base}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message }),
      })
      if (!response.ok) throw new Error(`Failed to send message: HTTP ${response.status}`)
      const data = await response.json()
      return data.data.response as string
    },
    onSuccess: () => {
      if (activeSessionId) {
        queryClient.invalidateQueries({ queryKey: ['chat-history', activeSessionId] })
      }
    },
  })

  const { data: messages = [], isLoading: isLoadingHistory } = useQuery<ChatMessage[]>({
    queryKey: ['chat-history', activeSessionId],
    queryFn: async () => {
      if (!activeSessionId) return []
      const response = await fetch(`${base}/chat/sessions/${activeSessionId}/messages`)
      if (!response.ok) throw new Error(`Failed to load history: HTTP ${response.status}`)
      const data = await response.json()
      return data.data.messages as ChatMessage[]
    },
    enabled: !!activeSessionId,
  })

  const startChat = useCallback(
    async (ticker: string, period: string, sentimentAnalysisId?: number) => {
      await createSession.mutateAsync({ ticker, period, sentimentAnalysisId })
    },
    [createSession]
  )

  const sendChatMessage = useCallback(
    async (message: string) => {
      if (!activeSessionId) throw new Error('No active session')
      await sendMessage.mutateAsync({ sessionId: activeSessionId, message })
    },
    [activeSessionId, sendMessage]
  )

  return {
    // State
    activeSessionId,
    messages,
    isLoadingHistory,

    // Actions
    startChat,
    sendChatMessage,
    closeChat: () => setActiveSessionId(null),

    // Status
    isCreatingSession: createSession.isPending,
    isSendingMessage: sendMessage.isPending,

    // Errors
    createError: createSession.error,
    sendError: sendMessage.error,
  }
}

