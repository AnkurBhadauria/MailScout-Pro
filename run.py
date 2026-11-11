import uvicorn
import sys
import webbrowser
import threading
import time

def open_browser():
    time.sleep(1.2)
    webbrowser.open("http://127.0.0.1:8000")

if __name__ == "__main__":
    print("=" * 60)
    print("  MailScout Pro - Executive & HR Lead Finder & Verifier")
    print("=" * 60)
    print("Starting server on http://127.0.0.1:8000 ...")
    
    # Launch browser automatically
    threading.Thread(target=open_browser, daemon=True).start()
    
    try:
        uvicorn.run("backend.app:app", host="127.0.0.1", port=8000, reload=True)
    except KeyboardInterrupt:
        print("\nShutting down server.")
        sys.exit(0)

