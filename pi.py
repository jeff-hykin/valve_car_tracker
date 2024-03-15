
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
    #    GND (25) (26) GPIO7                            <connections>                              <wire colors>   
    #  GPIO0 (27) (28) GPIO1 
    #  GPIO5 (29) (30) GND                                                                               [white   ]                
    #  GPIO6 (31) (32) GPIO12    |   [front_left_toggle  #5BE] [back_left_velocity    #C55]    |    [yellow] [purple  ]
    # GPIO13 (33) (34) GND       |   [front_left_velocity    #5BE] [     ground #000      ]    |    [green ]   <gap>
    # GPIO19 (35) (36) GPIO16    |   [front_right_toggle #50E] [back_left_toggle  #C55]    |    [blue  ] [blue    ]   
    # GPIO26 (37) (38) GPIO20    |   [front_right_velocity   #50E] [back_right_velocity   #9C6]    |    [purple] [green   ] 
    #    GND (39) (40) GPIO21    |   [    ground #000        ] [back_right_toggle #9C6]    |    [white ] [yellow  ]  
    
    
    #     #5BE                <front>                #50E                                        
    #  __________                                 __________ 
    # [          ]                               [          ]
    # [ speed=33 ]    _______________________    [ speed=37 ]
    # [          ]===|                       |===[          ]
    # [ tog=31   ]   |                       |   [ tog=35   ]
    # [          ]   |                       |   [          ]
    #  ▔▔▔▔▔▔▔▔▔▔    |                       |    ▔▔▔▔▔▔▔▔▔▔ 
    #                |                       |               
    #                |                       |               
    #                |         <car>         |               
    #     #C55       |                       |       #9C6    
    #  __________    |                       |    __________ 
    # [          ]   |                       |   [          ]
    # [ speed=32 ]   |                       |   [ speed=38 ]
    # [          ]===|                       |===[          ]
    # [ tog=36   ]   |                       |   [ tog=40   ]
    # [          ]   |                       |   [          ]
    #  ▔▔▔▔▔▔▔▔▔▔    |_______________________|    ▔▔▔▔▔▔▔▔▔▔ 
    #                                                        

import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BOARD)

pins = {}
def test_pwm(pin_number, cycles=1):
    
    # 
    # setup pin, if not already setup
    # 
    if pin_number in pins:
        pwm = pins[pin_number]
        if isinstance(pwm, GPIO.PWM):
            raise Exception(f'''Looks like pin {pin_number} was trying to be setup as a PwmPin when it was already a {type(pwm)}''')
    else:
        GPIO.setup(pin_number, GPIO.OUT)
        GPIO.output(pin_number, GPIO.LOW)
        pwm = GPIO.PWM(pin_number, 1000)
        pins[pin_number] = pwm
    
        pwm.stop()
        pwm.start(0)

    # 
    # cycle through all values
    # 
    for each in range(cycles):
        for dc in range(0, 101, 1):
            pwm.ChangeDutyCycle(dc)
            time.sleep(0.01)
        
        time.sleep(1)
        
        for dc in range(100, -1, -1):
            pwm.ChangeDutyCycle(dc)
            time.sleep(0.01)
        
        time.sleep(1)

class PwmPin:
    def __init__(self, pin_number):
        already_setup = pin_number in pins
        if already_setup:
            self.pwm = pins[pin_number]
            if not isinstance(self.pwm, GPIO.PWM):
                print(f'''Warning: looks like pin {pin_number} was trying to be setup as a PwmPin when it was already a {type(self.pwm)}''')
        
        if not already_setup or not isinstance(self.pwm, GPIO.PWM):
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
            pins[pin_number] = self
        elif isinstance(pins[pin_number], PwmPin):
            print(f"Warning: {pin_number} was a pwm pin. Resetting it now")
            pins[pin_number].stop()
            pins[pin_number] = self
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

def reset():
    for each_key, each_value in pins.items():
        if isinstance(each_value, GPIO.PWM):
            each_value.stop()
    GPIO.cleanup()

back_left_wheel   = Wheel(speed_pin=32, toggle_pin=36, name="back_left_wheel")
back_right_wheel  = Wheel(speed_pin=38, toggle_pin=40, name="back_right_wheel")
front_left_wheel  = Wheel(speed_pin=33, toggle_pin=31, name="font_left_wheel")
front_right_wheel = Wheel(speed_pin=37, toggle_pin=35, name="font_right_wheel")

wheels = [
    back_left_wheel,
    back_right_wheel,
    front_left_wheel,
    front_right_wheel,
]
def test_wheels(wheels):
    while True:
        for each_wheel in wheels:
            forwards = 1
            backwards = -1
            print(f'''{each_wheel.name}''')
            for each_direction in [forwards, backwards]:
                if each_direction == forwards:
                    print(f'''    forwards''')
                else:
                    print(f'''    backwards''')
                
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

class Car:
    def go(left_velocity, right_velocity):
        back_left_wheel.spin(left_velocity)
        front_left_wheel.spin(left_velocity)
        back_right_wheel.spin(right_velocity)
        front_right_wheel.spin(right_velocity)
    
    def drive(velocity, spin):
        """
            negative spin means left
        """
        velocity =  100 if velocity >  100 else velocity
        velocity = -100 if velocity < -100 else velocity
        spin     =  100 if spin     >  100 else spin
        spin     = -100 if spin     < -100 else spin
        
        spin = spin/2
        left = velocity-spin  # 100-25
        right = velocity+spin # 100+25
        if right > 100:
            extra = right-100 # 25
            right = 100
            left -= extra     # (100-25)-25
        if right < -100:      
            # left  = -100+25
            # right = -100-25
            extra = right+100 # -25
            right = -100
            left -= extra # (-100+25)-(-25) => -50
        if left > 100:
            extra = left-100 # 25
            left = 100
            right -= extra     # (100-25)-25
        if left < -100:      
            # right  = -100+25
            # left = -100-25
            extra = left+100 # -25
            left = -100
            right -= extra # (-100+25)-(-25) => -50
        
        Car.go(left, right)
        

