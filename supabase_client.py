# Novel Studio — Supabase 多租户客户端
# 通过 Service Role Key 提供后端服务，通过 JWT 验证前端请求
# 懒初始化确保 Supabase 未配置时应用可正常降级运行

import os
import functools
from flask import request, jsonify

_supabase_client = None


def get_supabase():
    """获取 Supabase 客户端（懒加载）。如果环境变量缺失则抛错。"""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        raise RuntimeError(
            'SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量未设置。'
            '请检查 .env 文件或 Supabase 项目配置。'
        )
    from supabase import create_client
    _supabase_client = create_client(url, key)
    return _supabase_client


def is_supabase_configured():
    """检查 Supabase 是否已配置（用于条件路由和渐进降级）。"""
    return bool(
        os.environ.get('SUPABASE_URL') and
        os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    )


def get_anon_key():
    """获取 Supabase Anon Key（用于前端注入）。"""
    return os.environ.get('SUPABASE_ANON_KEY', '')


def get_supabase_url():
    """获取 Supabase URL（用于前端注入）。"""
    return os.environ.get('SUPABASE_URL', '')


# ---- JWT 验证 ----


def get_user_from_request(req):
    """
    从请求 Authorization 头提取并验证 JWT，返回 {'id': uuid, 'email': str} 或 None。

    使用 Supabase 的 auth.get_user(jwt) 方法，Service Role Key
    可验证任何用户 JWT 的签名和过期时间。
    """
    auth_header = req.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    jwt_token = auth_header[7:]
    try:
        supabase = get_supabase()
        response = supabase.auth.get_user(jwt_token)
        if response and response.user:
            return {'id': response.user.id, 'email': response.user.email}
        return None
    except Exception:
        return None


# ---- 认证装饰器 ----


def require_auth(f):
    """
    Flask 路由装饰器：要求有效的 Supabase JWT。
    验证通过后，将 user 对象注入 request.supabase_user。
    验证失败返回 401。
    """
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        user = get_user_from_request(request)
        if not user:
            return jsonify({'error': '未登录或会话已过期，请重新登录'}), 401
        request.supabase_user = user
        return f(*args, **kwargs)
    return wrapper


def get_current_user():
    """在 require_auth 装饰的处理器中获取当前用户信息。"""
    return getattr(request, 'supabase_user', None)


# ---- 用户管理 ----


def get_or_create_user_profile(user_id: str, email: str) -> dict:
    """获取或创建 Supabase users 表中的用户资料。"""
    supabase = get_supabase()
    result = supabase.table('users').select('*').eq('id', user_id).execute()
    if result.data:
        return result.data[0]
    profile = {
        'id': user_id,
        'email': email,
        'user_tier': 'free',
    }
    supabase.table('users').insert(profile).execute()
    return profile


def get_user_tier(user_id: str) -> str:
    """获取用户的会员等级。"""
    supabase = get_supabase()
    result = supabase.table('users').select('user_tier').eq('id', user_id).execute()
    if result.data:
        return result.data[0]['user_tier']
    return 'free'
