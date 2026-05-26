# -*- coding: utf-8 -*-
"""
Novel Studio — Supabase 数据仓库层 (Repository)
================================================
封装所有数据库 CRUD 操作，适配 RLS 行级安全策略。

架构设计：
- 每个 HTTP 请求携带用户 JWT → 创建请求级 Supabase 客户端
- RLS 通过 user_id = auth.uid() 自动完成多租户隔离
- INSERT 操作必须手动注入 user_id（RLS WITH CHECK 要求）
- 降级模式：Supabase 不可用时回退到 SQLite

用法：
    from supabase_repo import use_supabase_repo, get_repo
    repo = get_repo()  # 在 Flask 请求上下文中使用
"""

import os
import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from flask import g, request, has_request_context
from dotenv import load_dotenv

load_dotenv()

DB_MODE = os.environ.get('DB_MODE', 'sqlite')


def is_supabase_mode():
    """当前是否使用 Supabase 模式"""
    return DB_MODE == 'supabase' and os.environ.get('SUPABASE_URL')


def _create_supabase_client(jwt_token: str):
    """用用户 JWT 创建请求级 Supabase 客户端（RLS 生效）"""
    from supabase import create_client
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_ANON_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        raise RuntimeError('Supabase 环境变量未配置')
    return create_client(url, key)


# ==========================================================
# 请求上下文管理
# ==========================================================

def init_supabase_for_request():
    """在 Flask before_request 中调用：从 JWT 初始化请求级客户端"""
    if not is_supabase_mode():
        return

    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        jwt_token = auth_header[7:]
        try:
            client = _create_supabase_client(jwt_token)
            # 用 JWT 设置客户端会话（RLS 生效）
            client.postgrest.auth(jwt_token)
            g.supabase = client
            g.supabase_user_id = _extract_user_id_from_jwt(jwt_token)
            g.supabase_mode = True
            return
        except Exception as e:
            print(f'[Supabase] 初始化失败: {e}')

    # 降级：无有效 JWT 时使用 service_role（绕过 RLS，仅管理端点）
    g.supabase_mode = False


def _extract_user_id_from_jwt(jwt_token: str) -> str:
    """从 JWT 中提取 user_id（sub claim）"""
    import base64
    try:
        parts = jwt_token.split('.')
        if len(parts) >= 2:
            payload = parts[1]
            # 修复 base64 padding
            payload += '=' * (4 - len(payload) % 4)
            decoded = json.loads(base64.urlsafe_b64decode(payload))
            return decoded.get('sub', '')
    except Exception:
        pass
    return ''


def get_repo():
    """获取当前请求的数据仓库实例"""
    if not has_request_context():
        return None
    return _SupabaseRepo() if getattr(g, 'supabase_mode', False) else None


def get_current_user_id() -> str:
    """获取当前请求的用户 ID"""
    if has_request_context():
        uid = getattr(g, 'supabase_user_id', None)
        if uid:
            return uid
    return ''


def require_user_id():
    """获取用户 ID，Supabase 不可用时抛错"""
    uid = get_current_user_id()
    if not uid:
        raise RuntimeError('未登录或会话已过期，请重新登录')
    return uid


# ==========================================================
# Supabase 数据仓库
# ==========================================================

class _SupabaseRepo:
    """Supabase 数据仓库：封装所有表的 CRUD 操作。

    INSERT/UPSERT 自动注入 user_id 以满足 RLS WITH CHECK。
    SELECT/UPDATE/DELETE 由 RLS 自动过滤（user_id = auth.uid()）。
    """

    def __init__(self):
        self.client = g.supabase
        self.user_id = get_current_user_id()

    def _ensure_user_id(self, data: dict) -> dict:
        """确保 INSERT 数据包含 user_id（RLS 要求）"""
        if 'user_id' not in data:
            data['user_id'] = self.user_id
        return data

    def _now(self) -> str:
        return datetime.now().isoformat()

    def _exec(self, chain):
        """统一的 Supabase 查询执行 + 错误处理"""
        try:
            result = chain.execute()
            return result.data, None
        except Exception as e:
            return None, str(e)

    def _row(self, chain):
        """执行查询并返回单行"""
        data, err = self._exec(chain)
        if err or not data:
            return None
        return data[0] if isinstance(data, list) else data

    def _rows(self, chain):
        """执行查询并返回多行"""
        data, err = self._exec(chain)
        if err:
            return []
        return data or []

    # ==========================================
    # BOOKS
    # ==========================================

    def list_books(self):
        return self._rows(
            self.client.table('books').select('*').order('created_at', desc=True)
        )

    def get_book(self, book_id: str):
        return self._row(
            self.client.table('books').select('*').eq('id', book_id)
        )

    def create_book(self, title='未命名项目', description='', genre=''):
        book_id = str(uuid.uuid4())
        now = self._now()
        data = {
            'id': book_id,
            'title': title,
            'description': description,
            'genre': genre,
            'tags': [],
            'created_at': now,
            'updated_at': now,
        }
        self._ensure_user_id(data)
        _, err = self._exec(self.client.table('books').insert(data))
        if err:
            return None
        return book_id

    def update_book(self, book_id: str, data: dict):
        data['updated_at'] = self._now()
        return self._exec(
            self.client.table('books').update(data).eq('id', book_id)
        )

    def delete_book(self, book_id: str):
        return self._exec(
            self.client.table('books').delete().eq('id', book_id)
        )

    def get_book_stats(self, book_id: str):
        """获取项目基础统计"""
        chapters, _ = self._exec(
            self.client.table('chapters').select('word_count').eq('book_id', book_id)
        )
        total_words = sum(c.get('word_count', 0) for c in (chapters or []))
        chapter_count = len(chapters or [])
        return {'total_words': total_words, 'chapter_count': chapter_count}

    # ==========================================
    # CHAPTERS
    # ==========================================

    def list_chapters(self, book_id: str):
        return self._rows(
            self.client.table('chapters').select('*')
            .eq('book_id', book_id).order('sort_order')
        )

    def get_chapter(self, chapter_id: str):
        return self._row(
            self.client.table('chapters').select('*').eq('id', chapter_id)
        )

    def create_chapter(self, book_id: str, title='新章节'):
        chapter_id = str(uuid.uuid4())
        now = self._now()
        max_sort = 0
        existing, _ = self._exec(
            self.client.table('chapters').select('sort_order')
            .eq('book_id', book_id).order('sort_order', desc=True).limit(1)
        )
        if existing:
            max_sort = existing[0].get('sort_order', 0) + 1

        data = {
            'id': chapter_id,
            'book_id': book_id,
            'chapter_number': max_sort + 1,
            'title': title,
            'content': '',
            'word_count': 0,
            'source': 'manual',
            'sort_order': max_sort + 1,
            'created_at': now,
            'updated_at': now,
        }
        self._ensure_user_id(data)
        _, err = self._exec(self.client.table('chapters').insert(data))
        if err:
            return None
        return chapter_id

    def update_chapter(self, chapter_id: str, data: dict):
        data['updated_at'] = self._now()
        if 'content' in data:
            content = data['content'] or ''
            data['word_count'] = len(content.replace(' ', '').replace('\n', ''))
        return self._exec(
            self.client.table('chapters').update(data).eq('id', chapter_id)
        )

    def delete_chapter(self, chapter_id: str):
        return self._exec(
            self.client.table('chapters').delete().eq('id', chapter_id)
        )

    def reorder_chapters(self, chapter_ids: list):
        for idx, ch_id in enumerate(chapter_ids):
            self._exec(
                self.client.table('chapters').update({'sort_order': idx})
                .eq('id', ch_id)
            )

    # ==========================================
    # CHARACTERS
    # ==========================================

    def list_characters(self, book_id: str):
        return self._rows(
            self.client.table('characters').select('*')
            .eq('book_id', book_id).order('created_at')
        )

    def get_character(self, char_id: str):
        return self._row(
            self.client.table('characters').select('*').eq('id', char_id)
        )

    def create_character(self, book_id: str, data: dict):
        char_id = str(uuid.uuid4())
        now = self._now()
        row = {
            'id': char_id,
            'book_id': book_id,
            'name': data.get('name', ''),
            'gender': data.get('gender', ''),
            'age': data.get('age', ''),
            'personality': data.get('personality', ''),
            'background': data.get('background', ''),
            'goal': data.get('goal', ''),
            'appearance': data.get('appearance', ''),
            'notes': data.get('notes', ''),
            'created_at': now,
            'updated_at': now,
        }
        self._ensure_user_id(row)
        _, err = self._exec(self.client.table('characters').insert(row))
        if err:
            return None
        return char_id

    def update_character(self, char_id: str, data: dict):
        data['updated_at'] = self._now()
        return self._exec(
            self.client.table('characters').update(data).eq('id', char_id)
        )

    def delete_character(self, char_id: str):
        return self._exec(
            self.client.table('characters').delete().eq('id', char_id)
        )

    # ==========================================
    # OUTLINE NODES
    # ==========================================

    def list_outline(self, book_id: str):
        return self._rows(
            self.client.table('outline_nodes').select('*')
            .eq('book_id', book_id).order('sort_order')
        )

    def create_outline_node(self, book_id: str, data: dict):
        node_id = str(uuid.uuid4())
        now = self._now()
        parent_id = data.get('parent_id')
        max_sort = 0
        if parent_id:
            existing, _ = self._exec(
                self.client.table('outline_nodes').select('sort_order')
                .eq('book_id', book_id).eq('parent_id', parent_id)
                .order('sort_order', desc=True).limit(1)
            )
            if existing:
                max_sort = existing[0].get('sort_order', 0) + 1

        row = {
            'id': node_id,
            'book_id': book_id,
            'parent_id': parent_id,
            'title': data.get('title', '新节点'),
            'content': data.get('content', ''),
            'level': data.get('level', 0),
            'sort_order': max_sort + 1,
            'created_at': now,
            'updated_at': now,
        }
        self._ensure_user_id(row)
        _, err = self._exec(self.client.table('outline_nodes').insert(row))
        if err:
            return None
        return node_id

    def update_outline_node(self, node_id: str, data: dict):
        data['updated_at'] = self._now()
        return self._exec(
            self.client.table('outline_nodes').update(data).eq('id', node_id)
        )

    def delete_outline_node(self, node_id: str):
        return self._exec(
            self.client.table('outline_nodes').delete().eq('id', node_id)
        )

    # ==========================================
    # PLOT THREADS
    # ==========================================

    def list_plot_threads(self, book_id: str):
        return self._rows(
            self.client.table('plot_threads').select('*')
            .eq('book_id', book_id).order('created_at')
        )

    def create_plot_thread(self, book_id: str, data: dict):
        tid = str(uuid.uuid4())
        now = self._now()
        row = {
            'id': tid, 'book_id': book_id,
            'title': data.get('title', ''),
            'description': data.get('description', ''),
            'thread_type': data.get('thread_type', 'subplot'),
            'status': data.get('status', 'active'),
            'start_chapter_id': data.get('start_chapter_id'),
            'end_chapter_id': data.get('end_chapter_id'),
            'created_at': now, 'updated_at': now,
        }
        self._ensure_user_id(row)
        _, err = self._exec(self.client.table('plot_threads').insert(row))
        if err:
            return None
        return tid

    def update_plot_thread(self, tid: str, data: dict):
        data['updated_at'] = self._now()
        return self._exec(
            self.client.table('plot_threads').update(data).eq('id', tid)
        )

    def delete_plot_thread(self, tid: str):
        return self._exec(
            self.client.table('plot_threads').delete().eq('id', tid)
        )

    # ==========================================
    # WORLDBUILDING
    # ==========================================

    def list_worldbuilding(self, book_id: str, category=None):
        q = self.client.table('worldbuilding').select('*').eq('book_id', book_id)
        if category:
            q = q.eq('category', category)
        return self._rows(q.order('sort_order'))

    def create_worldbuilding_entry(self, book_id: str, data: dict):
        eid = str(uuid.uuid4())
        now = self._now()
        row = {
            'id': eid, 'book_id': book_id,
            'category': data.get('category', ''),
            'name': data.get('name', ''),
            'description': data.get('description', ''),
            'details': data.get('details', {}),
            'sort_order': data.get('sort_order', 0),
            'created_at': now, 'updated_at': now,
        }
        self._ensure_user_id(row)
        _, err = self._exec(self.client.table('worldbuilding').insert(row))
        if err:
            return None
        return eid

    def update_worldbuilding_entry(self, eid: str, data: dict):
        data['updated_at'] = self._now()
        return self._exec(
            self.client.table('worldbuilding').update(data).eq('id', eid)
        )

    def delete_worldbuilding_entry(self, eid: str):
        return self._exec(
            self.client.table('worldbuilding').delete().eq('id', eid)
        )

    # ==========================================
    # CHAPTER SUMMARIES (RAG)
    # ==========================================

    def get_chapter_summary(self, chapter_id: str):
        return self._row(
            self.client.table('chapter_summaries').select('*')
            .eq('chapter_id', chapter_id)
        )

    def upsert_chapter_summary(self, book_id: str, chapter_id: str, data: dict):
        row = {
            'chapter_id': chapter_id,
            'book_id': book_id,
            'summary': data.get('summary', ''),
            'key_events': data.get('key_events', []),
            'character_states': data.get('character_states', {}),
            'plot_threads': data.get('plot_threads', []),
            'generated_at': self._now(),
            'word_count': data.get('word_count', 0),
        }
        self._ensure_user_id(row)
        return self._exec(
            self.client.table('chapter_summaries').upsert(row)
        )

    def list_chapter_summaries(self, book_id: str, limit=5):
        return self._rows(
            self.client.table('chapter_summaries').select('*, chapters(title, sort_order)')
            .eq('book_id', book_id)
            .order('chapters(sort_order)', desc=True).limit(limit)
        )

    # ==========================================
    # KEY EVENTS
    # ==========================================

    def list_key_events(self, book_id: str, limit=10):
        return self._rows(
            self.client.table('key_events').select('*, chapters(title)')
            .eq('book_id', book_id).order('sort_order', desc=True).limit(limit)
        )

    def create_key_event(self, book_id: str, data: dict):
        eid = str(uuid.uuid4())
        row = {
            'id': eid, 'book_id': book_id,
            'chapter_id': data.get('chapter_id', ''),
            'title': data.get('title', ''),
            'description': data.get('description', ''),
            'event_type': data.get('event_type', 'event'),
            'involved_characters': data.get('involved_characters', []),
            'sort_order': data.get('sort_order', 0),
            'created_at': self._now(),
        }
        self._ensure_user_id(row)
        _, err = self._exec(self.client.table('key_events').insert(row))
        if err:
            return None
        return eid

    # ==========================================
    # CHARACTER STATES
    # ==========================================

    def list_character_states(self, book_id: str):
        return self._rows(
            self.client.table('character_states').select('*, characters(name)')
            .eq('book_id', book_id).order('snapshot_at', desc=True)
        )

    def upsert_character_state(self, book_id: str, data: dict):
        sid = str(uuid.uuid4())
        row = {
            'id': sid, 'book_id': book_id,
            'character_id': data.get('character_id', ''),
            'chapter_id': data.get('chapter_id', ''),
            'location': data.get('location', ''),
            'status': data.get('status', 'alive'),
            'emotional_state': data.get('emotional_state', ''),
            'knowledge_gained': data.get('knowledge_gained', ''),
            'relationships': data.get('relationships', {}),
            'snapshot_at': self._now(),
        }
        self._ensure_user_id(row)
        return self._exec(
            self.client.table('character_states').upsert(row)
        )

    # ==========================================
    # CHARACTER KNOWLEDGE
    # ==========================================

    def get_character_knowledge(self, character_id: str):
        return self._rows(
            self.client.table('character_knowledge').select('*, chapters(title, sort_order)')
            .eq('character_id', character_id)
            .order('chapters(sort_order)')
        )

    def upsert_character_knowledge(self, book_id: str, data: dict):
        kid = str(uuid.uuid4())
        row = {
            'id': kid, 'book_id': book_id,
            'character_id': data.get('character_id', ''),
            'chapter_id': data.get('chapter_id', ''),
            'known_names': data.get('known_names', []),
            'known_items': data.get('known_items', []),
            'known_events': data.get('known_events', []),
            'snapshot_at': self._now(),
        }
        self._ensure_user_id(row)
        return self._exec(
            self.client.table('character_knowledge').upsert(row)
        )

    # ==========================================
    # WRITING STATS
    # ==========================================

    def get_writing_stats(self, book_id: str, date: str):
        return self._row(
            self.client.table('writing_stats').select('*')
            .eq('book_id', book_id).eq('date', date)
        )

    def upsert_writing_stats(self, book_id: str, data: dict):
        sid = str(uuid.uuid4())
        row = {
            'id': sid, 'book_id': book_id,
            'date': data.get('date', datetime.now().strftime('%Y-%m-%d')),
            'chars_added': data.get('chars_added', 0),
            'chars_deleted': data.get('chars_deleted', 0),
            'time_spent': data.get('time_spent', 0),
            'sessions': data.get('sessions', 0),
        }
        self._ensure_user_id(row)
        return self._exec(
            self.client.table('writing_stats').upsert(row)
        )

    # ==========================================
    # WRITING GOALS
    # ==========================================

    def list_goals(self, book_id: str):
        return self._rows(
            self.client.table('writing_goals').select('*')
            .eq('book_id', book_id).eq('is_active', 1)
        )

    def create_goal(self, book_id: str, data: dict):
        gid = str(uuid.uuid4())
        row = {
            'id': gid, 'book_id': book_id,
            'goal_type': data.get('goal_type', 'daily'),
            'target_value': data.get('target_value', 500),
            'current_value': 0,
            'deadline': data.get('deadline', ''),
            'is_active': 1,
        }
        self._ensure_user_id(row)
        _, err = self._exec(self.client.table('writing_goals').insert(row))
        if err:
            return None
        return gid

    def update_goal(self, gid: str, data: dict):
        return self._exec(
            self.client.table('writing_goals').update(data).eq('id', gid)
        )

    # ==========================================
    # CHAPTER SNAPSHOTS
    # ==========================================

    def list_chapter_snapshots(self, chapter_id: str, limit=30):
        return self._rows(
            self.client.table('chapter_snapshots').select('*')
            .eq('chapter_id', chapter_id).order('version', desc=True).limit(limit)
        )

    def get_snapshot(self, snap_id: str):
        return self._row(
            self.client.table('chapter_snapshots').select('*').eq('id', snap_id)
        )

    def create_snapshot(self, book_id: str, chapter_id: str, title: str,
                        content: str, word_count: int, version: int):
        sid = str(uuid.uuid4())
        row = {
            'id': sid, 'book_id': book_id, 'chapter_id': chapter_id,
            'version': version, 'title': title, 'content': content,
            'word_count': word_count, 'snapshot_at': self._now(),
        }
        self._ensure_user_id(row)
        _, err = self._exec(self.client.table('chapter_snapshots').insert(row))
        if err:
            return None
        return sid

    def get_max_snapshot_version(self, chapter_id: str) -> int:
        result, _ = self._exec(
            self.client.table('chapter_snapshots').select('version')
            .eq('chapter_id', chapter_id).order('version', desc=True).limit(1)
        )
        if result:
            return result[0].get('version', 0)
        return 0

    # ==========================================
    # AI CONVERSATIONS & MESSAGES
    # ==========================================

    def list_conversations(self, book_id: str):
        return self._rows(
            self.client.table('ai_conversations').select('*')
            .eq('book_id', book_id).order('last_message_at', desc=True, nulls_last=True)
        )

    def create_conversation(self, book_id: str, category='general', topic='',
                            source_tab='chat'):
        cid = str(uuid.uuid4())
        now = self._now()
        row = {
            'id': cid, 'book_id': book_id,
            'category': category, 'topic': topic,
            'source_tab': source_tab,
            'message_count': 0,
            'last_message_at': now,
            'created_at': now,
        }
        self._ensure_user_id(row)
        _, err = self._exec(self.client.table('ai_conversations').insert(row))
        if err:
            return None
        return cid

    def add_message(self, book_id: str, conversation_id: str,
                    role: str, content: str):
        row = {
            'conversation_id': conversation_id,
            'book_id': book_id,
            'role': role,
            'content': content,
            'timestamp': self._now(),
        }
        self._ensure_user_id(row)
        _, err = self._exec(self.client.table('ai_messages').insert(row))
        if err:
            return None
        # 更新消息计数和最后活跃时间
        msgs, _ = self._exec(
            self.client.table('ai_messages').select('id', count='exact')
            .eq('conversation_id', conversation_id)
        )
        msg_count = len(msgs) if msgs else 0
        self._exec(
            self.client.table('ai_conversations').update({
                'message_count': msg_count,
                'last_message_at': self._now(),
            }).eq('id', conversation_id)
        )
        return True

    def list_messages(self, conversation_id: str):
        return self._rows(
            self.client.table('ai_messages').select('*')
            .eq('conversation_id', conversation_id).order('timestamp')
        )

    # ==========================================
    # USERS (profile / tier)
    # ==========================================

    def get_user_profile(self):
        return self._row(
            self.client.table('users').select('*').eq('id', self.user_id)
        )

    def get_user_tier(self) -> str:
        profile = self.get_user_profile()
        if profile:
            return profile.get('user_tier', 'free')
        return 'free'

    def update_user_tier(self, tier: str):
        return self._exec(
            self.client.table('users').update({'user_tier': tier}).eq('id', self.user_id)
        )
