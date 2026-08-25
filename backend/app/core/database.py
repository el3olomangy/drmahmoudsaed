"""Async Firebase Realtime Database data layer.

The API intentionally exposes small collection operations used by the route layer while
keeping Firebase details centralized. Values are JSON-normalized before writes.
"""
from __future__ import annotations
import asyncio, os, uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any
import firebase_admin
from firebase_admin import credentials, db as firebase_db
from .config import settings


def _json(v: Any):
    if isinstance(v, datetime): return v.astimezone(timezone.utc).isoformat()
    if isinstance(v, Enum): return v.value
    if isinstance(v, dict): return {str(k): _json(x) for k,x in v.items()}
    if isinstance(v, (list, tuple)): return [_json(x) for x in v]
    return v

def _restore(v: Any):
    if isinstance(v, dict): return {k: _restore(x) for k,x in v.items()}
    if isinstance(v, list): return [_restore(x) for x in v]
    if isinstance(v, str) and ('T' in v or v.endswith('+00:00')):
        try: return datetime.fromisoformat(v.replace('Z','+00:00'))
        except Exception: pass
    return v

def _dt(v: Any):
    if isinstance(v, str):
        try: return datetime.fromisoformat(v.replace('Z','+00:00'))
        except Exception: return v
    return v

def new_id() -> str:
    # 24 hex chars preserves the public ID shape used by the existing frontend/API.
    return uuid.uuid4().hex[:24]

def is_valid_id(value: str | None) -> bool:
    return bool(value and isinstance(value, str) and len(value) <= 128 and all(c.isalnum() or c in '-_' for c in value))

class Cursor:
    def __init__(self, collection, filters=None): self.collection, self.filters, self.sort_key, self.sort_dir = collection, filters or {}, None, 1
    def sort(self, key, direction=1): self.sort_key, self.sort_dir = key, direction; return self
    async def to_list(self, length=100):
        rows = await self.collection._scan(self.filters)
        if self.sort_key:
            rows.sort(key=lambda x: str(x.get(self.sort_key, '')), reverse=self.sort_dir < 0)
        return rows[:length]

class Collection:
    def __init__(self, name): self.name=name
    @property
    def ref(self): return firebase_db.reference(self.name)
    async def _get_raw(self): return await asyncio.to_thread(self.ref.get) or {}
    async def _scan(self, filters):
        # RTDB server-side query for the common single equality predicate; fallback filtering
        # handles compound predicates while keeping route behavior stable.
        raw = None
        simple = [(k,v) for k,v in filters.items() if not isinstance(v, dict) and k != '_id']
        if len(simple) == 1:
            k,v=simple[0]
            try: raw = await asyncio.to_thread(self.ref.order_by_child(k).equal_to(_json(v)).get)
            except Exception: raw = None
        if raw is None: raw = await self._get_raw()
        rows=[]
        for key,val in (raw or {}).items():
            if not isinstance(val, dict): continue
            doc=_restore({'_id': key, **val})
            if _matches(doc, filters): rows.append(doc)
        return rows
    async def get_one(self, filters):
        if set(filters)=={'_id'}:
            key=str(filters['_id']); val=await asyncio.to_thread(self.ref.child(key).get)
            return _restore({'_id':key, **val}) if isinstance(val,dict) else None
        rows=await self._scan(filters); return rows[0] if rows else None
    def query(self, filters=None, projection=None): return Cursor(self, filters)
    async def count(self, filters=None): return len(await self._scan(filters or {}))
    async def add(self, doc):
        key=new_id(); await asyncio.to_thread(self.ref.child(key).set, _json(doc)); return type('Result',(),{'inserted_id':key})()
    async def add_many(self, docs):
        updates={new_id():_json(d) for d in docs}; await asyncio.to_thread(self.ref.update, updates); return type('Result',(),{'inserted_ids':list(updates)})()
    async def set_fields(self, filters, update, upsert=False):
        payload = update.get('$set', {} if any(str(k).startswith('$') for k in update) else update)
        inc=update.get('$inc', {}); addset=update.get('$addToSet', {}); pull=update.get('$pull', {})

        def _apply(merged):
            merged = dict(merged); merged.update(payload)
            for k,v in inc.items(): merged[k]=merged.get(k,0)+v
            for k,v in addset.items():
                cur=list(merged.get(k,[]) or []); vals=v.get('$each',[]) if isinstance(v,dict) and '$each' in v else [v]
                for item in vals:
                    if item not in cur: cur.append(item)
                merged[k]=cur
            for k,v in pull.items():
                cur=list(merged.get(k,[]) or []); banned=v.get('$in',[]) if isinstance(v,dict) and '$in' in v else [v]
                merged[k]=[x for x in cur if x not in banned]
            return merged

        # المسار الأكثر استخدامًا: تحديث بالـ _id — بنستخدم transaction حقيقية من Firebase
        # عشان القراءة والتعديل والكتابة تحصل كعملية واحدة ذرية، ومتفضلش عرضة لسباق (race condition)
        # بين تحديثين قريبين على نفس المستند (زي فقدان كورس اتضاف لتوّه لطالب).
        if set(filters) == {'_id'}:
            key = str(filters['_id'])

            def _txn(current):
                if current is None:
                    if not upsert: return current  # يوقف الـ transaction من غير تغيير — المستند مش موجود
                    base = {k: v for k, v in filters.items() if not isinstance(v, dict) and k != '_id'}
                    return _json(_apply(base))
                return _json(_apply(current))

            committed_holder = {}
            def _run():
                committed_holder['result'] = self.ref.child(key).transaction(_txn)
            await asyncio.to_thread(_run)
            existed = await asyncio.to_thread(self.ref.child(key).get)
            return type('Result',(),{'modified_count': 1 if existed else 0})()

        # فلاتر مركّبة (مش بالـ _id) — بترجع لنفس الأسلوب القديم لأنها أقل استخدامًا وأقل عرضة للتزامن
        rows=await self._scan(filters)
        if not rows and upsert:
            doc={k:v for k,v in filters.items() if not isinstance(v,dict) and k!='_id'}; doc.update(payload); return await self.add(doc)
        for row in rows[:1]:
            merged=_apply({k:v for k,v in row.items() if k!='_id'})
            await asyncio.to_thread(self.ref.child(row['_id']).set, _json(merged))
        return type('Result',(),{'modified_count':len(rows[:1])})()
    async def set_fields_many(self, filters, update):
        rows=await self._scan(filters)
        for row in rows: await self.set_fields({'_id': row['_id']}, update)
        return type('Result',(),{'modified_count':len(rows)})()
    async def compare_and_set(self, doc_id, expected: dict, updates: dict) -> bool:
        """تحديث ذرّي مشروط: يكتب updates فقط لو القيم الحالية للمفاتيح في
        expected مطابقة. يرجّع True لو نجح الحجز، False لو حد تاني سبقنا.
        بيستخدم Firebase transaction عشان الفحص-والكتابة يحصلوا كعملية واحدة —
        ده بيمنع سباق زي استهلاك نفس الكود مرتين في نفس اللحظة."""
        key = str(doc_id)
        outcome = {'ok': False}
        def _txn(current):
            if not isinstance(current, dict):
                return current  # مش موجود — أبطِل
            for k, v in expected.items():
                if current.get(k) != v:
                    return current  # الحالة اتغيّرت — حد تاني سبقنا، أبطِل من غير كتابة
            merged = dict(current); merged.update(_json(updates))
            outcome['ok'] = True
            return merged
        def _run():
            self.ref.child(key).transaction(_txn)
        await asyncio.to_thread(_run)
        return outcome['ok']
    async def remove_one(self, filters):
        row=await self.get_one(filters)
        if row: await asyncio.to_thread(self.ref.child(row['_id']).delete)
        return type('Result',(),{'deleted_count':1 if row else 0})()
    async def remove_many(self, filters):
        rows=await self._scan(filters); updates={r['_id']:None for r in rows}
        if updates: await asyncio.to_thread(self.ref.update, updates)
        return type('Result',(),{'deleted_count':len(rows)})()

def _matches(doc, filters):
    ors=filters.get('$or')
    if ors and not any(_matches(doc, branch) for branch in ors): return False
    for k, expected in filters.items():
        if k == '$or': continue
        actual=doc.get(k)
        if isinstance(expected, dict):
            # $in/$nin لازم يشتغلوا صح سواء الحقل الفعلي قيمة مفردة (زي role)
            # أو array (زي read_by) — النسخة القديمة كانت بتقارن الـ array نفسه
            # كعنصر واحد جوه قائمة $nin، فكانت دايمًا بترجع False وتكسر فلترة
            # "الإشعارات اللي لسه ما اتقرتش" (unread-count بيرجع كل الإشعارات غلط)
            if '$in' in expected:
                candidates = expected['$in']
                if isinstance(actual, list):
                    if not any(a in candidates for a in actual): return False
                elif actual not in candidates: return False
            if '$nin' in expected:
                candidates = expected['$nin']
                if isinstance(actual, list):
                    if any(a in candidates for a in actual): return False
                elif actual in candidates: return False
            if '$ne' in expected and actual == expected['$ne']: return False
            if '$gte' in expected and _dt(actual) < _dt(expected['$gte']): return False
            if '$lte' in expected and _dt(actual) > _dt(expected['$lte']): return False
        elif actual != expected: return False
    return True

class FirebaseDB:
    def __getattr__(self, name): return Collection(name)

db = FirebaseDB()

async def connect_db():
    if firebase_admin._apps: return
    options={'databaseURL': settings.FIREBASE_DATABASE_URL}
    service_file=settings.FIREBASE_SERVICE_ACCOUNT_FILE or os.getenv('FIREBASE_SERVICE_ACCOUNT_FILE')
    if service_file:
        cred=credentials.Certificate(service_file)
    elif settings.FIREBASE_CLIENT_EMAIL and settings.FIREBASE_PRIVATE_KEY:
        cred=credentials.Certificate({'type':'service_account','project_id':settings.FIREBASE_PROJECT_ID,'client_email':settings.FIREBASE_CLIENT_EMAIL,'private_key':settings.FIREBASE_PRIVATE_KEY.replace('\\n','\n'),'token_uri':'https://oauth2.googleapis.com/token'})
    else:
        cred=credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, options)
    print('Connected to Firebase Realtime Database')
async def close_db(): pass
def get_db(): return db