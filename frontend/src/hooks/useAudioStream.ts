import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseAudioStreamOptions {
  sampleRate?: number
  bufferSize?: number
  onAudioFrame?: (pcm16: Int16Array) => void
}

export interface UseAudioStreamResult {
  start: () => Promise<void>
  stop: () => void
  isRecording: boolean
  error: string | null
}

export function useAudioStream(options: UseAudioStreamOptions = {}): UseAudioStreamResult {
  const { sampleRate = 16000, bufferSize = 4096, onAudioFrame } = options

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const silentGainRef = useRef<GainNode | null>(null)
  const bufferRef = useRef<Int16Array | null>(null)
  const onAudioFrameRef = useRef<typeof onAudioFrame>(undefined)

  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onAudioFrameRef.current = onAudioFrame
  }, [onAudioFrame])

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (silentGainRef.current) {
      silentGainRef.current.disconnect()
      silentGainRef.current = null
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop()
      }
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      const ctx = audioContextRef.current
      audioContextRef.current = null
      if (ctx.state !== 'closed') {
        void ctx.close().catch(() => {
          // ignore
        })
      }
    }
    setIsRecording(false)
  }, [])

  const start = useCallback(async () => {
    if (isRecording) return
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      mediaStreamRef.current = stream

      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext

      const audioContext = new AudioContextCtor({ sampleRate })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1)
      const silentGain = audioContext.createGain()
      silentGain.gain.value = 0
      processorRef.current = processor
      silentGainRef.current = silentGain

      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        const inputData = event.inputBuffer.getChannelData(0)
        let pcm16 = bufferRef.current
        if (!pcm16 || pcm16.length !== inputData.length) {
          pcm16 = new Int16Array(inputData.length)
          bufferRef.current = pcm16
        }

        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }

        const cb = onAudioFrameRef.current
        if (cb) {
          cb(pcm16)
        }
      }

      source.connect(processor)
      // Keep the processor in the audio graph (required by some browsers) while
      // muting output to avoid feedback.
      processor.connect(silentGain)
      silentGain.connect(audioContext.destination)

      setIsRecording(true)
    } catch (err) {
      console.error('[AUDIO] Failed to start audio stream:', err)
      setError('Could not access microphone.')
      cleanup()
    }
  }, [bufferSize, cleanup, isRecording, sampleRate])

  const stop = useCallback(() => {
    cleanup()
  }, [cleanup])

  useEffect(
    () => () => {
      cleanup()
    },
    [cleanup],
  )

  return { start, stop, isRecording, error }
}

