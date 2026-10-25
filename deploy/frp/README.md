# Public hosting via an frp relay

The server stays on your machine. The VPS runs one binary and relays the
game's ports to it. A normal tunnel (ngrok, localtunnel) cannot do this: the
client dials fixed ports, so each public port must equal the local one.

## 1. On the VPS

Download frp (match the arch, usually `linux_amd64`) from
https://github.com/fatedier/frp/releases and unpack it:

    curl -LO https://github.com/fatedier/frp/releases/download/v0.61.1/frp_0.61.1_linux_amd64.tar.gz
    tar xzf frp_0.61.1_linux_amd64.tar.gz
    cd frp_0.61.1_linux_amd64

Copy `frps.toml` from this directory next to the `frps` binary, then change
`auth.token` to a long random string:

    openssl rand -hex 32

Open the firewall. Replace the addresses - `YOUR-HOME-IP` is the machine
running web-tiger, `PLAYER-IP` is each person playing:

    ufw allow from YOUR-HOME-IP to any port 7000 proto tcp
    ufw allow from PLAYER-IP to any port 1011,1020,32000,32001,32004,32005,32008,32009,32556,37000,37001 proto tcp

Run it:

    ./frps -c frps.toml

To keep it running, `/etc/systemd/system/frps.service`:

    [Unit]
    Description=frp relay for web-tiger
    After=network.target

    [Service]
    ExecStart=/opt/frp/frps -c /opt/frp/frps.toml
    Restart=always
    RestartSec=5

    [Install]
    WantedBy=multi-user.target

    systemctl enable --now frps

## 2. On the machine running web-tiger

Unpack the same release, copy `frpc.toml` next to the `frpc` binary, and set
`serverAddr` to the VPS address and `auth.token` to the same secret. Then:

    ./frpc -c frpc.toml

`frpc` connects OUT to the VPS, so nothing needs opening on your router.

## 3. Tell the client where BAP lives

Sign-on hands the client an address for the Bungie Access Protocol, and it
defaults to 127.0.0.1 - through a relay that would make the console dial
itself. In web-tiger's `.env`:

    BAP_SIGNON_IP=<vps-public-ip>
    BAP_BIND_IP=0.0.0.0

Restart the server so it picks them up.

## 4. Check it before involving anyone else

On the VPS, every game port should be listening (frps owns them):

    ss -ltnp | grep -E '1020|37000|32000'

From a machine outside your network:

    nc -vz <vps-public-ip> 37000

## 5. Each player's console

The Sunrise plugin reads its target from its INI, `[HALO_OPTIONS]`
`BlamNetDomain` (default `dev.xbl.lsp.blam.network`, see
`sunrise_plugin/Sunrise2/Utilities.cpp`). Set it to the VPS's address or a
hostname pointing at it. That single name carries every port.

## Before you open it up

web-tiger has no authentication: anyone who can reach these ports can sign
in, create characters and drive activity-host traffic. The `ufw` rules above
restrict that to known addresses - prefer keeping them rather than opening
the ports to everyone. `allowPorts` in `frps.toml` separately stops a leaked
token from publishing anything other than the game's own ports.
