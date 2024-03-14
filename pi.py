'
# Pinout:
    # ,--------------------------------.
    # | oooooooooooooooooooo J8     +====
    # | 1ooooooooooooooooooo        | USB
    # |                             +====
    # |      Pi Model 3B  V1.2         |
    # |      +----+                 +====
    # | |D|  |SoC |                 | USB
    # | |S|  |    |                 +====
    # | |I|  +----+                    |
    # |                   |C|     +======
    # |                   |S|     |   Net
    # | pwr        |HDMI| |I||A|  +======
    # `-| |--------|    |----|V|-------|

    # Revision           : a22082
    # SoC                : BCM2837
    # RAM                : 1024Mb
    # Storage            : MicroSD
    # USB ports          : 4 (excluding power)
    # Ethernet ports     : 1
    # Wi-fi              : True
    # Bluetooth          : True
    # Camera ports (CSI) : 1
    # Display ports (DSI): 1

    # J8:
    #    3V3  (1) (2)  5V    
    #  GPIO2  (3) (4)  5V    
    #  GPIO3  (5) (6)  GND   
    #  GPIO4  (7) (8)  GPIO14
    #    GND  (9) (10) GPIO15
    # GPIO17 (11) (12) GPIO18
    # GPIO27 (13) (14) GND   
    # GPIO22 (15) (16) GPIO23
    #    3V3 (17) (18) GPIO24
    # GPIO10 (19) (20) GND   
    #  GPIO9 (21) (22) GPIO25
    # GPIO11 (23) (24) GPIO8 
    #    GND (25) (26) GPIO7 
    #  GPIO0 (27) (28) GPIO1 
    #  GPIO5 (29) (30) GND   
    #  GPIO6 (31) (32) GPIO12
    # GPIO13 (33) (34) GND   
    # GPIO19 (35) (36) GPIO16
    # GPIO26 (37) (38) GPIO20
    #    GND (39) (40) GPIO21

import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BOARD)

pins = {}
class PwmPin:
    def __init__(self, pin_number):
        if pin_number in pins:
            self.pwm = pins[pin_number]
            if isinstance(self.pwm, PwmPin):
                raise Exception(f'''Looks like pin {pin_number} was trying to be setup as a PwmPin when it was already a {type(self.pwm)}''')
        else:
            GPIO.setup(pin_number, GPIO.OUT)
            GPIO.output(pin_number, GPIO.LOW)
            self.pwm = GPIO.PWM(pin_number, 1000)
            pins[pin_number] = self.pwm
        self.pwm.stop()
        self.pwm.start(0)
    
    def set(self, value):
        return self.pwm.ChangeDutyCycle(value)

class DigitalPin:
    def __init__(self, pin_number):
        self.pin_number = pin_number
        if pin_number not in pins:
            GPIO.setup(self.pin_number, GPIO.OUT)
            pins[pin_number] = DigitalPin
        GPIO.output(self.pin_number, GPIO.LOW)
    
    def set(self, value):
        if value:
            GPIO.output(self.pin_number, GPIO.HIGH)
        else:
            GPIO.output(self.pin_number, GPIO.LOW)

class Wheel:
    def __init__(self, speed_pin, toggle_pin, name=""):
        self.name = name
        self.speed_pin = speed_pin
        self.speed_setter = PwmPin(speed_pin)
        self.toggle_pin = toggle_pin
        self.toggle_setter = DigitalPin(toggle_pin)
    
    def spin(self, speed):
        if speed > 100:
            speed = 100
        if speed < -100:
            speed = -100
        
        # pin = on if going backwards
        self.toggle_setter.set(speed < 0)
        self.speed_setter.set(abs(speed))

back_left_wheel = Wheel(speed_pin=32, toggle_pin=36, name="back_left_wheel")
back_right_wheel = Wheel(speed_pin=38, toggle_pin=40, name="back_right_wheel")

def test_wheels():
    while True:
        for each_wheel in [back_left_wheel, back_right_wheel]:
            forwards = 1
            backwards = -1
            print(f'''{each_wheel.name}''')
            for each_direction in [forwards, backwards]:
                
                # 0 to 100
                for speed in range(0, 101, 1):
                    each_wheel.spin(speed*each_direction)
                    time.sleep(0.01)
                
                time.sleep(1)
                
                # 100 to 0
                for speed in range(100, -1, -1):
                    each_wheel.spin(speed*each_direction)
                    time.sleep(0.01)
        
        time.sleep(1)

def destroy():
    # pwm.stop()
    # GPIO.output(pwm1_out, GPIO.LOW)
    GPIO.cleanup()

# loop()
