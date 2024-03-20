import asyncio
import websockets

async def listen_for_messages():
    uri = "ws://localhost:8765"  # Change the URI to your WebSocket server

    async with websockets.connect(uri) as websocket:
        print("Connected to WebSocket server")

        try:
            while True:
                message = await websocket.recv()
                print("Received message:", message)
        except websockets.exceptions.ConnectionClosedOK:
            print("WebSocket connection closed")

asyncio.run(listen_for_messages())