import asyncio
import base64
import json
import os
import sys
import websockets

TRANSCRIBER_URL = "ws://localhost:8100/v1/realtime"
MODEL = "mistralai/Voxtral-Mini-4B-Realtime-2602"

# 1 second of white noise (16kHz, 16-bit PCM mono = 32000 bytes)
# Using random bytes is an easy way to generate white noise for PCM16.
WHITE_NOISE = os.urandom(32000)

SAMPLE_FILE = "warmup_sample.raw"

def get_warmup_audio():
    if os.path.exists(SAMPLE_FILE):
        print(f"Loading voice sample from {SAMPLE_FILE}...")
        with open(SAMPLE_FILE, "rb") as f:
            return f.read()
    print("Voice sample not found, falling back to white noise...")
    return WHITE_NOISE

async def warmup():
    audio_data = get_warmup_audio()
    print(f"Connecting to {TRANSCRIBER_URL}...")
    try:
        async with websockets.connect(TRANSCRIBER_URL) as ws:
            # 1. Wait for greeting
            greeting = await ws.recv()
            print(f"Received greeting: {greeting}")

            # 2. Update session with model
            print(f"Updating session with model: {MODEL}")
            await ws.send(json.dumps({
                "type": "session.update",
                "model": MODEL
            }))

            # 3. Signal start of audio
            print("Sending input_audio_buffer.commit...")
            await ws.send(json.dumps({"type": "input_audio_buffer.commit"}))

            # 4. Send the audio data to "warm up" the engine
            print(f"Sending {len(audio_data)} bytes of audio...")
            encoded = base64.b64encode(audio_data).decode()
            await ws.send(json.dumps({
                "type": "input_audio_buffer.append",
                "audio": encoded
            }))

            # 5. Signal end of audio
            print("Sending final commit...")
            await ws.send(json.dumps({
                "type": "input_audio_buffer.commit",
                "final": True
            }))

            # 6. Wait for transcription.done or a timeout
            print("Waiting for response...")
            while True:
                try:
                    resp = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    msg = json.loads(resp)
                    print(f"Server: {msg.get('type')} {msg.get('delta', '')}")
                    if msg.get("type") == "transcription.done":
                        print("Warmup complete!")
                        break
                    if msg.get("type") == "error":
                        print(f"Error: {msg.get('message')}")
                        break
                except asyncio.TimeoutError:
                    print("Timeout waiting for server response. Engine might still be loading.")
                    break
    except Exception as e:
        print(f"Warmup failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(warmup())
