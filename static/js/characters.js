var Characters = (function() {
    var _characters = [];
    var _selectedChar = null;
    var _visible = false;

    function show() {
        _visible = true;
        var right = document.getElementById('ws-right');
        if (!right) return;

        // Hide all panels, show character panel
        var panels = right.querySelectorAll('.ws-panel-card');
        for (var i = 0; i < panels.length; i++) panels[i].style.display = 'none';

        // Check if character panel already exists
        var panel = document.getElementById('panel-char-manager');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'panel-char-manager';
            panel.className = 'ws-panel-card';
            panel.innerHTML = '<div class="ws-panel-header">👤 角色管理</div>' +
                '<div class="ws-panel-body" id="char-panel-body">加载中...</div>';
            right.appendChild(panel);
        }
        panel.style.display = 'block';
        _loadCharacters();
    }

    function hide() {
        _visible = false;
        var panel = document.getElementById('panel-char-manager');
        if (panel) panel.style.display = 'none';
        var right = document.getElementById('ws-right');
        if (right) {
            var panels = right.querySelectorAll('.ws-panel-card:not([id="panel-char-manager"])');
            for (var i = 0; i < panels.length; i++) panels[i].style.display = '';
        }
    }

    function _loadCharacters() {
        var pid = NS.getState('projectId');
        if (!pid) return;
        NS.apiGet('/api/projects/' + pid + '/characters').then(function(data) {
            _characters = data || [];
            _renderList();
        }).catch(function() {
            _characters = [];
            _renderList();
        });
    }

    function _renderList() {
        var body = document.getElementById('char-panel-body');
        if (!body) return;

        var html = '';
        for (var i = 0; i < _characters.length; i++) {
            var ch = _characters[i];
            var color = _charColor(ch.id);
            html += '<div class="char-list-item' + (_selectedChar === ch.id ? ' active' : '') + '" onclick="Characters.selectChar(\'' + ch.id + '\')">' +
                '<div class="char-avatar" style="background:' + color + '">' + (ch.name || '?').charAt(0) + '</div>' +
                '<div class="char-info">' +
                '<div class="char-name">' + escHtml(ch.name || '未命名') + '</div>' +
                '<div class="char-tags">' + escHtml((ch.gender || '') + ' ' + (ch.personality || '')).trim() + '</div>' +
                '</div>' +
                '</div>';
        }
        html += '<button class="char-add-btn" onclick="Characters.addCharacter()">+ 新建角色</button>';
        body.innerHTML = html;

        // Show detail if selected
        if (_selectedChar) {
            _renderDetail(_selectedChar);
        }
    }

    function selectChar(cid) {
        _selectedChar = cid;
        _renderList();
    }

    function _renderDetail(cid) {
        var body = document.getElementById('char-panel-body');
        if (!body) return;

        var ch = null;
        for (var i = 0; i < _characters.length; i++) {
            if (_characters[i].id === cid) { ch = _characters[i]; break; }
        }
        if (!ch) return;

        body.innerHTML += '<div class="char-detail" id="char-detail">' +
            _renderField('姓名', 'name', ch.name, 'text') +
            _renderField('性别', 'gender', ch.gender, 'text') +
            _renderField('年龄', 'age', ch.age, 'text') +
            _renderField('性格', 'personality', ch.personality, 'textarea') +
            _renderField('背景', 'background', ch.background, 'textarea') +
            _renderField('目标', 'goal', ch.goal, 'textarea') +
            '<div style="display:flex;gap:6px;margin-top:10px">' +
            '<button class="ai-quick-btn" onclick="Characters.saveCharacter(\'' + cid + '\')" style="flex:1">💾 保存</button>' +
            '<button class="ai-quick-btn" onclick="Characters.deleteCharacter(\'' + cid + '\')" style="flex:1;color:var(--danger)">🗑 删除</button>' +
            '</div></div>';
    }

    function _renderField(label, key, value, type) {
        var safeValue = value || '';
        if (type === 'textarea') {
            return '<div class="char-detail-field"><div class="char-detail-label">' + label + '</div>' +
                '<textarea class="char-detail-textarea" id="char-field-' + key + '">' + escHtml(safeValue) + '</textarea></div>';
        }
        return '<div class="char-detail-field"><div class="char-detail-label">' + label + '</div>' +
            '<input class="char-detail-input" id="char-field-' + key + '" value="' + escHtml(safeValue) + '"></div>';
    }

    function addCharacter() {
        var name = prompt('请输入角色姓名：');
        if (!name || !name.trim()) return;
        var pid = NS.getState('projectId');
        NS.apiPost('/api/projects/' + pid + '/characters', { name: name.trim() })
            .then(function(data) {
                NS.toast('角色创建成功', 'success');
                _loadCharacters();
            }).catch(function(e) { NS.toast('创建失败: ' + e.message, 'error'); });
    }

    function saveCharacter(cid) {
        var data = {};
        var fields = ['name', 'gender', 'age', 'personality', 'background', 'goal'];
        for (var i = 0; i < fields.length; i++) {
            var el = document.getElementById('char-field-' + fields[i]);
            if (el) data[fields[i]] = el.value;
        }
        var pid = NS.getState('projectId');
        NS.apiPut('/api/projects/' + pid + '/characters/' + cid, data)
            .then(function() {
                NS.toast('角色已保存', 'success');
                _loadCharacters();
            }).catch(function(e) { NS.toast('保存失败: ' + e.message, 'error'); });
    }

    function deleteCharacter(cid) {
        if (!confirm('确定删除此角色？')) return;
        var pid = NS.getState('projectId');
        NS.apiDelete('/api/projects/' + pid + '/characters/' + cid)
            .then(function() {
                NS.toast('角色已删除', 'success');
                if (_selectedChar === cid) _selectedChar = null;
                _loadCharacters();
            }).catch(function(e) { NS.toast('删除失败: ' + e.message, 'error'); });
    }

    function _charColor(id) {
        var colors = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
        var hash = 0;
        for (var i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
        return colors[Math.abs(hash) % colors.length];
    }

    return { show: show, hide: hide, selectChar: selectChar, addCharacter: addCharacter,
             saveCharacter: saveCharacter, deleteCharacter: deleteCharacter };
})();
