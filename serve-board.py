#!/usr/bin/env python3
"""
serve-board.py — serve the board deck and proxy the local model, so the
"Ask Smart Radiology" screen works with no key in the browser and no CORS.

    python3 serve-board.py                       # loopback + Tailscale
    python3 serve-board.py --host 127.0.0.1      # loopback only
    python3 serve-board.py --host tailscale      # Tailnet address only
    python3 serve-board.py --port 9000 --upstream http://100.85.251.72:8080

--host takes a comma-separated list; "tailscale" resolves to this machine's
100.64.0.0/10 address. Nothing binds 0.0.0.0: loopback and the Tailnet only.

Reads the local model key from HERMES_CUSTOM_Q3_8FN128K_API_KEY in the
environment, or from ~/.hermes/.env. Nothing is written to disk; nothing is
sent to any cloud service. GET /api/health reports whether a key was found.
"""
import argparse, http.server, json, os, socket, socketserver, subprocess, sys, threading
import urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.expanduser("~/.hermes/.env")


def load_key():
    key = os.environ.get("HERMES_CUSTOM_Q3_8FN128K_API_KEY", "").strip()
    if key:
        return key
    try:
        with open(ENV_FILE) as fh:
            for line in fh:
                line = line.strip()
                if line.startswith("HERMES_CUSTOM_Q3_8FN128K_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    return ""


def tailscale_ip():
    """First Tailnet address on this machine, however it is reachable."""
    import re
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
    upstream = "http://127.0.0.1:8080/v1/chat/completions"
    key = ""

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))

    def _json(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/health":
            return self._json(200, {"ok": True, "model_key": bool(self.key),
                                    "upstream": self.upstream})
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != "/api/ask":
            return self._json(404, {"error": "not found"})
        if not self.key:
            return self._json(503, {"error": "no model key configured on this machine"})
        try:
            length = int(self.headers.get("Content-Length") or 0)
            payload = json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            return self._json(400, {"error": "bad json"})

        body = json.dumps({
            "model": payload.get("model", "qwen3.8-flash-next-unsloth-ud-q4_k_xl"),
            "stream": True,
            "temperature": 0.2,
            "max_tokens": 180,
            "chat_template_kwargs": {"enable_thinking": False},
            "messages": payload.get("messages", []),
        }).encode()
        req = urllib.request.Request(self.upstream, data=body, method="POST", headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + self.key,
        })
        try:
            upstream = urllib.request.urlopen(req, timeout=25)
        except (urllib.error.URLError, OSError) as exc:
            return self._json(502, {"error": str(exc)})

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            for chunk in upstream:
                self.wfile.write(chunk)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            upstream.close()


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
    ap.add_argument("--upstream", default="http://127.0.0.1:8080/v1/chat/completions")
    args = ap.parse_args()
    Handler.upstream = args.upstream
    Handler.key = load_key()

    hosts = resolve_hosts(args.host)
    print("Smart Radiology board deck:")
    for host in hosts:
        print("  http://%s:%d/" % (host, args.port))
    print("Local model: %s  (key %s)" % (args.upstream, "found" if Handler.key else "MISSING"))

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
