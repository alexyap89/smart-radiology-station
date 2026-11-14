#!/usr/bin/env python3
"""
serve-board.py — serve the board deck on loopback and the Tailnet.

    python3 serve-board.py                       # loopback + Tailscale
    python3 serve-board.py --host 127.0.0.1      # loopback only
    python3 serve-board.py --host tailscale      # Tailnet address only
    python3 serve-board.py --port 9000

--host takes a comma-separated list; "tailscale" resolves to this machine's
100.64.0.0/10 address. Nothing binds 0.0.0.0: loopback and the Tailnet only,
never the hospital LAN. There is no model endpoint and no key handling — the
deck is static.
"""
import argparse, http.server, os, re, socket, socketserver, subprocess, sys, threading

HERE = os.path.dirname(os.path.abspath(__file__))


def tailscale_ip():
    """First Tailnet address on this machine, however it is reachable."""
    candidates = []
    for exe in ("tailscale", "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
                "/usr/local/bin/tailscale", "/opt/homebrew/bin/tailscale"):
        try:
            out = subprocess.run([exe, "ip", "-4"], capture_output=True,
                                 text=True, timeout=5).stdout
            candidates += re.findall(r"\b(100\.\d+\.\d+\.\d+)\b", out)
            if candidates:
                return candidates[0]
        except (OSError, subprocess.SubprocessError):
            continue
    try:
        out = subprocess.run(["ifconfig"], capture_output=True, text=True, timeout=5).stdout
        candidates += re.findall(r"inet\s+(100\.\d+\.\d+\.\d+)", out)
        if candidates:
            return candidates[0]
    except (OSError, subprocess.SubprocessError):
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            addr = info[4][0]
            if addr.startswith("100."):
                return addr
    except OSError:
        pass
    return None


def resolve_hosts(spec):
    hosts = []
    for token in [t.strip() for t in spec.split(",") if t.strip()]:
        if token.lower() == "tailscale":
            token = tailscale_ip() or "127.0.0.1"
        if token not in hosts:
            hosts.append(token)
    return hosts


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def serve(host, port):
    Server((host, port), Handler).serve_forever()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1,tailscale",
                    help='comma list; "tailscale" resolves to the Tailnet address')
    ap.add_argument("--port", type=int, default=8123)
    args = ap.parse_args()

    hosts = resolve_hosts(args.host)
    print("Smart Radiology board deck:")
    for host in hosts:
        print("  http://%s:%d/" % (host, args.port))

    if len(hosts) == 1:
        serve(hosts[0], args.port)
        return
    threads = [threading.Thread(target=serve, args=(h, args.port), daemon=True) for h in hosts]
    for t in threads:
        t.start()
    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
