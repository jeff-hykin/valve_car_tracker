import subprocess
import os
import time
import json
import threading
import atexit

from websockets.sync.client import connect

# 
# thread helper
# 
threads_to_join = []
@atexit.register
def exit_handler():
    for each in threads_to_join:
        each.join()

# 
# connection to VR remote
# 
position_should_be_listening = False
position = None # [ x_axis, y_axis, height_axis, pitch, roll, yaw, roll? ]
def record_position_func():
    global position, position_should_be_listening
    while True:
        if not position_should_be_listening:
            time.sleep(2)
            continue
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
                        time.sleep(0.01)
        except Exception as error:
            print(f'''error listening to position ({error})\nTrying to reconnect''')
            time.sleep(3)
record_position_thread = threading.Thread(target=record_position_func, args=())
record_position_thread.start()
threads_to_join.append(record_position_thread)

# 
# connection to car
# 
car_address = None
car_port = None
car_process = None
next_action = None # [ x_axis, y_axis, height_axis, pitch, roll, yaw, roll? ]
def send_action():
    global car_address, car_port, next_action, car_process
    while True:
        if car_address == None or car_port == None:
            time.sleep(5)
            continue
        car_process = subprocess.Popen(["ssh", f"ubuntu@{car_address}", "-t", f"cd ~/repos/valve_car_tracker/ && python3 ./repos/car/drive_listener.py ip_address:{car_address}"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        time.sleep(5)
        subprocess.Popen(["stty", "sane"])
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
            print(f'''error with car websocket ({error})...Trying to reconnect\r''')
            time.sleep(3)
send_action_thread = threading.Thread(target=send_action, args=())
send_action_thread.start()
threads_to_join.append(send_action_thread)


class Env:
    """
    Example:
        env = Env("192.168.191.203", 8080)
        obs  = env.reset()
        print(f'''obs = {obs}''')
        print(env.step(dict(velocity=15,direction=10)))
    """
    def __init__(self, car_address, car_port):
        global position, position_should_be_listening
        # this func is just to get around var-naming/scoping issues
        def set_global_car_values(address, port):
            global car_address, car_port
            car_address = address
            car_port = port
        set_global_car_values(car_address, car_port)
        print(f'''starting VR tracker (websocketd) if not already started''')
        self._process = subprocess.Popen(["sudo", "-E", "env", f"PATH=${os.getenv('PATH')}", "survive-websocketd",])
        position_should_be_listening = True
        while position == None:
            print(f'''waiting for VR tracker to connect (make sure plugged in and on)''')
            time.sleep(3)
        @atexit.register
        def kill_process():
            self._process.terminate()
    
    def reset(self):
        observation = list(position)
        return observation
    
    def step(self, action):
        global position, next_action
        debug = {}
        done = False
        observation = list(position)
        next_action = dict(action)
        reward = 1
        return observation, reward, done, debug
        
