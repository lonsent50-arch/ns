var Bookshelf = (function() {
    var _filter = 'all';
    var _projects = [];

    function render() {
        NS.apiGet('/api/projects').then(function(data) {
            _projects = data.projects || data || [];
            _renderGrid();
        }).catch(function(e) {
            _projects = [];
            _renderGrid();
            console.warn('Bookshelf: 加载项目列表失败', e.message);
        });
    }

    function _renderGrid() {
        var grid = document.getElementById('bs-grid');
        if (!grid) return;

        var filtered = _filter === 'all' ? _projects : _projects.filter(function(p) {
            var st = p.status || 'active';
            if (_filter === 'done') return st === 'done';
            if (_filter === 'draft') return st === 'draft' || !p.chapter_count;
            return st !== 'done' && st !== 'draft';
        });

        var html = '';
        for (var i = 0; i < filtered.length; i++) {
            var p = filtered[i];
            var completed = p.chapter_completed || 0;
            var total = p.chapter_count || 1;
            var pct = total > 0 ? Math.round(completed / total * 100) : 0;
            var st = p.status || 'active';
            var statusClass = st === 'done' ? 'bs-status-done' : (st === 'draft' ? 'bs-status-draft' : 'bs-status-active');
            var statusText = st === 'done' ? '已完结' : (st === 'draft' ? '草稿' : '创作中');
            var color = _projectColor(p.id);
            html += '<div class="bs-card" onclick="NS.navigate(\'#workspace/' + p.id + '\')" oncontextmenu="Bookshelf._showContextMenu(event,\'' + p.id + '\',\'' + escHtml(p.title || '未命名') + '\');return false">' +
                '<button class="bs-card-del" onclick="event.stopPropagation();Bookshelf.deleteProject(\'' + p.id + '\',\'' + escHtml(p.title || '未命名') + '\')" title="删除项目">✕</button>' +
                '<div class="bs-card-cover" style="background:linear-gradient(135deg,' + color[0] + ',' + color[1] + ')">' +
                (p.title || '?').charAt(0).toUpperCase() +
                '</div>' +
                '<div class="bs-card-info">' +
                '<div class="bs-card-title">' + escHtml(p.title || '未命名') + '</div>' +
                '<div class="bs-card-meta">' + (p.chapter_count || 0) + '章 · ' + _formatWords(p.total_words || 0) + '</div>' +
                '<div class="bs-card-progress"><div class="bs-card-progress-fill" style="width:' + pct + '%"></div></div>' +
                '</div>' +
                '<span class="bs-card-status ' + statusClass + '">' + statusText + '</span>' +
                '</div>';
        }
        // New project card
        html += '<div class="bs-card bs-card-new" onclick="Bookshelf.createProject()">' +
            '<div class="bs-card-new-icon">＋</div>' +
            '<div class="bs-card-new-text">新建项目</div>' +
            '</div>';
        // Import card
        html += '<div class="bs-card bs-card-import" onclick="NS.navigate(\'#import\')">' +
            '<div class="bs-card-import-icon">📂</div>' +
            '<div class="bs-card-new-text">导入作品</div>' +
            '</div>';

        grid.innerHTML = html;
    }

    function setFilter(filter, btn) {
        _filter = filter;
        var tabs = document.querySelectorAll('.bs-tab');
        for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
        if (btn) btn.classList.add('active');
        _renderGrid();
    }

    function createProject() {
        var title = prompt('请输入书名：');
        if (!title || !title.trim()) return;
        var desc = prompt('请输入简介（可选）：') || '';
        var genre = prompt('请输入分类（如：玄幻、都市，可选）：') || '';
        NS.apiPost('/api/projects', { title: title.trim(), description: desc.trim(), genre: genre.trim() })
            .then(function(data) {
                NS.toast('项目创建成功', 'success');
                NS.navigate('#workspace/' + (data.id || data.project_id));
            }).catch(function(e) { NS.toast('创建失败：' + e.message, 'error'); });
    }

    function filter() {
        var q = (document.getElementById('bs-search') || {}).value || '';
        var cards = document.querySelectorAll('.bs-card:not(.bs-card-new):not(.bs-card-import)');
        for (var i = 0; i < cards.length; i++) {
            var title = cards[i].querySelector('.bs-card-title');
            if (title) {
                cards[i].style.display = (!q || title.textContent.indexOf(q) >= 0) ? '' : 'none';
            }
        }
    }

    function _projectColor(id) {
        var colors = [
            ['#6366f1', '#a78bfa'], ['#3b82f6', '#06b6d4'], ['#10b981', '#34d399'],
            ['#f59e0b', '#fbbf24'], ['#ef4444', '#f87171'], ['#8b5cf6', '#c084fc'],
            ['#ec4899', '#f472b6'], ['#14b8a6', '#2dd4bf']
        ];
        var hash = 0;
        for (var i = 0; i < (id || 'x').length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
        return colors[Math.abs(hash) % colors.length];
    }

    function deleteProject(id, title) {
        if (!confirm('确定删除项目「' + title + '」吗？\n\n此操作不可撤销，将永久删除所有章节和数据。')) return;
        NS.apiDelete('/api/projects/' + id).then(function() {
            NS.toast('项目已删除', 'success');
            render();
        }).catch(function(e) { NS.toast('删除失败：' + e.message, 'error'); });
    }

    function _showContextMenu(e, id, title) {
        e.preventDefault();
        var menu = document.getElementById('bs-context-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'bs-context-menu';
            menu.className = 'bs-context-menu';
            document.body.appendChild(menu);
        }
        menu.innerHTML = '<div class="bs-cm-item danger" data-action="delete">🗑 删除「' + escHtml(title) + '」</div>';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.style.display = 'block';
        menu.onclick = function(ev) {
            var action = (ev.target.closest('[data-action]') || {}).dataset;
            if (action.action === 'delete') { deleteProject(id, title); }
            menu.style.display = 'none';
        };
        var close = function(ev2) { if (!menu.contains(ev2.target)) { menu.style.display = 'none'; document.removeEventListener('click', close); } };
        setTimeout(function() { document.addEventListener('click', close); }, 10);
    }

    function _formatWords(n) {
        if (n >= 10000) return (n / 10000).toFixed(1) + '万字';
        if (n >= 1000) return (n / 1000).toFixed(1) + '千字';
        return (n || 0) + '字';
    }

    return { render: render, setFilter: setFilter, createProject: createProject, filter: filter, deleteProject: deleteProject, _showContextMenu: _showContextMenu };
})();
