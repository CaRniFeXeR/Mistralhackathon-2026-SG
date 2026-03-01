import asyncio
import base64
import json
import os
import sys
import websockets

TRANSCRIBER_URL = "ws://localhost:8100/v1/realtime"
MODEL = "mistralai/Voxtral-Mini-4B-Realtime-2602"

# 1 second of silence (16kHz, 16-bit PCM mono = 32000 bytes)
SILENCE = b'\x00' * 32000

async def warmup():
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

            # 4. Send 1 second of silence to "warm up" the engine
            print("Sending 1s of silence...")
            encoded = base64.b64encode(SILENCE).decode()
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
