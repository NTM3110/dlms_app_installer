from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from app.db import engine, Base
from api import settings_api, data_api
import os
import sys

app = FastAPI(title="DLMS Config API")

# Create database tables
Base.metadata.create_all(bind=engine)

app.include_router(settings_api.router, prefix="/api")
app.include_router(data_api.router, prefix="/api")

# Serve static files (Angular frontend)
def get_static_dir():
    # When running as a PyInstaller bundle, sys._MEIPASS is the path to the bundle's root
    base_path = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    
    # Check for static/browser (common in newer Angular versions)
    browser_dir = os.path.join(base_path, "static", "browser")
    if os.path.exists(browser_dir):
        return browser_dir
    
    # Fallback to just static
    standard_dir = os.path.join(base_path, "static")
    if os.path.exists(standard_dir):
        return standard_dir
    return None

static_dir = get_static_dir()

@app.exception_handler(404)
async def not_found_exception_handler(request: Request, exc: HTTPException):
    # If it's an API call, return normal 404
    if request.url.path.startswith("/api"):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    
    # Otherwise serve index.html for SPA routing
    if static_dir:
        index_file = os.path.join(static_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
            
    return JSONResponse(status_code=404, content={"detail": "Not Found"})

if static_dir:
    print(f"Serving static files from: {static_dir}")
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
else:
    print("Static directory not found. Frontend will not be served.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
