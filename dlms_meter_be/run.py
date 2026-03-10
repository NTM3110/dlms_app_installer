import os
import subprocess
import sys
import signal
import socket
import time
import threading
import webbrowser
from typing import Mapping, Sequence
from dataclasses import dataclass

from app.db import Base, engine

# -------------------------------------------------------------------
# DB INIT
# -------------------------------------------------------------------

def init_db():
    Base.metadata.create_all(engine)

# -------------------------------------------------------------------
# SERVER & BACKGROUND SERVICES
# -------------------------------------------------------------------

@dataclass(frozen=True)
class Cmd:
    uvicorn: tuple[str, ...]
    celery: tuple[str, ...]
    celery_beat: tuple[str, ...]

def get_data_dir() -> str:
    """Returns a writable directory for app data."""
    if os.name == "nt":
        app_data = os.environ.get("LOCALAPPDATA", os.path.expanduser("~\\AppData\\Local"))
        data_dir = os.path.join(app_data, "DLMSMeterApp")
    else:
        data_dir = os.path.expanduser("~/.dlms_meter_app")
    
    if not os.path.exists(data_dir):
        os.makedirs(data_dir, exist_ok=True)
    return data_dir

APP_DATA_DIR = get_data_dir()

def _env() -> dict[str, str]:
    env = os.environ.copy()
    repo_root = os.path.dirname(os.path.abspath(__file__))
    # Ensure current directory is in PYTHONPATH
    env["PYTHONPATH"] = repo_root + (os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else "")
    # Pass down the data directory to subprocesses
    env["APP_DATA_DIR"] = APP_DATA_DIR
    return env

def _port_available(host: str, port: int) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((host, port))
        return True
    except OSError:
        return False
    finally:
        try:
            s.close()
        except Exception:
            pass

def _start(cmd: Sequence[str], env: Mapping[str, str]) -> subprocess.Popen:
    return subprocess.Popen(tuple(cmd), env=dict(env), start_new_session=True)

def _send_pg(proc: subprocess.Popen, sig: int) -> None:
    if proc.poll() is not None:
        return
    if os.name != "posix":
        try:
            proc.send_signal(sig)
        except ProcessLookupError:
            pass
        return
    try:
        os.killpg(proc.pid, sig)
    except ProcessLookupError:
        pass

def _kill_pg(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    _send_pg(proc, signal.SIGKILL)

def _stop(proc: subprocess.Popen, *, term_timeout_s: float, kill_timeout_s: float) -> None:
    if proc.poll() is not None:
        return

    _send_pg(proc, signal.SIGTERM)

    term_deadline = time.monotonic() + term_timeout_s
    while time.monotonic() < term_deadline:
        if proc.poll() is not None:
            return
        time.sleep(0.05)

    _kill_pg(proc)

    kill_deadline = time.monotonic() + kill_timeout_s
    while time.monotonic() < kill_deadline:
        if proc.poll() is not None:
            return
        time.sleep(0.05)


def start_server() -> int:
    env = _env()

    host = "0.0.0.0"
    port = 8000
    if not _port_available(host, port):
        sys.stderr.write(f"ERROR: Port {port} is already in use on {host}\n")
        return 1

    if getattr(sys, 'frozen', False):
        # We are running as a PyInstaller bundle
        # Instead of calling `python -m xyz`, we call our own executable
        cmd = Cmd(
            uvicorn=(sys.executable, "serve_uvicorn"),
            celery=(sys.executable, "serve_celery"),
            celery_beat=(sys.executable, "serve_celery_beat"),
        )
    else:
        # Normal python execution
        cmd = Cmd(
            uvicorn=(sys.executable, "-m", "uvicorn", "main:app", "--host", host, "--port", str(port)),
            celery=(
                sys.executable,
                "-m",
                "celery",
                "-A",
                "service.tasks.celery_app",
                "worker",
                "--loglevel=INFO",
                "--pool=solo",
                "--concurrency=1"
            ),
            celery_beat=(
                sys.executable,
                "-m",
                "celery",
                "-A",
                "service.tasks.celery_app",
                "beat",
                "--loglevel=INFO",
                "--schedule", os.path.join(APP_DATA_DIR, "celerybeat-schedule")
            ),
        )


    uvicorn_p = _start(cmd.uvicorn, env)

    time.sleep(0.3)
    if uvicorn_p.poll() is not None:
        return 1

    celery_p = _start(cmd.celery, env)
    celery_beat_p = _start(cmd.celery_beat, env)
    

    # ── Shutdown event (triggered by tray "Quit" or a crashed subprocess) ──
    stop_event = threading.Event()

    def _shutdown(exit_code: int = 0) -> None:
        stop_event.set()  # wake up the main loop
        _stop(celery_beat_p, term_timeout_s=5.0, kill_timeout_s=2.0)
        _stop(celery_p, term_timeout_s=5.0, kill_timeout_s=2.0)
        _stop(uvicorn_p, term_timeout_s=2.0, kill_timeout_s=2.0)
        sys.exit(exit_code)

    def _handle(_sig: int, _frame: object) -> None:
        _shutdown(0)

    signal.signal(signal.SIGINT, _handle)
    signal.signal(signal.SIGTERM, _handle)

    # ── System tray icon ──────────────────────────────────────────────────
    def _make_tray_icon():
        """Build a minimal 64x64 blue-circle icon without requiring image files."""
        try:
            from PIL import Image, ImageDraw
            img = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            draw.ellipse([4, 4, 60, 60], fill=(1, 37, 150, 255))   # dark blue
            draw.ellipse([20, 20, 44, 44], fill=(255, 255, 255, 200))  # white dot
            return img
        except Exception:
            # Fallback: 1x1 transparent image if PIL is unavailable
            try:
                from PIL import Image
                return Image.new('RGBA', (1, 1), (0, 0, 0, 0))
            except Exception:
                return None

    def _run_tray():
        try:
            import pystray
            from pystray import MenuItem as TrayItem, Menu as TrayMenu

            icon_image = _make_tray_icon()
            if not icon_image:
                return  # pystray or PIL not available — silently skip tray

            def _open_dashboard(icon, item):
                webbrowser.open('http://localhost:8000')

            def _quit(icon, item):
                icon.stop()
                _shutdown(0)

            tray = pystray.Icon(
                'dlms_meter_app',
                icon_image,
                'DLMS Meter App — Running',
                menu=TrayMenu(
                    TrayItem('Open Dashboard', _open_dashboard, default=True),
                    TrayMenu.SEPARATOR,
                    TrayItem('Stop & Quit', _quit),
                )
            )
            tray.run()   # blocks this thread until icon.stop() is called
        except Exception as e:
            print(f'[Tray] Could not start system tray: {e}', file=sys.stderr)

    tray_thread = threading.Thread(target=_run_tray, daemon=True, name='tray')
    tray_thread.start()

    # ── Monitor subprocesses ──────────────────────────────────────────────
    while not stop_event.is_set():
        uvicorn_rc = uvicorn_p.poll()
        celery_rc = celery_p.poll()
        celery_beat_rc = celery_beat_p.poll()

        if uvicorn_rc is not None:
            _shutdown(uvicorn_rc if uvicorn_rc != 0 else 1)

        if celery_rc is not None:
            _shutdown(celery_rc if celery_rc != 0 else 1)

        if celery_beat_rc is not None:
            _shutdown(celery_beat_rc if celery_beat_rc != 0 else 1)

        time.sleep(0.1)


# -------------------------------------------------------------------
# ENTRYPOINT
# -------------------------------------------------------------------

if __name__ == "__main__":
    from multiprocessing import freeze_support
    freeze_support()

    if len(sys.argv) < 2:
        print("Usage: python run.py serve")
        sys.exit(1)

    cmd_arg = sys.argv[1]

    # When frozen with console=False, sys.stdout and sys.stderr are None.
    # Redirect them to a log file so any library that tries to print/log doesn't crash.
    if getattr(sys, 'frozen', False) and sys.stdout is None:
        _log_path = os.path.join(APP_DATA_DIR, 'app.log')
        _log_file = open(_log_path, 'a', buffering=1, encoding='utf-8')
        sys.stdout = _log_file
        sys.stderr = _log_file

    if cmd_arg == "serve":
        print("Initializing database (safe to re-run)...")
        init_db()
        sys.exit(start_server())

    elif cmd_arg == "serve_uvicorn":
        import uvicorn
        import main
        # Run Uvicorn directly by passing the app object, not the string, to help PyInstaller find it
        sys.exit(uvicorn.run(main.app, host="0.0.0.0", port=8000))

    elif cmd_arg == "serve_celery":
        from service.tasks import celery_app
        _worker_log = os.path.join(APP_DATA_DIR, 'celery-worker.log')
        argv = [
            'worker',
            '--loglevel=INFO',
            '--pool=solo',
            '--concurrency=1',
            '--logfile', _worker_log,
        ]
        celery_app.worker_main(argv)
        sys.exit(0)

    elif cmd_arg == "serve_celery_beat":
        from service.tasks import celery_app
        from celery.apps.beat import Beat
        schedule_path = os.path.join(APP_DATA_DIR, "celerybeat-schedule")
        _beat_log = os.path.join(APP_DATA_DIR, 'celery-beat.log')
        beat = Beat(app=celery_app, loglevel='INFO', schedule=schedule_path, logfile=_beat_log)
        beat.run()
        sys.exit(0)

    else:
        print(f"Unknown command: {cmd_arg}")
        sys.exit(1)
