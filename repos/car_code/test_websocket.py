import asyncio
import websockets

from collections import defaultdict
serve = websockets.serve

# 
# socket setup
# 
async def socket_response(websocket):
    async for message in websocket:
        print(f'''websocket.path = {websocket.path}''')
        print(f'''message = {message}''')
            
# 
# start servers
# 
async def main():
    async with serve(socket_response, "localhost", 8080):
        await asyncio.Future()  # run forever

asyncio.run(main())