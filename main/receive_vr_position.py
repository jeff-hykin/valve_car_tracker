import asyncio
import websockets


async def listen_for_messages():
    uri = "ws://localhost:8080/ws"  # Change the URI to your WebSocket server

    async with websockets.connect(uri) as websocket:
        print("Connected to WebSocket server")

        try:
            while True:
                message = await websocket.recv()
                if "POSE" in message and not "T20" in message and not "LH_" in message:
                    print(
                        repr(
                            [
                                f"{round(float(each), ndigits=1)}".ljust(6, "0")
                                for each in message.split(" ")
                                if len(each) > 0
                                and (each[0].isdigit() or each[0] == "-")
                            ][1:]
                        )
                        + "     ",
                        end="\r",
                    )
                    
                    # [       x_axis, y_axis, height_axis,      pitch, roll, yaw, roll    ]
                    # print("Received message:", message, end="\r")

        except websockets.exceptions.ConnectionClosedOK:
            print("WebSocket connection closed")


asyncio.run(listen_for_messages())
