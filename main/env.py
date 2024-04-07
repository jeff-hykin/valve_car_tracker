import subprocess
import os
import time
import json

from websockets.sync.client import connect

# 
# connection to VR remote
# 
threads_to_join = []
position = None # [ x_axis, y_axis, height_axis, pitch, roll, yaw, roll? ]
def record_position_func():
    global position
    while True:
        try:
            # sadly the websocketd from libsurvive is hardcoded to be port
            with connect("ws://localhost:8080") as websocket:
                while 1:
                    message = websocket.recv()
                    if "POSE" in message and not "T20" in message and not "LH_" in message:
                        position = [
                            float(each)
                                for each in message.split(" ")
                                    if len(each) > 0 and (each[0].isdigit() or each[0]=="-") 
                        ][1:]
        except Exception as error:
            print(f'''error listening to position ({error})\nTrying to reconnect''')
record_position_thread = threading.Thread(target=record_position_func, args=())
record_position_thread.start()
threads_to_join.append(record_position_thread)

# 
# connection to car
# 
car_address = None
car_port = None
next_action = None # [ x_axis, y_axis, height_axis, pitch, roll, yaw, roll? ]
def send_action():
    global car_address, car_port, next_action
    while True:
        if car_address == None or car_port == None:
            time.sleep(5)
            continue
        try:
            # sadly the websocketd from libsurvive is hardcoded to be port
            with connect(f"ws://{car_address}:{car_port}") as websocket:
                while 1:
                    if next_action != None:
                        # FIXME: test this
                        websocket.send(json.dumps(next_action))
                        next_action = None
                    else:
                        time.sleep(0.01)
        except Exception as error:
            print(f'''error with car websocket ({error})\nTrying to reconnect''')
send_action_thread = threading.Thread(target=send_action, args=())
send_action_thread.start()
threads_to_join.append(send_action_thread)


class Env:
    def __init__(self, car_address, car_port):
        global position
        # this func is just to get around var-naming/scoping issues
        def set_global_car_values(address, port):
            global car_address, car_port
            car_address = address
            car_port = port
        set_global_car_values(car_address, car_port)
        print(f'''starting VR tracker (websocketd) if not already started''')
        subprocess.run(["sudo", "-E", "env", f"PATH=${os.getenv("PATH")}", "survive-websocketd",])
        while position == None:
            print(f'''waiting for VR tracker to connect to''')
            time.sleep(3)
    
    def reset(self):
        observation = list(position)
        return observation
    
    def step(self, action):
        global position, next_action
        done = False
        observation = list(position)
        next_action = dict(action)
        reward = 1
        return observation, reward, done, debug
        

import atexit
@atexit.register
def exit_handler():
    for each in threads_to_join:
        each.join()