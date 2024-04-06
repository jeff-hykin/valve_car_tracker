import threading
import time
from websockets.sync.client import connect

threads_to_join = []
position = None # [ x_axis, y_axis, height_axis, pitch, roll, yaw, roll? ]
def record_position_func():
    global position
    while True:
        try:
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


def printer():
    global position
    while 1:
        time.sleep(0.5)
        print(f'''{position}''')
printer_thread = threading.Thread(target=printer, args=())
printer_thread.start()
threads_to_join.append(printer_thread)




import atexit
@atexit.register
def exit_handler():
    for each in threads_to_join:
        each.join()