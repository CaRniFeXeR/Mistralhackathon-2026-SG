import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseWebSocketOptions {
  onOpen?: (event: Event) => void
  onMessage?: (event: MessageEvent) => void
  onError?: (event: Event) => void
  onClose?: (event: CloseEvent) => void
}

export interface UseWebSocketResult {
  socket: WebSocket | null
  readyState: WebSocket['readyState']
  sendJson: (data: unknown) => void
  sendBinary: (data: ArrayBuffer | ArrayBufferView) => void
  close: () => void
}

export function useWebSocket(url: string | null, options: UseWebSocketOptions = {}): UseWebSocketResult {
  const socketRef = useRef<WebSocket | null>(null)
  const optionsRef = useRef(options)
  const [readyState, setReadyState] = useState<WebSocket['readyState']>(WebSocket.CLOSED)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  useEffect(() => {
    if (!url) {
      return
    }

    const ws = new WebSocket(url)
    socketRef.current = ws
    setReadyState(ws.readyState)

    ws.onopen = (event) => {
      setReadyState(ws.readyState)
      optionsRef.current.onOpen?.(event)
    }

    ws.onmessage = (event) => {
      optionsRef.current.onMessage?.(event)
    }

    ws.onerror = (event) => {
      optionsRef.current.onError?.(event)
    }

    ws.onclose = (event) => {
      setReadyState(ws.readyState)
      optionsRef.current.onClose?.(event)
      if (socketRef.current === ws) {
        socketRef.current = null
      }
    }

    return () => {
      ws.close()
    }
  }, [url])

  const sendJson = useCallback((data: unknown) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(data))
  }, [])

  const sendBinary = useCallback((data: ArrayBuffer | ArrayBufferView) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    // Send the exact binary view to avoid offset/length mismatches.
    ws.send(data)
  }, [])

  const close = useCallback(() => {
    const ws = socketRef.current
    if (!ws) return
    ws.close()
  }, [])

  return { socket: socketRef.current, readyState, sendJson, sendBinary, close }
}

