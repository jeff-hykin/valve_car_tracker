import sys 
import os
import subprocess
import json
import time

import asyncio
import websockets

from quik_config import find_and_load
info = find_and_load(
    "config.yaml", # walks up folders until it finds a file with this name
    cd_to_filepath=False, # helpful if using relative paths
    fully_parse_args=True, # if you already have argparse, use parse_args=True instead
    show_help_for_no_args=False, # change if you want
)
config = info.config
dry_run = config.get("dry_run", False)
print("Note: use dry_run:True to test without car")

# allow importing local files
parent_folder = os.path.dirname(os.path.abspath(__file__))
sys.path.append(parent_folder)

if not dry_run:
    from car_controller import Car
from generic_tools import pick_item



# 
# get ip for websocket
# 
port = config.default_keyboard_port
ip_address = config.get("ip_address", None)
ip_addr_command = f"{parent_folder}/my_ip"
ip_addresses = subprocess.check_output([ip_addr_command]).decode('utf-8')[0:-1].split("\n")
if ip_address == None:
    ip_address = pick_item(ip_addresses, message="Which IP address do you want to use?")


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
# car handler
# 
import threading
import time
update_rate = 0.05
dead_zone_size = 10
timeout_size = 3
log_rate = 5 # once every 5 
speed_increment_rate = 20
speed_neutralize_rate = 0
steer_increment_rate = 20
steer_neutralize_rate = 0
class LiveValues:
    iteration = 0
    car_speed = 0
    car_steer = 0
    compensation = 0
    time_of_last_command = time.time()

websocket = None
def send_car_commands():
    while True:
        LiveValues.iteration += 1
        if (time.time() - LiveValues.time_of_last_command) > timeout_size:
            LiveValues.car_speed = 0
            LiveValues.car_steer = 0
            if LiveValues.iteration % log_rate == 0: print(f'''time_of_last_command > {timeout_size}sec, sending all zeros''')
        
        time.sleep(update_rate)
        direction = LiveValues.car_steer+LiveValues.compensation
        if LiveValues.car_speed < dead_zone_size and LiveValues.car_speed > -dead_zone_size:
            if dry_run:
                if LiveValues.car_steer != 0 and LiveValues.iteration % log_rate == 0: print(f'''go: {LiveValues.car_steer}, 0''')
            else:
                values_to_await.append(
                    websocket.send(f'''{{"drive":{{"velocity":0,"direction":{direction}}},"time":{time.time()}}}''')
                )
                Car.drive(velocity=0, direction=direction)
        else:
            if dry_run:
                if LiveValues.iteration % log_rate == 0: print(f'''go: {LiveValues.car_steer}, {LiveValues.car_speed}''')
            else:
                values_to_await.append(
                    websocket.send(f'''{{"drive":{{"velocity":{LiveValues.car_speed},"direction":{direction}}},"time":{time.time()}}}''')
                )
                Car.drive(velocity=LiveValues.car_speed, direction=direction)
        
        # return back torwards zeros if no new command given
        if LiveValues.car_speed < 0:
            LiveValues.car_speed += speed_neutralize_rate
        if LiveValues.car_speed > 0:
            LiveValues.car_speed -= speed_neutralize_rate
        if LiveValues.car_steer < 0:
            LiveValues.car_steer += steer_neutralize_rate
        if LiveValues.car_steer > 0:
            LiveValues.car_steer -= steer_neutralize_rate
        
thread = threading.Thread(target=send_car_commands, args=())
thread.start()

# 
# socket setup
# 
async def socket_response(websocket):
    global websocket
    async for message in websocket:
        try:
            if websocket.path == "/keypresses":
                json_message = json.loads(message)
                LiveValues.time_of_last_command = time.time()
                if json_message["key"] in ["up", "w", "i"]:
                    LiveValues.car_speed += speed_increment_rate
                    if LiveValues.car_speed > 100:
                        LiveValues.car_speed = 100
                if json_message["key"] in ["down", "s", "k"]:
                    LiveValues.car_speed -= speed_increment_rate
                    if LiveValues.car_speed < -100:
                        LiveValues.car_speed = -100
                if json_message["key"] in ["left", "a", "j"]:
                    LiveValues.car_steer -= steer_increment_rate
                    if LiveValues.car_steer < -100:
                        LiveValues.car_steer = -100
                if json_message["key"] in ["right", "d", "l"]:
                    LiveValues.car_steer += steer_increment_rate
                    if LiveValues.car_steer > 100:
                        LiveValues.car_steer = 100
                if json_message["key"] in ["+"]:
                    LiveValues.compensation += 1
                if json_message["key"] in ["-"]:
                    LiveValues.compensation -= 1
                    
        
        except Exception as error:
            print(f'''Error when handling websocket: {error}''')
            
# 
# start servers
# 
async def main():
    print(f'''Starting keyboard_listener socket''')
    async with websockets.serve(socket_response, ip_address, port):
        await asyncio.Future()  # run forever

asyncio.run(main())
thread.join()