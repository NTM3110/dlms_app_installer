import sys
from PyInstaller.utils.hooks import collect_data_files, collect_all

# Collect static files from FastAPI static directory if it exists
datas = [('static', 'static'), ('driver/meter_cache.xml', 'driver')]

# Collect gurux_dlms text data files which might be needed
datas += collect_data_files('gurux_dlms')

celery_datas, celery_binaries, celery_hiddenimports = collect_all('celery')
kombu_datas, kombu_binaries, kombu_hiddenimports = collect_all('kombu')

datas += celery_datas + kombu_datas

a = Analysis(
    ['run.py'],
    pathex=[],
    binaries=[] + celery_binaries + kombu_binaries,
    datas=datas,
    hiddenimports=[
        'uvicorn.logging', 
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'service.tasks',
        'main',
        'psycopg2', # Needed for postgresql driver
        'winreg',
    ] + celery_hiddenimports + kombu_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='run',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='run',
)
