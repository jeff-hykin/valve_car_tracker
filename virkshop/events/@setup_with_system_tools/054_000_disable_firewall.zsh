# if ufw exists
if [ -n "$(command -v "ufw")" ]
then
    # if systemctl exists
    if [ -n "$(command -v "systemctl")" ]
    then
        echo "        NOTE: I'm disabling the firewall so that the socket will be accessible"
        echo "              rebooting will enable it again"
        echo "              it can also be manually re-enabled with:"
        echo "                  sudo systemctl stop ufw"
        sudo systemctl stop ufw
    fi
fi