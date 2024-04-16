import subprocess
import os
import time
import json
import threading
import atexit
import math
import numpy as np

from websockets.sync.client import connect
from rigorous_recorder import RecordKeeper, ExperimentCollection

# from scipy.spatial.transform import Rotation as R



config = dict(
    car_address = "192.168.1.100",
    car_port = 8080,
)
logging_folder = "./logs"

def quaternion_to_yaw_pitch_roll(quaternion):
    rotation_matrix = R.from_quat(quaternion).as_matrix()
    yaw_pitch_roll = R.from_matrix(rotation_matrix).as_euler('zyx', degrees=True)
    return yaw_pitch_roll

def quaternion_dot(q1, q2):
    # Compute dot product of two quaternions
    return np.dot(q1, q2)

def quaternion_angle(q1, q2):
    dot_product = quaternion_dot(q1, q2)
    # Compute angle between two quaternions using dot product
    angle_rad = 2 * np.arccos(np.abs(dot_product))
    if angle_rad != angle_rad:
        angle_rad = 0
    # Convert angle from radians to degrees
    angle_deg = np.degrees(angle_rad)
    return angle_deg

# 
# thread helper
# 
threads_to_join = []
@atexit.register
def exit_handler():
    for index,each in enumerate(threads_to_join):
        if hasattr(each, 'stop'):
            try:
                each.stop()
            except Exception as error:
                pass
    for index,each in enumerate(threads_to_join):
        each.join()

try:

    import threading
    import time

    class ThreadWithException(threading.Thread):
        def __init__(self, *args, **kwargs):
            if len(kwargs)==0 and len(args)==1 and callable(args[0]):
                threading.Thread.__init__(self, target=args[0])
            else:
                threading.Thread.__init__(self, *args, **kwargs)
            self.name = getattr(kwargs.get("target", {}), '__name__', None)
        
        def _bootstrap(self, stop_thread=False):
            def stop():
                nonlocal stop_thread
                stop_thread = True
            self.stop = stop

            def tracer(*_):
                if stop_thread:
                    exit()
                    raise KeyboardInterrupt()
                return tracer
            sys.settrace(tracer)
            super()._bootstrap()
    # 
    # keyboard helper
    # 
    import sys
    import select
    import tty
    import termios

    def is_data():
        return select.select([sys.stdin], [], [], 0) == ([sys.stdin], [], [])

    # 
    # connection to VR remote
    # 
    position_time = time.time() 
    position_should_be_listening = False
    position = None # [ x_axis, y_axis, height_axis, pitch, roll, yaw, roll? ]
    vr_message_recorder = RecordKeeper()
    vr_message_recorder.live_write_to(f"{logging_folder}/vr_messages.yaml", as_yaml=True)
    def record_position_func():
        global position, position_time
        while True:
            if not position_should_be_listening:
                time.sleep(2)
                continue
            try:
                vr_message_recorder.push(status=f'''trying to connect to VR tracker''')
                # sadly the websocketd from libsurvive is hardcoded to be port
                with connect("ws://localhost:8080") as websocket:
                    vr_message_recorder.push(status=f'''got connection''')
                    while 1:
                        message = websocket.recv()
                        if "ERR" in message:
                            vr_message_recorder.push(message=f'''{message}''')
                        if "POSE" in message and not "T20" in message and not "LH_" in message:
                            position = [
                                float(each)
                                    for each in message.split(" ")
                                        if len(each) > 0 and (each[0].isdigit() or each[0]=="-") 
                            ][1:]
                            now = time.time()
                            if position_time+1 <= now:
                                position_time = time.time()
            except Exception as error:
                print(f'''error listening to position ({error})\nTrying to reconnect''')
                
    record_position_thread = ThreadWithException(target=record_position_func, args=())
    record_position_thread.start()
    threads_to_join.append(record_position_thread)
    
    # 
    # save to file thread
    # 
    trajectory_file_path = f"{logging_folder}/trajectory.yaml"
    trajectory_recorder = RecordKeeper()
    trajectory_recorder.live_write_to(trajectory_file_path, as_yaml=True)
    record_rate = 1 # second
    prev_quat = None
    def write_trajector_func():
        global prev_quat
        while True:
            if position:
                x_axis, y_axis, height_axis, *quaternion = position
                angle_change = 0
                if prev_quat != None:
                    angle_change = quaternion_angle(prev_quat, quaternion)
                prev_quat = quaternion
                
                # yaw, pitch, roll = quaternion_to_yaw_pitch_roll(quaternion)
                trajectory_recorder.push(
                    quaternion=quaternion,
                    x_axis=x_axis,
                    y_axis=y_axis,
                    height_axis=height_axis,
                    angle_change=angle_change,
                )
            time.sleep(record_rate)
    
    write_trajector_thread = ThreadWithException(target=write_trajector_func, args=())
    write_trajector_thread.start()
    threads_to_join.append(write_trajector_thread)

    # 
    # connection to car
    # 
    car_address = config.get("car_address", None)
    car_port = config.get("car_port", None)
    car_process = None
    next_action = None # [ x_axis, y_axis, height_axis, pitch, roll, yaw, roll? ]
    def send_action():
        global car_address, car_port, next_action, car_process
        while True:
            # FIXME: DEBUGGING: disable
            time.sleep(5)
            continue
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
    send_action_thread = ThreadWithException(target=send_action, args=())
    send_action_thread.start()
    threads_to_join.append(send_action_thread)
    

    # 
    # car handler
    #
    steer_increment_rate = 20
    speed_increment_rate = 20 
    class LiveValues:
        iteration = 0
        car_speed = 0
        car_steer = 0
        compensation = 0
    
    # 
    # wait for positions
    # 
    vr_process_log_file = open(f"{logging_folder}/vr_process.log", "w")
    # process = subprocess.Popen(["sudo", "-E", "env", f"PATH={os.getenv('PATH')}", "survive-websocketd",], stdout=vr_process_log_file, stderr=vr_process_log_file) 
    process = subprocess.Popen(["sudo", "-E", "env", f"PATH=/home/jeffhykin/repos/valve_car_tracker/virkshop/commands:/home/jeffhykin/repos/valve_car_tracker/.venv/bin:/home/jeffhykin/repos/valve_car_tracker/virkshop/temporary.ignore/long_term/home/.local/bin:/nix/store/bap4d0lpcrhpwmpb8ayjcgkmvfj62lnq-bash-interactive-5.1-p16/bin:/nix/store/nyjxcn992aqcm00l7i1hw3fjqk6281n7-pkg-config-wrapper-0.29.2/bin:/nix/store/rxb9zl1mdx9f2n3z0nyv9zhngj3f2pw0-cmake-3.24.3/bin:/nix/store/n1jgqr8xzjz9shn3ads5x07p8lqn5rqk-patchelf-0.14.5/bin:/nix/store/r7r10qvsqlnvbzjkjinvscjlahqbxifl-gcc-wrapper-11.3.0/bin:/nix/store/d7q0qfm12hb59wj63wyjs0hrdhmmapfz-gcc-11.3.0/bin:/nix/store/vkwlwmagq5i0if2f60ywrg2gxjf5xr9i-glibc-2.34-210-bin/bin:/nix/store/47n5hzqpahs7yv84ia6cxp3jg9ca8r86-coreutils-9.0/bin:/nix/store/10h6ymfb28wx6x8amj82h2sgw3ixrsb2-binutils-wrapper-2.38/bin:/nix/store/2b99rpx8zwdjjqkrvk7kqgn9mxhiidjy-binutils-2.38/bin:/nix/store/bh73byv9p75msk9qz73jkfvzgcdrlfz6-deno-1.38.2/bin:/nix/store/w351p16m7n4ars8wjlmbkhb6k9q169dn-nix-2.11.0/bin:/nix/store/3f55f22bjm09aq4cxrk89720kbrlmrlz-zsh-5.9/bin:/nix/store/r78jv9xgxnvsm5vpasf5ldkc28pkri6r-which-2.21/bin:/nix/store/hl5lsmyf6alwj91nv8kmg2iz1lbnxym9-curl-7.86.0-dev/bin:/nix/store/39m0xn31z7n44wflfxqq7fbjh1ik6xq7-brotli-1.0.9/bin:/nix/store/0lm4ygslgn65xi9pkw2kw29qiqqd80hz-libkrb5-1.20-dev/bin:/nix/store/r7gl900my2fw6k33nxh2r7rzv8nv0s25-libkrb5-1.20/bin:/nix/store/n8jl8q7kk4a03n4gjiymy4y4hpcp2apm-nghttp2-1.49.0-bin/bin:/nix/store/hfkdbq95wsm9a0zf2hz51ads25h657hx-libidn2-2.3.2-bin/bin:/nix/store/fq47cv26nb87hwz2678r6i8ym5b57lwf-openssl-3.0.7-bin/bin:/nix/store/mb0pcxkmrg0f6k0zaywlnvpk9q3j5ans-zstd-1.5.2-bin/bin:/nix/store/w10in9diaqrcqqxi5lg20n3q2jfpk6pq-zstd-1.5.2/bin:/nix/store/52fbv6j49khca4cfvwm35fqd984w2520-curl-7.86.0-bin/bin:/nix/store/2yyqkr25dw3f18yl7xf5ndffk7950285-less-608/bin:/nix/store/26g7nm0ps69xdyn1am9rmvrfg2zkkbmg-man-db-2.10.2/bin:/nix/store/a7gvj343m05j2s32xcnwr35v31ynlypr-coreutils-9.1/bin:/nix/store/mydc6f4k2z73xlcz7ilif3v2lcaiqvza-findutils-4.9.0/bin:/nix/store/kblplvpffcfn0zprj80vh41xchjx4jag-wget-1.21.3/bin:/nix/store/5n5pjgv0pjdxfkbaqi3nl6wp55zlzcxy-nano-7.0/bin:/nix/store/p1qrn27c0q3x0338vy02v67jbc8zk0ar-tree-2.0.4/bin:/nix/store/sa89kb77dzl31sqil9d9qdkswbynqi79-zip-3.0/bin:/nix/store/99l0fzkgzl40z74qp35f260hsa0kzgif-unzip-6.0/bin:/nix/store/gp2qn4vdw0fqkrds051bnaw2xkk3fyk3-git-2.38.1/bin:/nix/store/lg0swhg187g5rrx4i0x2gig0aacvpmb4-openssh-9.1p1/bin:/nix/store/c764i0snsvvhv8iv6sp35aqsv51h8zkq-colorls-1.4.6/bin:/nix/store/6fxffaff2rq8iwk3qbvl6afim6hps05q-ping-iputils-20211215/bin:/nix/store/q8j0lrw74cj4aj8lz8552s34xd8rv5rp-ifconfig-net-tools-2.10/bin:/nix/store/g0gm3np0qv7p984rhr6pcj15yk9n7hav-netstat-net-tools-2.10/bin:/nix/store/c2kp91rx3g5sdz2pl67j4359ywxgs8vm-arp-net-tools-2.10/bin:/nix/store/rysa0pdj4i5nlxgq4zzqqiwn01sw8qrb-route-net-tools-2.10/bin:/nix/store/nq0bzlqzmxkrdp3qk37xlskybhn15r7k-col-util-linux-2.38.1/bin:/nix/store/b5w4yp6nbv920qnpca4r5hvx0rhbai6b-column-util-linux-2.38.1/bin:/nix/store/3f4xfhada9zljjfrjc4zmqvz1csr9sl0-fdisk-util-linux-2.38.1/bin:/nix/store/cgrbm9xjw537d5dwn7w1vlj0v3si43l5-fsck-util-linux-2.38.1/bin:/nix/store/3am2p6lny1dvciyyi9pi27qh0pgjmn8a-getconf-glibc-2.35-163/bin:/nix/store/hadw0s30h4568rrggi2kym032b4rxira-getent-glibc-2.35-163/bin:/nix/store/jvjf320a03b62m8qb2qy1v2nyvxn7rxa-getopt-util-linux-2.38.1/bin:/nix/store/ia2hifpldib3l44mv3mky5fba125bnap-hexdump-util-linux-2.38.1/bin:/nix/store/z9pqgq30037rgznd7yrm292v5kwc6l2p-hostname-net-tools-2.10/bin:/nix/store/n05kypylbqfkvg4jbah639yyrz7qqizw-killall-psmisc-23.5/bin:/nix/store/a8z73i9jvqh09mxkacia8j2f3d74b7zy-locale-glibc-2.35-163/bin:/nix/store/vqqr4kicm34ry83xj4pvrsmvaw6cnkmz-more-util-linux-2.38.1/bin:/nix/store/fsdjiwm6y8gxgv6m3kk6kqlgbspnfqsb-mount-util-linux-2.38.1/bin:/nix/store/3mly68l3r0g4i51x7991h5iviamlb854-ps-procps-3.3.16/bin:/nix/store/6379ddsw1v67pminbm6kyw4jin40fjwd-quota-quota-4.06/bin:/nix/store/w9szh473jbd6n2v6xzq9dqd61zwmx0r2-script-util-linux-2.38.1/bin:/nix/store/rdibnkbprs45r3lz8nb76a6bbgl5srv2-sysctl-procps-3.3.16/bin:/nix/store/gh4973yzlrvcanvy2jpi7s8cc59bppip-top-procps-3.3.16/bin:/nix/store/prii1pa6i738r11zvvarwd2v32igp0ic-umount-util-linux-2.38.1/bin:/nix/store/gbq0g4jgpwljp6h4cm2ga2z426dm3qhs-whereis-util-linux-2.38.1/bin:/nix/store/saa6naz93qyxd9qg9yibfaxqp62q4mxk-write-util-linux-2.38.1/bin:/nix/store/n9pyngw08vrmdnjppyl79g2cw9ls1a2r-fd-8.5.3/bin:/nix/store/ya62x65w2jc361liyzqnx3xpr9vxz2q4-sd-0.7.6/bin:/nix/store/5xdcg0qykmsclq0z81kfs2zwbcvm03nn-dua-2.18.0/bin:/nix/store/61d16lyvyxlb83wp635wmcpyai2nrw2r-tealdeer-1.6.1/bin:/nix/store/mgzillpdmm999k1j2h3cdy22rqm7dvxa-bottom-0.6.8/bin:/nix/store/dicf7l3szs5ql832id4z1g0bfg31qjh6-exa-0.10.1/bin:/nix/store/765yy3j2x7q5vyngqb28ci44f8639ix5-git-subrepo-0.4.5/bin:/nix/store/mycsjqkf0adh8wsl3pf5kn29ag9gi6x2-python3-3.8.15/bin:/nix/store/z6m194l66fizkzg8w9002cng92sclc21-python3.8-pip-22.2.2/bin:/nix/store/r1v2rh2ql6zpfvapgniryy3bb71ls6sw-python3.8-virtualenv-20.16.5/bin:/nix/store/j0y03ralm9k7l71jf3700ajdwrrrfdim-python3.8-wheel-0.37.1/bin:/nix/store/j8xp7yxccsfdvww8b6mjmcmfr269wpvc-python3.8-wxPython-4.1.1/bin:/nix/store/ffzszbbm2x51p5zqiaq7pxsbx8pn5bk2-python3.8-numpy-1.23.3/bin:/nix/store/dq0xwmsk1g0i2ayg6pb7y87na2knzylh-gcc-wrapper-11.3.0/bin:/nix/store/1gf2flfqnpqbr1b4p4qz2f72y42bs56r-gcc-11.3.0/bin:/nix/store/57xv61c5zi8pphjbcwxxjlgc34p61ic9-glibc-2.35-163-bin/bin:/nix/store/1d6ian3r8kdzspw8hacjhl3xkp40g1lj-binutils-wrapper-2.39/bin:/nix/store/039g378vc3pc3dvi9dzdlrd0i4q93qwf-binutils-2.39/bin:/nix/store/7h5psr5dn8lmypz2n5r3y1sq0pj2n3bh-gtk+3-3.24.34-dev/bin:/nix/store/mzbh5fx4s9bpaxqjz546rrha5jk88sv8-expat-2.5.0-dev/bin:/nix/store/y1ffp4g3yl0ijwdl8lgh4hhq3wl8frcc-dbus-1.14.4-lib/bin:/nix/store/78pyly6806z9r9ppmwi35yr0gp5441rp-dbus-1.14.4/bin:/nix/store/5ql2vc3lds2pmk6j61w0hkkssrik54pi-glib-2.74.1-dev/bin:/nix/store/ahb1jl345mpn3v8my8aj77df294q59ij-gettext-0.21/bin:/nix/store/bviyy13bg3p7ajwisxx74k0hsxwff2wk-glib-2.74.1-bin/bin:/nix/store/ldmvgva6q2vgij7i3j0ikl7m1yiiym7l-cairo-1.16.0-dev/bin:/nix/store/v2lzlm6dkp9f5kjva1sza5d3hfr2k8jg-freetype-2.12.1-dev/bin:/nix/store/a8mhcagrsly7c7mpjrpsnaahk4aax056-bzip2-1.0.8-bin/bin:/nix/store/ifswzxzvkxjyv7rq6i1a90vsw3n6ia1n-libpng-apng-1.6.37-dev/bin:/nix/store/hddfy21yvig2rz2ldxgd20y66d3di7ga-fontconfig-2.14.0-bin/bin:/nix/store/qx1955hp5ghvp6j3g4vxyli87wbmc35w-fribidi-1.0.12/bin:/nix/store/7kbgz39rhmlz50avspr6vkgzgxd0hp9m-gdk-pixbuf-2.42.10-dev/bin:/nix/store/wwqnsjrk9ws6dfp5chxb6r3wcawbra1y-libjpeg-turbo-2.1.4-bin/bin:/nix/store/zlcnmqq14jz5x9439jf937mvayyl63da-xz-5.2.7-bin/bin:/nix/store/3k4dxm0j11b2gr59ws8g5wr6v75vywml-libtiff-4.4.0-bin/bin:/nix/store/crz3s569f4dyc5ynldizlk53g6bkw7s5-gdk-pixbuf-2.42.10/bin:/nix/store/vlaznlvdmcyj8kqw6x9c703d178myl0a-harfbuzz-5.2.0-dev/bin:/nix/store/ppipcv58wj9xp7impnqblrhz5j9q1gdg-graphite2-1.3.14/bin:/nix/store/z74h59mqjficgkq1nxdbxkq3w97k9qvb-pango-1.50.11-bin/bin:/nix/store/fpvyv7cj3di7636107467imnq8jw0q6c-wayland-1.21.0-bin/bin:/nix/store/mdwypx1c6g5m1yjamwp7ihygy47wncxl-cups-2.4.2-dev/bin:/nix/store/2fsarh314rqx282hazy475y9d8lj3aqj-cups-2.4.2/bin:/nix/store/2j2znigd8ak37rlwh9khz0ry3clqlw1l-gtk+3-3.24.34/bin:/nix/store/5k04gqmy9qrddil2wd9cqyr4s4pmrx3c-libsurvive-1.01/bin:/nix/store/n60gh27xlpc7h699500n08lmky8l569b-websocketd-0.4.1/bin:/nix/store/47n5hzqpahs7yv84ia6cxp3jg9ca8r86-coreutils-9.0/bin:/nix/store/6ib6hn9fq8mgkdq2nq5f7kz050p49rp2-findutils-4.9.0/bin:/nix/store/685c5dr4agkf7vx8ya7f1r9rd9qwg2ri-diffutils-3.8/bin:/nix/store/sppjn85p06m1il70kd05drg1j26cjxd3-gnused-4.8/bin:/nix/store/49vp3yp54fqliy7k8gvxsybd50l9a82f-gnugrep-3.7/bin:/nix/store/fr7vrxblkj327ypn3vhjwfhf19lddqqd-gawk-5.1.1/bin:/nix/store/5p3qyadsv163m7zvqssiw80zh6xfv2jv-gnutar-1.34/bin:/nix/store/2bwqikh67y1231ccb71gjfrggwjw066q-gzip-1.12/bin:/nix/store/wjf2554ffvap47vanabh9lk0dmj1q295-bzip2-1.0.6.0.2-bin/bin:/nix/store/2hvj24gaq4y32cyf0jp9sj01y00k7czy-gnumake-4.3/bin:/nix/store/0d3wgx8x6dxdb2cpnq105z23hah07z7l-bash-5.1-p16/bin:/nix/store/wa31fy0bgmq7p2gcvh5xyrr7m2v8i3s2-patch-2.7.6/bin:/nix/store/dr5shmim604rh50mmihwfic80k0wa3k0-xz-5.2.5-bin/bin:/home/jeffhykin/repos/valve_car_tracker/virkshop/temporary.ignore/long_term/home/.local/bin", "/nix/store/5k04gqmy9qrddil2wd9cqyr4s4pmrx3c-libsurvive-1.01/bin/survive-websocketd",], stdout=vr_process_log_file, stderr=vr_process_log_file) 
    time.sleep(2)
    position_should_be_listening = True
    while position == None:
        print(f'''waiting for VR tracker to connect (make sure plugged in and on, sometimes it takes 120 seconds)''')
        time.sleep(10)
    print(f'''connected!''')
    
    # 
    # handle keypresses
    # 
    old_settings = termios.tcgetattr(sys.stdin)
    try:
        tty.setcbreak(sys.stdin.fileno())
        while True:
            key = ""
            while is_data():
                key += sys.stdin.read(1)
                if key == "\x1b":
                    key += sys.stdin.read(2)
            
            if key != "":
                # up
                if key == "\x1b[A":
                    LiveValues.car_speed += speed_increment_rate
                    if LiveValues.car_speed > 100:
                        LiveValues.car_speed = 100
                # down
                elif key == "\x1b[B":
                    LiveValues.car_speed -= speed_increment_rate
                    if LiveValues.car_speed < -100:
                        LiveValues.car_speed = -100
                # right
                elif key == "\x1b[C":
                    LiveValues.car_steer -= steer_increment_rate
                    if LiveValues.car_steer < -100:
                        LiveValues.car_steer = -100
                # left
                elif key == "\x1b[D":
                    LiveValues.car_steer += steer_increment_rate
                    if LiveValues.car_steer > 100:
                        LiveValues.car_steer = 100
                else:
                    print("unhandled key: " + repr(key))
                
                direction = LiveValues.car_steer+LiveValues.compensation
                next_action = dict(velocity=LiveValues.car_speed, direction=direction)
    finally:
        termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_settings)
except KeyboardInterrupt:
    exit_handler()