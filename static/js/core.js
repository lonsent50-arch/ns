// Novel Studio — Core: Router + API + State
var NS = (function() {
    'use strict';
    var _currentRoute = '';
    var _state = { projectId: null, chapterId: null, chapters: [], volumes: [], characters: [], outlineNodes: [] };

    // ===== Router =====
    function router() {
        var hash = location.hash || '#bookshelf';
        if (hash === _currentRoute) return;
        _currentRoute = hash;

        var views = document.querySelectorAll('.ns-view');
        for (var i = 0; i < views.length; i++) views[i].style.display = 'none';

        if (hash === '#bookshelf') {
            var v = document.getElementById('view-bookshelf');
            if (v) v.style.display = 'flex';
            if (typeof Bookshelf !== 'undefined' && Bookshelf.render) Bookshelf.render();
        } else if (hash.startsWith('#workspace/')) {
            var pid = hash.split('/')[1];
            _state.projectId = pid;
            var v = document.getElementById('view-workspace');
            if (v) v.style.display = 'grid';
            if (typeof Workspace !== 'undefined' && Workspace.open) Workspace.open(pid);
        } else if (hash.startsWith('#publish/')) {
            var pid = hash.split('/')[1];
            _state.projectId = pid;
            var v = document.getElementById('view-publish');
            if (v) v.style.display = 'flex';
            if (typeof Publish !== 'undefined' && Publish.open) Publish.open(pid);
        } else if (hash === '#ai-config') {
            var v = document.getElementById('view-ai-config');
            if (v) v.style.display = 'flex';
            if (typeof AIConfig !== 'undefined' && AIConfig.render) AIConfig.render();
        } else if (hash === '#import') {
            var v = document.getElementById('view-import');
            if (v) v.style.display = 'flex';
            if (typeof ImportWizard !== 'undefined' && ImportWizard.show) ImportWizard.show();
        }
    }

    function navigate(hash) { location.hash = hash; }

    // ===== API =====
    function apiGet(url) {
        return fetch(url).then(function(r) {
            if (!r.ok) throw new Error('API error: ' + r.status);
            return r.json();
        });
    }
    function apiPost(url, data) {
        return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            .then(function(r) { if (!r.ok) throw new Error('API error: ' + r.status); return r.json(); });
    }
    function apiPut(url, data) {
        return fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            .then(function(r) { if (!r.ok) throw new Error('API error: ' + r.status); return r.json(); });
    }
    function apiDelete(url) {
        return fetch(url, { method: 'DELETE' }).then(function(r) {
            if (!r.ok) throw new Error('API error: ' + r.status);
            return r.json();
        });
    }

    // ===== State Management =====
    function setState(key, val) { _state[key] = val; }
    function getState(key) { return _state[key]; }

    // ===== Toast Notifications =====
    function toast(msg, type) {
        type = type || 'info';
        var container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        var el = document.createElement('div');
        el.className = 'toast toast-' + type;
        el.textContent = msg;
        container.appendChild(el);
        setTimeout(function() { el.remove(); }, 3000);
    }

    // ===== Credits / Usage Tracking =====
    var FREE_TIER = 100000; // 免费额度 10万 tokens

    function _loadCredits() {
        try {
            var raw = localStorage.getItem('ns_credits');
            if (raw) return JSON.parse(raw);
        } catch(e) {}
        return { balance: FREE_TIER, used: 0 };
    }

    function _saveCredits(c) {
        try { localStorage.setItem('ns_credits', JSON.stringify(c)); } catch(e) {}
    }

    function getBalance() {
        var c = _loadCredits();
        return Math.max(0, c.balance);
    }

    function getUsed() {
        var c = _loadCredits();
        return c.used || 0;
    }

    function useTokens(count) {
        var c = _loadCredits();
        c.balance = Math.max(0, c.balance - (count || 0));
        c.used = (c.used || 0) + (count || 0);
        _saveCredits(c);
        renderCredits();
    }

    function renderCredits() {
        var el = document.getElementById('bs-credits');
        var balEl = document.getElementById('bs-credits-balance');
        var usageEl = document.getElementById('bs-credits-usage');
        if (!balEl) return;
        var c = _loadCredits();
        var bal = Math.max(0, c.balance);
        var used = c.used || 0;
        balEl.innerHTML = bal >= 1000 ? '💰 ' + (bal / 1000).toFixed(0) + 'K' : '💰 ' + bal;
        balEl.title = '剩余额度: ' + bal.toLocaleString() + ' tokens';
        usageEl.textContent = used > 0 ? '已用 ' + (used >= 1000 ? (used / 1000).toFixed(1) + 'K' : used) : '';
        if (el) {
            el.classList.remove('bs-credits-low', 'bs-credits-empty');
            if (bal <= 0) el.classList.add('bs-credits-empty');
            else if (bal < 10000) el.classList.add('bs-credits-low');
        }
    }

    function recharge(amount) {
        var c = _loadCredits();
        c.balance = (c.balance || 0) + (amount || 0);
        _saveCredits(c);
        renderCredits();
    }

    function _showRechargeDialog() {
        var opts = [
            { label: '10万 tokens — ¥9.9', amount: 100000 },
            { label: '50万 tokens — ¥39.9', amount: 500000 },
            { label: '100万 tokens — ¥69.9', amount: 1000000 },
            { label: '500万 tokens — ¥299', amount: 5000000 }
        ];
        var html = '<div style="padding:24px;text-align:center">' +
            '<h3 style="margin:0 0 4px;color:var(--text-primary)">充值额度</h3>' +
            '<p style="color:var(--text-muted);font-size:13px;margin:0 0 16px">选择充值套餐</p>';
        for (var i = 0; i < opts.length; i++) {
            html += '<button onclick="NS.recharge(' + opts[i].amount + ');closeModal()" style="display:block;width:100%;padding:10px;margin:6px 0;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);cursor:pointer;font-size:14px;transition:all 0.15s" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
                opts[i].label + '</button>';
        }
        html += '<p style="color:var(--text-muted);font-size:11px;margin-top:12px">充值功能开发中，当前为模拟演示</p></div>';
        showModal(html);
    }

    function showModal(html) {
        var overlay = document.getElementById('modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'modal-overlay';
            overlay.className = 'modal-overlay';
            overlay.onclick = function(e) { if (e.target === overlay) closeModal(); };
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = '<div class="modal-content">' + html + '</div>';
        overlay.style.display = 'flex';
    }
    function init() {
        window.addEventListener('hashchange', router);
        router();
        renderCredits();
    }

    return {
        router: router, navigate: navigate, init: init,
        apiGet: apiGet, apiPost: apiPost, apiPut: apiPut, apiDelete: apiDelete,
        setState: setState, getState: getState, toast: toast,
        getBalance: getBalance, getUsed: getUsed, useTokens: useTokens, renderCredits: renderCredits, recharge: recharge,
        _showRechargeDialog: _showRechargeDialog, showModal: showModal
    };
})();

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', function() { NS.init(); });

function escHtml(s) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(s));
    return div.innerHTML;
}

function closeModal() {
    var overlay = document.getElementById('modal-overlay');
    if (overlay) { overlay.style.display = 'none'; overlay.innerHTML = ''; }
}
