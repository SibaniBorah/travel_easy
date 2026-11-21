import os
import sys
import shutil

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# On Vercel serverless / AWS Lambda, /tmp is the only writable directory
TMP_DB = "/tmp/tour_db.sqlite"
SRC_DB = os.path.join(BASE_DIR, "tour_db.sqlite")
if not os.path.exists(TMP_DB) and os.path.exists(SRC_DB):
    try:
        shutil.copyfile(SRC_DB, TMP_DB)
    except Exception:
        pass

os.environ["DB_PATH"] = TMP_DB

from server import ChaloNorthEastHandler

class handler(ChaloNorthEastHandler):
    pass
