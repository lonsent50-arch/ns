var Workspace = (function() {
    var _saveTimer = null;
    var _currentChapterId = null;

    function open(projectId) {
        NS.setState('projectId', projectId);
        // Load project info
        NS.apiGet('/api/projects/' + projectId + '/info').then(function(info) {
            var titleEl = document.getElementById('ws-project-title');
            if (titleEl) titleEl.textContent = info.title || '未命名项目';
        }).catch(function() {});

        // Load volumes and chapters
        _loadTree();

        // Setup paste handler
        var editor = document.getElementById('ws-editor-body');
        if (editor && !editor._pasteHooked) {
            editor._pasteHooked = true;
            editor.addEventListener('paste', function(e) {
                e.preventDefault();
                var text = (e.clipboardData || window.clipboardData).getData('text/plain');
                document.execCommand('insertText', false, text);
            });
        }
    }

    function _loadTree() {
        var pid = NS.getState('projectId');
        if (!pid) return;

        Promise.all([
            NS.apiGet('/api/projects/' + pid + '/volumes').catch(function() { return []; }),
            NS.apiGet('/api/projects/' + pid + '/chapters').catch(function() { return []; })
        ]).then(function(results) {
            var volumes = results[0];
            var chapters = results[1];
            NS.setState('volumes', volumes);
            NS.setState('chapters', chapters);
            if (typeof Tree !== 'undefined' && Tree.render) Tree.render(volumes, chapters);
            _updateProgress(chapters);
            if (chapters.length > 0 && !_currentChapterId) {
                selectChapter(chapters[0].id);
            }
        });
    }

    function selectChapter(cid) {
        _currentChapterId = cid;
        NS.setState('chapterId', cid);
        var pid = NS.getState('projectId');
        var chapters = NS.getState('chapters');
        var ch = null;
        for (var i = 0; i < chapters.length; i++) {
            if (chapters[i].id === cid) { ch = chapters[i]; break; }
        }
        // Update editor
        var titleEl = document.getElementById('ws-editor-title');
        var editor = document.getElementById('ws-editor-body');
        if (titleEl) titleEl.value = ch ? ch.title : '';
        if (editor) editor.innerHTML = ch ? (ch.content || '') : '';
        // Focus editor
        if (editor && ch) setTimeout(function() { editor.focus(); }, 100);
        // Update nav
        _updateNav(chapters);
        // Update tree highlight
        if (typeof Tree !== 'undefined' && Tree.highlight) Tree.highlight(cid);
        // Save status
        updateSaveStatus('saved');
        // Update word count
        updateWordCount();
    }

    function saveChapter() {
        var pid = NS.getState('projectId');
        var cid = _currentChapterId;
        if (!pid || !cid) return;
        var title = (document.getElementById('ws-editor-title') || {}).value || '';
        var content = (document.getElementById('ws-editor-body') || {}).innerHTML || '';
        updateSaveStatus('saving');
        NS.apiPut('/api/projects/' + pid + '/chapters/' + cid, { title: title, content: content })
            .then(function() { updateSaveStatus('saved'); })
            .catch(function(e) { updateSaveStatus('error'); NS.toast('保存失败: ' + e.message, 'error'); });
    }

    function onInput() {
        updateWordCount();
        updateSaveStatus('unsaved');
        // Debounce auto-save
        if (_saveTimer) clearTimeout(_saveTimer);
        _saveTimer = setTimeout(function() { saveChapter(); }, 800);
    }

    function updateWordCount() {
        var el = document.getElementById('ws-wordcount');
        var editor = document.getElementById('ws-editor-body');
        if (!el || !editor) return;
        var text = (editor.textContent || '').trim();
        var count = text.length;
        el.textContent = count + ' 字';
    }

    function updateSaveStatus(status) {
        var el = document.getElementById('ws-save-status');
        if (!el) return;
        var map = { saved: '💾 已保存', saving: '⏳ 保存中...', unsaved: '📝 未保存', error: '⚠️ 保存失败' };
        el.textContent = map[status] || '💾 已保存';
    }

    function _updateNav(chapters) {
        var el = document.getElementById('ws-ch-nav');
        if (!el) return;
        var idx = -1;
        for (var i = 0; i < chapters.length; i++) {
            if (chapters[i].id === _currentChapterId) { idx = i; break; }
        }
        el.textContent = (idx + 1) + '/' + chapters.length;
    }

    function navChapter(dir) {
        var chapters = NS.getState('chapters');
        var idx = -1;
        for (var i = 0; i < chapters.length; i++) {
            if (chapters[i].id === _currentChapterId) { idx = i; break; }
        }
        var newIdx = idx + dir;
        if (newIdx >= 0 && newIdx < chapters.length) {
            selectChapter(chapters[newIdx].id);
        }
    }

    function deleteChapter() {
        if (!_currentChapterId) return;
        if (!confirm('确定删除当前章节？此操作不可撤销。')) return;
        var pid = NS.getState('projectId');
        NS.apiDelete('/api/projects/' + pid + '/chapters/' + _currentChapterId)
            .then(function() {
                NS.toast('章节已删除', 'success');
                _currentChapterId = null;
                _loadTree();
                var editor = document.getElementById('ws-editor-body');
                var title = document.getElementById('ws-editor-title');
                if (editor) editor.innerHTML = '';
                if (title) title.value = '';
            }).catch(function(e) { NS.toast('删除失败: ' + e.message, 'error'); });
    }

    function toggleFullscreen() {
        var layout = document.getElementById('workspace-layout');
        if (!layout) return;
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            layout.requestFullscreen().catch(function() {});
        }
    }

    function _updateProgress(chapters) {
        var total = chapters.length || 0;
        var done = 0;
        for (var i = 0; i < chapters.length; i++) {
            if (chapters[i].status === 'done') done++;
        }
        var pct = total > 0 ? Math.round(done / total * 100) : 0;
        var fill = document.getElementById('ws-progress-fill');
        var text = document.getElementById('ws-progress-text');
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = done + '/' + total + '章 · ' + pct + '%';
    }

    return {
        open: open, selectChapter: selectChapter, saveChapter: saveChapter,
        onInput: onInput, navChapter: navChapter, deleteChapter: deleteChapter,
        toggleFullscreen: toggleFullscreen, _loadTree: _loadTree
    };
})();
