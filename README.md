1. clone this repo
2. cd to this directory
3. run `virkshop/enter`
4. (if it fails with "bad gateway" or "file could not be found" run it one or two more times)
5. Once the headset is plugged in, run `survive-cli --v 5` to calibrate it. (it won't say "done" so you'll have to kill it after a while)
- plug in everything from the headset
- plug the controller into the computer to pair it
6. Then run `survive-websocketd` and open the file-url it prints out in a browser to get a visualization
7. test out the `libsurive` command and the python `pysurvive` library
    - https://github.com/cntools/libsurvive


Debugging:
- if the movement is all weird, try unplugging the lighthouses and plugging them back in