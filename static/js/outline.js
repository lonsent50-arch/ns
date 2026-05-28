var Outline = (function() {
    var _nodes = [];
    var _collapsed = {};
    var _selectedId = null;
    var _generating = false;

    var GENRES = ['玄幻', '都市', '科幻', '古风', '悬疑', '轻小说', '历史', '游戏', '末世', '仙侠', '武侠', '奇幻', '军事', '竞技', '同人', '其他'];
    var STYLES = ['热血', '轻松', '暗黑', '幽默', '温情', '正剧', '悬疑', '史诗'];

    function show() {
        var pid = NS.getState('projectId');
        if (!pid) { NS.toast('请先打开项目', 'error'); return; }
        document.getElementById('outline-slideout').style.display = 'flex';
        _loadOutline();
    }

    function hide() {
        document.getElementById('outline-slideout').style.display = 'none';
    }

    function _loadOutline() {
        var pid = NS.getState('projectId');
        NS.apiGet('/api/projects/' + pid + '/outline').then(function(data) {
            _nodes = data || [];
            _render();
        }).catch(function() {
            _nodes = [];
            _render();
        });
    }

    function _render() {
        var body = document.getElementById('outline-slideout-body');
        if (!body) return;

        // Load saved params
        var saved = {};
        try { saved = JSON.parse(localStorage.getItem('ns_outline_params') || '{}'); } catch(e) {}

        var html = '';

        // === Parameters Section ===
        html += '<div class="ol-section">' +
            '<div class="ol-section-title">📝 故事设定</div>' +
            '<label class="ol-label">故事梗概</label>' +
            '<textarea id="ol-premise" class="ol-textarea" rows="4" placeholder="用一段话描述你的故事核心构思...">' + escHtml(saved.premise || '') + '</textarea>';

        // Genre + Style row
        html += '<div class="ol-row">' +
            '<div class="ol-col">' +
            '<label class="ol-label">分类</label>' +
            '<select id="ol-genre" class="ol-select">';
        for (var i = 0; i < GENRES.length; i++) {
            var sel = saved.genre === GENRES[i] ? ' selected' : '';
            html += '<option value="' + GENRES[i] + '"' + sel + '>' + GENRES[i] + '</option>';
        }
        html += '</select></div>' +
            '<div class="ol-col">' +
            '<label class="ol-label">风格</label>' +
            '<select id="ol-style" class="ol-select">';
        for (var j = 0; j < STYLES.length; j++) {
            var sel2 = saved.style === STYLES[j] ? ' selected' : '';
            html += '<option value="' + STYLES[j] + '"' + sel2 + '>' + STYLES[j] + '</option>';
        }
        html += '</select></div></div>';

        // Generate button
        html += '<button class="ol-btn ol-btn-primary" id="ol-gen-btn" onclick="Outline.generateOutline()"' +
            (_generating ? ' disabled' : '') + '>' +
            (_generating ? '⏳ AI 构思中...' : '🤖 AI 一键生成大纲') + '</button>';
        html += '</div>';

        // === Outline Tree Section ===
        html += '<div class="ol-section">' +
            '<div class="ol-section-title">🗺️ 大纲结构</div>';

        if (_nodes.length === 0) {
            html += '<div class="empty-state"><div class="es-icon">🗺️</div><div class="es-title">暂无大纲</div><div class="es-desc">填写故事梗概后，点击"AI 一键生成大纲"</div></div>';
        } else {
            var roots = _nodes.filter(function(n) { return !n.parent_id; });
            for (var k = 0; k < roots.length; k++) {
                html += _renderNode(roots[k], 0);
            }

            // Add node button
            html += '<button class="ol-btn ol-btn-sm" onclick="Outline.addNode()" style="margin-top:8px">+ 添加节点</button>';

            // Action buttons
            html += '<div class="ol-actions">' +
                '<button class="ol-btn ol-btn-accent" onclick="Outline.autoGenerate()">🧙 自动生成角色+世界观</button>' +
                '<button class="ol-btn ol-btn-danger" onclick="Outline.clearOutline()">🗑 清空大纲</button>' +
                '</div>';
        }
        html += '</div>';

        // === Plot Structure Section (if available) ===
        if (window._plotStructure) {
            html += '<div class="ol-section"><div class="ol-section-title">📊 剧情结构</div>';
            html += _renderPlotStructure(window._plotStructure);
            html += '</div>';
        }

        body.innerHTML = html;
    }

    function _renderNode(node, depth) {
        var collapsed = _collapsed[node.id];
        var kids = _nodes.filter(function(n) { return n.parent_id === node.id; });
        var hasKids = kids.length > 0;
        var indent = Math.min(depth, 4);
        var isSelected = node.id === _selectedId;

        var h = '<div class="ol-node ol-depth-' + indent + (isSelected ? ' ol-selected' : '') + '" onclick="Outline.selectNode(\'' + node.id + '\')">' +
            '<span class="ol-toggle" onclick="event.stopPropagation();Outline.toggleNode(\'' + node.id + '\')">' +
            (hasKids ? (collapsed ? '▶' : '▼') : '　') +
            '</span>' +
            '<span class="ol-node-title">' + escHtml(node.title || '未命名') + '</span>' +
            '<span class="ol-node-actions">' +
            '<button class="ol-node-btn" onclick="event.stopPropagation();Outline.addChildNode(\'' + node.id + '\')" title="添加子节点">+</button>' +
            '<button class="ol-node-btn ol-node-del" onclick="event.stopPropagation();Outline.deleteNode(\'' + node.id + '\')" title="删除">✕</button>' +
            '</span>' +
            '</div>';

        // Content editor for selected node
        if (isSelected) {
            var selNode = _nodes.find(function(n) { return n.id === node.id; });
            h += '<div class="ol-node-editor">' +
                '<textarea id="ol-node-content" class="ol-textarea" rows="3" placeholder="节点内容..." onchange="Outline.saveNodeContent()">' + escHtml((selNode && selNode.content) || '') + '</textarea>' +
                '</div>';
        }

        if (hasKids && !collapsed) {
            for (var i = 0; i < kids.length; i++) {
                h += _renderNode(kids[i], depth + 1);
            }
        }
        return h;
    }

    function _renderPlotStructure(ps) {
        var html = '';
        if (ps.main_plot) {
            html += '<div class="ps-item"><span class="ps-label">🔴 主线</span>' + escHtml(ps.main_plot) + '</div>';
        }
        if (ps.sub_plots && ps.sub_plots.length > 0) {
            for (var i = 0; i < ps.sub_plots.length; i++) {
                html += '<div class="ps-item"><span class="ps-label">🟡 支线</span>' + escHtml(ps.sub_plots[i]) + '</div>';
            }
        }
        if (ps.volumes && ps.volumes.length > 0) {
            html += '<div class="ps-item"><span class="ps-label">📚 卷结构</span></div>';
            for (var j = 0; j < ps.volumes.length; j++) {
                var v = ps.volumes[j];
                html += '<div class="ps-vol">' + escHtml(v.title || ('第' + (j+1) + '卷')) + '</div>';
                if (v.chapters && v.chapters.length > 0) {
                    for (var k = 0; k < v.chapters.length; k++) {
                        html += '<div class="ps-ch">- ' + escHtml(v.chapters[k]) + '</div>';
                    }
                }
            }
        }
        if (!ps.main_plot && (!ps.sub_plots || ps.sub_plots.length === 0) && (!ps.volumes || ps.volumes.length === 0)) {
            html += '<div style="color:var(--text-muted);font-size:12px">暂无剧情结构数据</div>';
        }
        return html;
    }

    // === Actions ===

    function generateOutline() {
        var pid = NS.getState('projectId');
        var premise = (document.getElementById('ol-premise') || {}).value || '';
        if (!premise.trim()) { NS.toast('请先填写故事梗概', 'error'); return; }

        var genre = (document.getElementById('ol-genre') || {}).value || '';
        var style = (document.getElementById('ol-style') || {}).value || '';

        // Save params
        try { localStorage.setItem('ns_outline_params', JSON.stringify({premise: premise, genre: genre, style: style})); } catch(e) {}

        _generating = true;
        _render();

        NS.toast('AI 正在构思大纲...', 'info');
        NS.apiPost('/api/projects/' + pid + '/outline/generate', {premise: premise, genre: genre, style: style})
            .then(function(res) {
                if (!res || !res.content) { NS.toast('AI 生成失败，请重试', 'error'); _generating = false; _render(); return; }

                var nodes = [];
                var raw = res.content;
                try {
                    var cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    nodes = JSON.parse(cleaned);
                    if (!Array.isArray(nodes)) nodes = [nodes];
                } catch(e) {
                    // Text parse fallback
                    var lines = raw.split('\n').filter(function(l) { return l.trim(); });
                    var currentLv0 = null;
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i];
                        var trimmed = line.replace(/^[\s\-#\d\.、]*/, '').trim();
                        if (!trimmed || trimmed.length < 2) continue;
                        if (line.match(/^[卷部]/) || (!line.match(/^\s/) && !line.match(/^\d/))) {
                            nodes.push({level: 0, title: trimmed, children: []});
                            currentLv0 = nodes[nodes.length - 1];
                        } else if (currentLv0) {
                            var lvl = line.match(/^\s{4,}/) ? 2 : 1;
                            if (!currentLv0.children) currentLv0.children = [];
                            currentLv0.children.push({level: lvl, title: trimmed, children: []});
                        }
                    }
                }

                if (nodes.length === 0) { NS.toast('未能解析大纲结构', 'error'); _generating = false; _render(); return; }

                return NS.apiPost('/api/projects/' + pid + '/outline/import', {nodes: nodes});
            })
            .then(function(imp) {
                if (imp && imp.success) {
                    NS.toast('已生成 ' + imp.count + ' 个大纲节点', 'success');
                    _loadOutline();
                    _generating = false;
                    // Auto-sync: extract characters + plot structure
                    _autoSyncPlotStructure();
                } else {
                    _generating = false;
                    _render();
                }
            })
            .catch(function(e) {
                NS.toast('生成失败: ' + e.message, 'error');
                _generating = false;
                _render();
            });
    }

    function _autoSyncPlotStructure() {
        var pid = NS.getState('projectId');
        fetch('/api/projects/' + pid + '/outline/auto-sync', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({model: ''})
        }).then(function(r) { return r.json(); })
          .then(function(data) {
              if (data.success) {
                  window._plotStructure = data.plot_structure;
                  if (data.characters_created > 0) {
                      NS.toast('自动识别 ' + data.characters_created + ' 个角色', 'success');
                  }
                  _render();
              }
          }).catch(function() { /* silent */ });
    }

    function autoGenerate() {
        var pid = NS.getState('projectId');
        var premise = (document.getElementById('ol-premise') || {}).value || '';
        var genre = (document.getElementById('ol-genre') || {}).value || '';
        var style = (document.getElementById('ol-style') || {}).value || '';

        if (!premise.trim()) { NS.toast('请先填写故事梗概', 'error'); return; }
        NS.toast('AI 正在构建世界观和角色...', 'info');

        // Generate worldbuilding
        fetch('/api/projects/' + pid + '/ai/generate-worldbuilding', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({premise: premise, genre: genre, style: style})
        }).then(function(r) { return r.json(); })
          .then(function(data) {
              if (data.imported > 0) NS.toast('已生成 ' + data.imported + ' 条世界观设定', 'success');
          }).catch(function() {});

        // Generate characters
        fetch('/api/projects/' + pid + '/ai/generate-characters-batch', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({premise: premise, genre: genre, style: style})
        }).then(function(r) { return r.json(); })
          .then(function(data) {
              if (data.imported > 0) NS.toast('已生成 ' + data.imported + ' 个角色', 'success');
          }).catch(function() {});

        // Auto-sync
        _autoSyncPlotStructure();
    }

    // === Node CRUD ===

    function selectNode(nid) {
        _selectedId = (_selectedId === nid ? null : nid);
        _render();
    }

    function toggleNode(nid) {
        _collapsed[nid] = !_collapsed[nid];
        _render();
    }

    function addNode(parentId) {
        var title = prompt('请输入节点标题：');
        if (!title || !title.trim()) return;
        var pid = NS.getState('projectId');
        var parent = parentId ? _nodes.find(function(n) { return n.id === parentId; }) : null;
        var level = parent ? (parent.level || 0) + 1 : 0;
        NS.apiPost('/api/projects/' + pid + '/outline', {title: title.trim(), parent_id: parentId || null, level: level})
            .then(function() { _loadOutline(); NS.toast('节点已添加', 'success'); })
            .catch(function(e) { NS.toast('添加失败: ' + e.message, 'error'); });
    }

    function addChildNode(parentId) {
        addNode(parentId);
    }

    function deleteNode(nid) {
        if (!confirm('确定删除此节点及其所有子节点？')) return;
        var pid = NS.getState('projectId');
        NS.apiDelete('/api/projects/' + pid + '/outline/' + nid)
            .then(function() {
                if (_selectedId === nid) _selectedId = null;
                _loadOutline();
                NS.toast('节点已删除', 'success');
            })
            .catch(function(e) { NS.toast('删除失败: ' + e.message, 'error'); });
    }

    function saveNodeContent() {
        if (!_selectedId) return;
        var pid = NS.getState('projectId');
        var content = (document.getElementById('ol-node-content') || {}).value || '';
        NS.apiPut('/api/projects/' + pid + '/outline/' + _selectedId, {content: content})
            .then(function() { NS.toast('内容已保存', 'success'); })
            .catch(function() { /* silent */ });
    }

    function clearOutline() {
        if (!confirm('确定清空所有大纲节点？此操作不可撤销。')) return;
        var pid = NS.getState('projectId');
        var promises = [];
        for (var i = 0; i < _nodes.length; i++) {
            promises.push(NS.apiDelete('/api/projects/' + pid + '/outline/' + _nodes[i].id));
        }
        Promise.all(promises).then(function() {
            _nodes = [];
            _selectedId = null;
            _collapsed = {};
            window._plotStructure = null;
            _render();
            NS.toast('大纲已清空', 'success');
        }).catch(function() { NS.toast('清理失败', 'error'); });
    }

    return {
        show: show, hide: hide,
        generateOutline: generateOutline, autoGenerate: autoGenerate,
        selectNode: selectNode, toggleNode: toggleNode,
        addNode: addNode, addChildNode: addChildNode,
        deleteNode: deleteNode, saveNodeContent: saveNodeContent,
        clearOutline: clearOutline
    };
})();
