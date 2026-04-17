import json
import os
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from pymongo import MongoClient
from pymongo.errors import PyMongoError


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
ENV_PATH = BASE_DIR / ".env"


def _load_env_file() -> None:
    if not ENV_PATH.exists():
        return

    for raw_line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def _load_json(filename: str) -> list[dict]:
    file_path = DATA_DIR / filename
    if not file_path.exists():
        return []
    with file_path.open("r", encoding="utf-8") as file:
        return json.load(file)


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


class DatabaseManager:
    def __init__(self) -> None:
        _load_env_file()
        self.uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        self.db_name = os.getenv("MONGODB_DB", "cascade_gridlock")
        self.client: MongoClient | None = None
        self.database = None
        self.connected = False
        self.memory_store: dict[str, list[dict]] = {
            "users": [],
            "hubs": [],
            "trucks": [],
            "merchants": [],
            "system_state": [],
        }

    def connect(self) -> None:
        _load_env_file()
        self.uri = os.getenv("MONGODB_URI", self.uri)
        self.db_name = os.getenv("MONGODB_DB", self.db_name)
        timeout_ms = int(os.getenv("MONGODB_TIMEOUT_MS", "1000"))
        try:
            self.client = MongoClient(
                self.uri,
                serverSelectionTimeoutMS=timeout_ms,
                connectTimeoutMS=timeout_ms,
                socketTimeoutMS=timeout_ms,
            )
            self.client.admin.command("ping")
            self.database = self.client[self.db_name]
            self.connected = True
        except PyMongoError:
            self.client = None
            self.database = None
            self.connected = False

    def _matches(self, document: dict, filters: dict[str, Any] | None) -> bool:
        filters = filters or {}
        return all(document.get(key) == value for key, value in filters.items())

    def _sanitize(self, document: dict | None) -> dict | None:
        if not document:
            return None
        payload = dict(document)
        payload.pop("_id", None)
        return payload

    def list_documents(self, collection: str, filters: dict[str, Any] | None = None) -> list[dict]:
        if self.connected and self.database is not None:
            return [self._sanitize(document) for document in self.database[collection].find(filters or {}, {"_id": 0})]
        return [deepcopy(doc) for doc in self.memory_store[collection] if self._matches(doc, filters)]

    def find_one(self, collection: str, filters: dict[str, Any]) -> dict | None:
        if self.connected and self.database is not None:
            document = self.database[collection].find_one(filters, {"_id": 0})
            return self._sanitize(document) if document else None

        for document in self.memory_store[collection]:
            if self._matches(document, filters):
                return deepcopy(document)
        return None

    def insert_one(self, collection: str, document: dict) -> dict:
        payload = deepcopy(document)
        payload.setdefault("id", str(uuid4()))
        if self.connected and self.database is not None:
            self.database[collection].insert_one(payload)
        else:
            self.memory_store[collection].append(payload)
        return deepcopy(payload)

    def replace_one(self, collection: str, filters: dict[str, Any], document: dict) -> dict:
        payload = deepcopy(document)
        payload.setdefault("id", filters.get("id", str(uuid4())))
        if self.connected and self.database is not None:
            self.database[collection].replace_one(filters, payload, upsert=True)
        else:
            updated = False
            for index, current in enumerate(self.memory_store[collection]):
                if self._matches(current, filters):
                    self.memory_store[collection][index] = payload
                    updated = True
                    break
            if not updated:
                self.memory_store[collection].append(payload)
        return deepcopy(payload)

    def replace_many(self, collection: str, documents: list[dict], key_field: str = "id") -> None:
        if self.connected and self.database is not None:
            for document in documents:
                self.database[collection].replace_one({key_field: document[key_field]}, document, upsert=True)
        else:
            self.memory_store[collection] = [deepcopy(document) for document in documents]

    def update_many(self, collection: str, documents: list[dict], key_field: str = "id") -> None:
        self.replace_many(collection, documents, key_field=key_field)

    def count_documents(self, collection: str) -> int:
        if self.connected and self.database is not None:
            return self.database[collection].count_documents({})
        return len(self.memory_store[collection])

    def seed_initial_data(self) -> None:
        if self.connected and self.database is not None:
            for collection, filename in (
                ("hubs", "hubs.json"),
                ("trucks", "trucks.json"),
                ("merchants", "merchants.json"),
            ):
                if self.count_documents(collection) == 0:
                    documents = _load_json(filename)
                    if documents:
                        self.database[collection].insert_many(documents)

        state = self.find_one("system_state", {"id": "system-state"})
        if not state:
            self.insert_one(
                "system_state",
                {
                    "id": "system-state",
                    "rerouted_shipments": 0,
                    "total_shipments_processed": 0,
                    "last_detection_time_ms": 0.0,
                    "last_prediction_at": _now_iso(),
                    "simulation_runs": 0,
                    "last_simulation_at": None,
                    "incident_log": [],
                },
            )


db = DatabaseManager()


def get_db() -> DatabaseManager:
    return db
