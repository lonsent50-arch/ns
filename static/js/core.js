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

    // ===== Init =====
    function init() {
        window.addEventListener('hashchange', router);
        router();
    }

    return {
        router: router, navigate: navigate, init: init,
        apiGet: apiGet, apiPost: apiPost, apiPut: apiPut, apiDelete: apiDelete,
        setState: setState, getState: getState, toast: toast
    };
})();

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', function() { NS.init(); });

function escHtml(s) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(s));
    return div.innerHTML;
}
