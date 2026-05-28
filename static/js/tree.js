var Tree = (function() {
    var _collapsed = {};

    function render(volumes, chapters) {
        var container = document.getElementById('ws-volumes');
        if (!container) return;

        // Build volume→chapters map
        var volMap = {};
        var orphanChs = [];
        for (var i = 0; i < chapters.length; i++) {
            var vid = chapters[i].volume_id || '';
            if (vid && vid !== 'null') {
                if (!volMap[vid]) volMap[vid] = [];
                volMap[vid].push(chapters[i]);
            } else {
                orphanChs.push(chapters[i]);
            }
        }

        var html = '';

        // Render volumes with chapters
        for (var v = 0; v < volumes.length; v++) {
            var vol = volumes[v];
            var chs = volMap[vol.id] || [];
            var isCollapsed = _collapsed[vol.id] || false;
            html += '<div class="ws-vol-node' + (isCollapsed ? ' collapsed' : '') + '" onclick="Tree.toggleVolume(\'' + vol.id + '\')">' +
                '<span class="ws-vol-toggle">▾</span> 📖 ' + escHtml(vol.title) +
                '</div>';
            if (!isCollapsed) {
                for (var c = 0; c < chs.length; c++) {
                    html += _renderChapterNode(chs[c]);
                }
            }
        }

        // Render orphan chapters (no volume)
        if (orphanChs.length > 0 && volumes.length === 0) {
            // No volumes at all: show chapters flat
            for (var o = 0; o < orphanChs.length; o++) {
                html += _renderChapterNode(orphanChs[o]);
            }
        } else if (orphanChs.length > 0) {
            html += '<div style="padding:4px 16px;font-size:11px;color:var(--text-muted)">未归类章节</div>';
            for (var o2 = 0; o2 < orphanChs.length; o2++) {
                html += _renderChapterNode(orphanChs[o2]);
            }
        }

        container.innerHTML = html;
        _updateProgress(chapters);
    }

    function _renderChapterNode(ch) {
        var statusMap = { draft: '🟡', polishing: '🔵', done: '🟢' };
        var statusIcon = statusMap[ch.status] || '🟡';
        var isActive = NS.getState('chapterId') === ch.id;
        return '<div class="ws-ch-node' + (isActive ? ' active' : '') + '" onclick="Workspace.selectChapter(\'' + ch.id + '\')" draggable="true">' +
            '<span class="ws-ch-status" onclick="event.stopPropagation();Tree.cycleStatus(\'' + ch.id + '\')" title="点击切换状态">' + statusIcon + '</span>' +
            '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(ch.title || '未命名') + '</span>' +
            '</div>';
    }

    function toggleVolume(vid) {
        _collapsed[vid] = !_collapsed[vid];
        render(NS.getState('volumes'), NS.getState('chapters'));
    }

    function highlight(cid) {
        var nodes = document.querySelectorAll('.ws-ch-node');
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].classList.remove('active');
        }
    }

    function addVolume() {
        var title = prompt('请输入卷名：');
        if (!title || !title.trim()) return;
        var pid = NS.getState('projectId');
        NS.apiPost('/api/projects/' + pid + '/volumes', { title: title.trim() })
            .then(function() {
                NS.toast('卷创建成功', 'success');
                if (typeof Workspace !== 'undefined' && Workspace._loadTree) Workspace._loadTree();
            })
            .catch(function(e) { NS.toast('创建失败: ' + e.message, 'error'); });
    }

    function addChapter() {
        var title = prompt('请输入章节标题：');
        if (!title || !title.trim()) return;
        var pid = NS.getState('projectId');
        NS.apiPost('/api/projects/' + pid + '/chapters', { title: title.trim() })
            .then(function(data) {
                NS.toast('章节创建成功', 'success');
                if (typeof Workspace !== 'undefined' && Workspace._loadTree) Workspace._loadTree();
                if (data.id) Workspace.selectChapter(data.id);
            }).catch(function(e) { NS.toast('创建失败: ' + e.message, 'error'); });
    }

    function cycleStatus(cid) {
        var chapters = NS.getState('chapters');
        var ch = null;
        for (var i = 0; i < chapters.length; i++) {
            if (chapters[i].id === cid) { ch = chapters[i]; break; }
        }
        if (!ch) return;
        var next = { draft: 'polishing', polishing: 'done', done: 'draft' };
        var newStatus = next[ch.status || 'draft'];
        var pid = NS.getState('projectId');
        NS.apiPut('/api/projects/' + pid + '/chapters/' + cid + '/status', { status: newStatus })
            .then(function() {
                ch.status = newStatus;
                render(NS.getState('volumes'), chapters);
            }).catch(function(e) { NS.toast('状态更新失败: ' + e.message, 'error'); });
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

    return { render: render, toggleVolume: toggleVolume, highlight: highlight,
             addVolume: addVolume, addChapter: addChapter, cycleStatus: cycleStatus };
})();
