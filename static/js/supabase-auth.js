// Novel Studio — Supabase 认证模块
// 提供登录/注册/登出 UI + JWT 自动注入 + 渐进降级

var SupabaseAuth = (function() {
    var _client = null;
    var _session = null;
    var _configured = false;

    // ---- 初始化 ----
    function init() {
        var supabaseUrl = window.__SUPABASE_URL__ || '';
        var supabaseAnonKey = window.__SUPABASE_ANON_KEY__ || '';

        if (!supabaseUrl || !supabaseAnonKey) {
            console.log('[SupabaseAuth] 未配置 Supabase，使用本地模式');
            _configured = false;
            return;
        }

        if (typeof supabase !== 'undefined' && supabase.createClient) {
            _client = supabase.createClient(supabaseUrl, supabaseAnonKey);
            _configured = true;
            restoreSession();
            console.log('[SupabaseAuth] 已初始化');
        } else {
            console.warn('[SupabaseAuth] Supabase JS SDK 未加载');
            _configured = false;
        }
    }

    function isConfigured() { return _configured; }
    function isLoggedIn() { return !!_session && !!_session.access_token; }
    function getSession() { return _session; }
    function getAccessToken() {
        return _session ? _session.access_token : null;
    }

    // ---- 会话恢复 ----
    async function restoreSession() {
        if (!_client) return;
        try {
            var result = await _client.auth.getSession();
            if (result.data && result.data.session) {
                _session = result.data.session;
                updateUI();
            }
        } catch(e) {
            console.warn('[SupabaseAuth] 会话恢复失败:', e.message);
        }
    }

    // ---- 监听认证状态变化（登录/登出/Token刷新） ----
    function _listenAuthChanges() {
        if (!_client) return;
        _client.auth.onAuthStateChange(function(event, session) {
            _session = session;
            updateUI();
        });
    }

    // ---- 注册 ----
    async function signUp(email, password) {
        if (!_client) throw new Error('Supabase 未配置');
        var result = await _client.auth.signUp({ email: email, password: password });
        if (result.error) throw new Error(result.error.message);
        _session = result.data.session;
        updateUI();
        return result.data;
    }

    // ---- 登录 ----
    async function signIn(email, password) {
        if (!_client) throw new Error('Supabase 未配置');
        var result = await _client.auth.signInWithPassword({ email: email, password: password });
        if (result.error) throw new Error(result.error.message);
        _session = result.data.session;
        updateUI();
        return result.data;
    }

    // ---- 手机号注册/登录 ----
    async function signInPhone(phone) {
        if (!_client) throw new Error('Supabase 未配置');
        var result = await _client.auth.signInWithOtp({ phone: phone });
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }

    async function verifyPhoneOtp(phone, token) {
        if (!_client) throw new Error('Supabase 未配置');
        var result = await _client.auth.verifyOtp({ phone: phone, token: token, type: 'sms' });
        if (result.error) throw new Error(result.error.message);
        _session = result.data.session;
        updateUI();
        return result.data;
    }

    // ---- 登出 ----
    async function signOut() {
        if (!_client) return;
        await _client.auth.signOut();
        _session = null;
        updateUI();
    }

    // ---- UI 更新 ----
    function updateUI() {
        var authArea = document.getElementById('auth-area');
        if (!authArea) return;

        if (isLoggedIn() && _session) {
            var email = _session.user ? _session.user.email : '';
            var shortEmail = email.length > 20 ? email.substring(0, 17) + '...' : email;
            authArea.innerHTML =
                '<span style="color:#10b981;font-size:12px;margin-right:8px;">已登录</span>' +
                '<span style="color:#94a3b8;font-size:12px;margin-right:10px;">' + _sanitize(shortEmail) + '</span>' +
                '<button onclick="SupabaseAuth.signOut()" class="btn-auth-logout">登出</button>';
        } else {
            authArea.innerHTML =
                '<button onclick="SupabaseAuth.showModal()" class="btn-auth-login">登录 / 注册</button>';
        }

        // 触发自定义事件，通知 app.js 认证状态变化
        window.dispatchEvent(new CustomEvent('supabase-auth-changed', {
            detail: { loggedIn: isLoggedIn(), session: _session }
        }));
    }

    function _sanitize(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ---- 登录/注册 Modal ----
    function showModal() {
        var existing = document.getElementById('auth-modal');
        if (existing) existing.remove();

        var modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML =
            '<div class="modal-content auth-modal-content">' +
            // Brand header
            '<div class="auth-brand">' +
            '<div class="auth-brand-icon">NS</div>' +
            '<div class="auth-brand-text">Novel Studio</div>' +
            '<div class="auth-brand-sub">工业级 AI 网文工作台</div>' +
            '</div>' +
            // Close button
            '<button class="modal-close auth-close-btn" onclick="SupabaseAuth.hideModal()">✕</button>' +
            // Tabs
            '<div class="auth-tabs">' +
            '<button class="auth-tab active" onclick="SupabaseAuth._switchAuthTab(\'email\')">📧 邮箱登录</button>' +
            '<button class="auth-tab" onclick="SupabaseAuth._switchAuthTab(\'phone\')">📱 手机登录</button>' +
            '</div>' +
            // Email form
            '<div class="auth-form" id="auth-form-email">' +
            '<label>邮箱地址</label>' +
            '<div class="auth-input-wrap">' +
            '<span class="auth-input-icon">✉</span>' +
            '<input type="email" id="auth-email" class="auth-input-iconed" placeholder="your@email.com" autocomplete="email">' +
            '</div>' +
            '<label>密码</label>' +
            '<div class="auth-input-wrap">' +
            '<span class="auth-input-icon">🔒</span>' +
            '<input type="password" id="auth-password" class="auth-input-iconed" placeholder="至少 6 位密码" autocomplete="current-password">' +
            '</div>' +
            '<div id="auth-error" class="auth-error-msg"></div>' +
            '<div class="auth-btn-row">' +
            '<button id="auth-btn-login" class="btn-auth-submit">登 录</button>' +
            '</div>' +
            '<div class="auth-divider"><span>还没有账号？</span></div>' +
            '<button id="auth-btn-signup" class="btn-auth-submit secondary">注册新账号</button>' +
            '</div>' +
            // Phone form
            '<div class="auth-form" id="auth-form-phone" style="display:none;">' +
            '<label>手机号码</label>' +
            '<div class="auth-input-wrap">' +
            '<span class="auth-input-icon">📱</span>' +
            '<input type="tel" id="auth-phone" class="auth-input-iconed" placeholder="+86 13800138000" autocomplete="tel">' +
            '</div>' +
            '<div id="auth-otp-section" style="display:none;">' +
            '<label style="margin-top:14px;">短信验证码</label>' +
            '<div class="auth-input-wrap">' +
            '<span class="auth-input-icon">🔑</span>' +
            '<input type="text" id="auth-otp" class="auth-input-iconed" placeholder="6 位验证码" maxlength="6">' +
            '</div>' +
            '</div>' +
            '<div id="auth-phone-error" class="auth-error-msg"></div>' +
            '<div class="auth-btn-row">' +
            '<button id="auth-btn-send-otp" class="btn-auth-submit">发送验证码</button>' +
            '</div>' +
            '<button id="auth-btn-verify-otp" class="btn-auth-submit secondary" style="display:none;margin-top:8px;">验证并登录</button>' +
            '</div>' +
            // Footer
            '<div class="auth-footer">' +
            '<span>🔐</span> 首次登录自动创建账号 · 数据完全隔离 · 银行级加密' +
            '</div>' +
            '</div>';

        document.body.appendChild(modal);

        var emailEl = document.getElementById('auth-email');
        var passEl = document.getElementById('auth-password');
        var errEl = document.getElementById('auth-error');

        function showErr(msg) {
            errEl.textContent = msg;
            errEl.style.display = 'block';
        }
        function clearErr() {
            errEl.style.display = 'none';
        }

        document.getElementById('auth-btn-login').onclick = async function() {
            clearErr();
            var email = emailEl.value.trim();
            var pass = passEl.value;
            if (!email || !pass) { showErr('请输入邮箱和密码'); return; }
            if (pass.length < 6) { showErr('密码至少6位'); return; }
            try {
                await signIn(email, pass);
                hideModal();
            } catch(e) {
                showErr('登录失败：' + e.message);
            }
        };

        document.getElementById('auth-btn-signup').onclick = async function() {
            clearErr();
            var email = emailEl.value.trim();
            var pass = passEl.value;
            if (!email || !pass) { showErr('请输入邮箱和密码'); return; }
            if (pass.length < 6) { showErr('密码至少6位'); return; }
            try {
                await signUp(email, pass);
                hideModal();
                if (typeof showToast === 'function') {
                    showToast('注册成功！请检查邮箱确认链接（如已开启邮箱确认）', 'success');
                }
            } catch(e) {
                showErr('注册失败：' + e.message);
            }
        };

        // Phone OTP flow
        var phoneEl = document.getElementById('auth-phone');
        var otpSection = document.getElementById('auth-otp-section');
        var otpEl = document.getElementById('auth-otp');
        var sendBtn = document.getElementById('auth-btn-send-otp');
        var verifyBtn = document.getElementById('auth-btn-verify-otp');
        var phoneErr = document.getElementById('auth-phone-error');

        function showPhoneErr(msg, isSuccess) {
            phoneErr.textContent = msg;
            phoneErr.style.color = isSuccess ? '#10b981' : '#ef4444';
            phoneErr.style.display = 'block';
        }
        function clearPhoneErr() {
            phoneErr.style.display = 'none';
            phoneErr.style.color = '#ef4444';
        }

        sendBtn.onclick = async function() {
            clearPhoneErr();
            var phone = phoneEl.value.trim();
            if (!phone) { showPhoneErr('请输入手机号（含国家代码，如+86）'); return; }
            try {
                await signInPhone(phone);
                otpSection.style.display = 'block';
                sendBtn.style.display = 'none';
                verifyBtn.style.display = 'block';
                showPhoneErr('验证码已发送，请查收短信', true);
            } catch(e) {
                showPhoneErr('发送失败：' + e.message);
            }
        };

        verifyBtn.onclick = async function() {
            clearPhoneErr();
            var phone = phoneEl.value.trim();
            var otp = otpEl.value.trim();
            if (!otp || otp.length < 4) { showPhoneErr('请输入验证码'); return; }
            try {
                await verifyPhoneOtp(phone, otp);
                hideModal();
            } catch(e) {
                showPhoneErr('验证失败：' + e.message);
            }
        };

        // Enter 键触发登录
        passEl.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') document.getElementById('auth-btn-login').click();
        });
    }

    function hideModal() {
        var modal = document.getElementById('auth-modal');
        if (modal) modal.remove();
    }

    function _switchAuthTab(tab) {
        var emailForm = document.getElementById('auth-form-email');
        var phoneForm = document.getElementById('auth-form-phone');
        var tabs = document.querySelectorAll('.auth-tab');
        tabs.forEach(function(t) { t.classList.remove('active'); });
        if (tab === 'email') {
            emailForm.style.display = 'block';
            phoneForm.style.display = 'none';
            tabs[0].classList.add('active');
        } else {
            emailForm.style.display = 'none';
            phoneForm.style.display = 'block';
            tabs[1].classList.add('active');
        }
    }

    // ---- 自动 Bearer Token 注入 ----
    // 拦截所有 /api/auth/* 请求，自动附加 JWT
    function _patchFetch() {
        var originalFetch = window.fetch;
        window.fetch = function(url, options) {
            if (typeof url === 'string' && url.indexOf('/api/auth/') >= 0) {
                options = options || {};
                options.headers = options.headers || {};
                // 如果是 Headers 对象，需要特殊处理
                if (options.headers instanceof Headers) {
                    if (!options.headers.has('Authorization') && isLoggedIn()) {
                        options.headers.set('Authorization', 'Bearer ' + getAccessToken());
                    }
                } else if (typeof options.headers === 'object') {
                    if (!options.headers['Authorization'] && isLoggedIn()) {
                        options.headers['Authorization'] = 'Bearer ' + getAccessToken();
                    }
                }
            }
            return originalFetch(url, options);
        };
    }

    // ---- 获取用户云书籍列表 ----
    async function listBooks() {
        var token = getAccessToken();
        if (!token) throw new Error('未登录');
        var resp = await fetch('/api/auth/books', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!resp.ok) {
            var err = await resp.json().catch(function() { return {}; });
            throw new Error(err.error || '获取书籍列表失败');
        }
        return resp.json();
    }

    // ---- 创建云书籍 ----
    async function createBook(title, description, genre) {
        var token = getAccessToken();
        if (!token) throw new Error('未登录');
        var resp = await fetch('/api/auth/books', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title, description: description, genre: genre })
        });
        if (!resp.ok) {
            var err = await resp.json().catch(function() { return {}; });
            throw new Error(err.error || '创建书籍失败');
        }
        return resp.json();
    }

    // ---- 初始化 ----
    init();
    _listenAuthChanges();
    _patchFetch();

    // ---- 暴露 API ----
    return {
        init: init,
        isConfigured: isConfigured,
        isLoggedIn: isLoggedIn,
        getSession: getSession,
        getAccessToken: getAccessToken,
        signUp: signUp,
        signIn: signIn,
        signInPhone: signInPhone,
        verifyPhoneOtp: verifyPhoneOtp,
        signOut: signOut,
        showModal: showModal,
        hideModal: hideModal,
        updateUI: updateUI,
        _switchAuthTab: _switchAuthTab,
        listBooks: listBooks,
        createBook: createBook
    };
})();
