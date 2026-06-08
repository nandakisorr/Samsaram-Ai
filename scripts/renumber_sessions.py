"""
One-time migration: Renumber all sessions sequentially from 1 upward,
preserving chronological order (by started_at). Also resets the session_id
counter so future inserts continue the sequence safely.
"""
import os
import sys
from datetime import datetime
from pymongo import MongoClient

# ── config ──────────────────────────────────────────────────────────────
MONGO_URI   = os.getenv("MONGO_URI",   "mongodb://localhost:27017")
DB_NAME     = os.getenv("MONGO_DB",     "chatbot")
SESSION_COL = "sessions"   # collection name storing session documents
# ────────────────────────────────────────────────────────────────────────

def main() -> None:
    client = MongoClient(MONGO_URI)
    db     = client[DB_NAME]
    col    = db[SESSION_COL]
    counter_col = db["counters"]

    # 1. Fetch ALL sessions ordered by started_at (oldest first)
    all_sessions = list(col.find({}, {"_id": 0}).sort("started_at", 1))
    if not all_sessions:
        print("No sessions found – nothing to do.")
        return

    print(f"Found {len(all_sessions)} sessions. Starting renumber…")

    # 2. Remove old counter (if any) to avoid conflict
    counter_col.delete_one({"_id": "session_id"})

    # 3. Update each session with its new sequential ID
    for idx, session in enumerate(all_sessions, start=1):
        old_id = session["session_id"]
        result = col.update_one(
            {"session_id": old_id},
            {"$set": {"session_id": idx}}
        )
        if result.modified_count == 1:
            print(f"  Renamed session {old_id} → {idx}")
        else:
            print(f"  ⚠️  Failed to update session {old_id}")

    # 4. Create fresh counter at the new maximum ID
    counter_col.insert_one({"_id": "session_id", "seq": len(all_sessions)})
    print(f"\nCounter reset to seq={len(all_sessions)}")
    print("All done. Restart the backend to pick up the new counter.")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
