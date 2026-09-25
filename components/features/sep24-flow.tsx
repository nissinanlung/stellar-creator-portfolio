'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'

/**
 * SEP-24 interactive deposit/withdraw flow.
 *
 * Implements the SEP-24 interactive flow:
 * 1. POST to the anchor's TRANSFER_SERVER to initiate a transaction
 *    (POST /transactions/deposit/interactive or /transactions/withdraw/interactive)
 * 2. Open the returned interactive URL in a popup window
 * 3. Poll the transaction status (GET /transaction?id=...) until terminal
 *
 * @see https://github.com/StellarTechAlliance/SEP-24
 */

export type Sep24FlowKind = 'deposit' | 'withdraw'

export type Sep24TransactionStatus =
  | 'idle'
  | 'incomplete'
  | 'pending_anchor'
  | 'pending_user'
  | 'pending_external'
  | 'completed'
  | 'error'

export interface Sep24FlowProps {
  kind: Sep24FlowKind
  assetCode: string
  anchorTransferServerUrl: string
  account: string
  onStatusChange?: (status: Sep24TransactionStatus) => void
}

interface Sep24StartResponse {
  id: string
  interactive_url: string
  status: Sep24TransactionStatus
}

interface Sep24TransactionResponse {
  transaction: {
    id: string
    status: Sep24TransactionStatus
    status_eta?: number
    amount_in?: string
    amount_out?: string
    asset_in?: string
    asset_out?: string
    message?: string
  }
}

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes max

export function Sep24Flow({
  kind,
  assetCode,
  anchorTransferServerUrl,
  account,
  onStatusChange,
}: Sep24FlowProps) {
  const [status, setStatus] = useState<Sep24TransactionStatus>('idle')
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [interactiveUrl, setInteractiveUrl] = useState<string | null>(null)
  const popupRef = useRef<Window | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollStartRef = useRef<number>(0)

  const updateStatus = useCallback(
    (newStatus: Sep24TransactionStatus) => {
      setStatus(newStatus)
      onStatusChange?.(newStatus)
    },
    [onStatusChange],
  )

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  // Poll the anchor's /transaction endpoint until the status is terminal
  const pollTransactionStatus = useCallback(
    async (txId: string, transferServerUrl: string) => {
      stopPolling()
      pollStartRef.current = Date.now()

      pollTimerRef.current = setInterval(async () => {
        // Timeout check
        if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
          stopPolling()
          setError('Transaction polling timed out')
          updateStatus('error')
          return
        }

        try {
          const url = `${transferServerUrl}/transaction?id=${encodeURIComponent(txId)}`
          const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          })

          if (!response.ok) {
            throw new Error(`Polling failed: ${response.status}`)
          }

          const data: Sep24TransactionResponse = await response.json()
          const txStatus = data.transaction.status

          // Map anchor status to our status
          if (
            txStatus === 'completed' ||
            txStatus === 'error' ||
            txStatus === 'pending_external'
          ) {
            stopPolling()
            updateStatus(txStatus)
            if (txStatus === 'error' && data.transaction.message) {
              setError(data.transaction.message)
            }
          } else {
            updateStatus(txStatus)
          }
        } catch (err) {
          // Don't stop polling on transient errors, just log
          console.warn('SEP-24 polling error:', err)
        }
      }, POLL_INTERVAL_MS)
    },
    [stopPolling, updateStatus],
  )

  const startFlow = async () => {
    if (status !== 'idle') return
    setError(null)
    updateStatus('incomplete')

    try {
      // Step 1: Request the interactive URL from the anchor's TRANSFER_SERVER
      const endpoint = kind === 'deposit'
        ? '/transactions/deposit/interactive'
        : '/transactions/withdraw/interactive'

      const response = await fetch(`${anchorTransferServerUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_code: assetCode,
          account,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`Anchor returned ${response.status}: ${errorBody}`)
      }

      const data: Sep24StartResponse = await response.json()

      if (!data.interactive_url) {
        throw new Error('Anchor did not return an interactive URL')
      }

      setTransactionId(data.id)
      setInteractiveUrl(data.interactive_url)

      // Step 2: Open the interactive URL in a popup window
      const popup = window.open(
        data.interactive_url,
        'sep24-interactive',
        'width=480,height=720,scrollbars=yes,resizable=yes',
      )

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.')
      }

      popupRef.current = popup

      // Step 3: Start polling the transaction status
      updateStatus('pending_anchor')
      await pollTransactionStatus(data.id, anchorTransferServerUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start SEP-24 flow')
      updateStatus('error')
    }
  }

  // Check if the popup was closed by the user
  useEffect(() => {
    if (!popupRef.current || status === 'idle' || status === 'completed' || status === 'error') {
      return
    }

    const checkPopup = setInterval(() => {
      if (popupRef.current?.closed) {
        clearInterval(checkPopup)
        // If the popup was closed and we're still pending, update status
        if (status === 'incomplete' || status === 'pending_user') {
          updateStatus('pending_anchor')
        }
      }
    }, 1000)

    return () => clearInterval(checkPopup)
  }, [status, updateStatus])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling()
      popupRef.current?.close()
    }
  }, [stopPolling])

  const reset = () => {
    stopPolling()
    popupRef.current?.close()
    popupRef.current = null
    setStatus('idle')
    setTransactionId(null)
    setInteractiveUrl(null)
    setError(null)
  }

  const isTerminal = status === 'completed' || status === 'error'

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {kind === 'deposit' ? 'Deposit' : 'Withdraw'} {assetCode} via anchor (SEP-24)
        </p>
        {isTerminal && (
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {status === 'completed' && (
        <p className="text-sm text-green-600 font-medium">
          ✓ Transaction completed successfully
        </p>
      )}

      {transactionId && (
        <p className="text-xs text-muted-foreground">
          Transaction ID: {transactionId}
        </p>
      )}

      {interactiveUrl && status !== 'completed' && status !== 'error' && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (interactiveUrl) {
              popupRef.current = window.open(
                interactiveUrl,
                'sep24-interactive',
                'width=480,height=720,scrollbars=yes,resizable=yes',
              )
            }
          }}
        >
          Reopen interactive window
        </Button>
      )}

      <Button onClick={startFlow} disabled={status !== 'idle'}>
        Start {kind}
      </Button>

      {status !== 'idle' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          <span
            className={`text-xs font-medium ${
              status === 'completed'
                ? 'text-green-600'
                : status === 'error'
                  ? 'text-red-500'
                  : 'text-blue-500'
            }`}
          >
            {status.replace(/_/g, ' ')}
          </span>
          {(status === 'pending_anchor' || status === 'pending_user' || status === 'pending_external') && (
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          )}
        </div>
      )}
    </div>
  )
}
