'use client'

import { useState, useRef, useEffect } from 'react'
import { Icon } from './Icon'
import { useChatSession } from '../hooks/useChatSession'

interface Props {
  ticker: string
  period: string
  sentimentAnalysisId?: number
  isOpen: boolean
  onClose: () => void
}

export function SentimentChatPanel({ ticker, period, sentimentAnalysisId, isOpen, onClose }: Props) {
  const [inputMessage, setInputMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chat = useChatSession()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.messages])

  useEffect(() => {
    if (isOpen && !chat.activeSessionId) {
      chat.startChat(ticker, period, sentimentAnalysisId)
    }
  }, [isOpen, chat.activeSessionId, ticker, period, sentimentAnalysisId])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim()) return
    const message = inputMessage.trim()
    setInputMessage('')
    try {
      await chat.sendChatMessage(message)
    } catch (error) {
      // Error is handled by the useChatSession hook
      // Could add user-facing error toast here if needed
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 w-[26rem] sm:w-[28rem] md:w-[32rem] lg:w-[36rem] bg-white dark:bg-slate-900 shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Chat about {ticker}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Discuss your sentiment analysis</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
          <Icon name="x" className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* One-time warning banner at chat start */}
        <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-300/60 dark:border-amber-800/60 text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <Icon name="alert" className="h-4 w-4 mt-0.5" />
            <div className="text-sm">
              <strong>Educational Use Only:</strong> This chat provides general market information and explanations. It is not personalized investment advice.
            </div>
          </div>
        </div>

        {chat.isCreatingSession && (
          <div className="text-center py-8">
            <Icon name="spinner" className="h-8 w-8 mx-auto text-blue-600 mb-2" />
            <p className="text-slate-600 dark:text-slate-300">Starting chat session...</p>
          </div>
        )}

        {chat.messages.map((message) => (
          <div key={message.id} className={`flex ${message.message_type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.message_type === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs opacity-70 mt-1">{new Date(message.created_at).toLocaleTimeString()}</p>
            </div>
          </div>
        ))}

        {chat.isSendingMessage && (
          <div className="flex justify-start">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg px-4 py-2">
              <Icon name="spinner" className="h-4 w-4 text-slate-600" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value)
              const el = textareaRef.current
              if (el) {
                el.style.height = 'auto'
                const max = 200 // px
                el.style.height = Math.min(el.scrollHeight, max) + 'px'
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (inputMessage.trim()) void handleSendMessage(e)
              }
            }}
            rows={1}
            placeholder="Ask about this analysis... (Shift+Enter for newline)"
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm resize-none max-h-52"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || chat.isSendingMessage}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 disabled:bg-slate-400"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
