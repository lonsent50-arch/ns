#!/usr/bin/env python3
"""生成 Novel Studio 管理员密码哈希（PBKDF2）"""
import hashlib
import os
import sys

def gen_pbkdf2(password):
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
    return f'pbkdf2:{salt.hex()}:{key.hex()}'

def gen_sha256(password):
    return hashlib.sha256(password.encode()).hexdigest()

if __name__ == '__main__':
    pw = input('输入新密码: ').strip()
    if not pw:
        print('密码不能为空')
        sys.exit(1)
    print()
    print('PBKDF2 (推荐):')
    print(gen_pbkdf2(pw))
    print()
    print('SHA-256 (兼容旧版):')
    print(gen_sha256(pw))
    print()
    print('将上面任意一行设置为 ADMIN_PASSWORD_HASH 环境变量')
