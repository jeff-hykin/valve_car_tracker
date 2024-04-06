import asyncio
import websockets

from collections import defaultdict
serve = websockets.serve

# 
# boilerplate for python await
# 
import threading
values_to_await = []
def awaiter():
    while True:
        if len(values_to_await) > 0:
            # for some reason this is how to run await in a thread
            values_to_await.pop().send(None)
thread = threading.Thread(target=awaiter, args=())
thread.start()

# 
# socket setup
# 
async def socket_response(websocket):
    async for message in websocket:
        values_to_await.append(
            websocket.send("howdyyy")
        )
# 
# start servers
# 
async def main():
    print(f'''listening''')
    async with serve(socket_response, "localhost", 8080):
        await asyncio.Future()  # run forever

asyncio.run(main())