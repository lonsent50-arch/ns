/* Novel Studio — Memory System: Relations, Foreshadowing, Plot Lines, Timeline */
var Memory = (function() {
    var _activeTab = 'relations';
    var _projectId = null;
    var _relations = [];
    var _foreshadowing = [];
    var _plotLines = [];
    var _chapters = [];
    var _characters = [];
    var _visible = false;

    // Relation type config
    var _relationTypes = ['朋友', '恋人', '师徒', '仇敌', '家人', '盟友', '其他'];
    var _relationColors = {
        '朋友': '#30d158',
        '恋人': '#ff453a',
        '师徒': '#a78bfa',
        '仇敌': '#ffd60a',
        '家人': '#ff9f0a',
        '盟友': '#0A84FF',
        '其他': '#8e8e93'
    };

    // ===== show / hide =====
    function show() {
        _visible = true;
        _projectId = NS.getState('projectId');
        var right = document.getElementById('ws-right');
        if (!right) return;

        // Hide all panel cards
        var panels = right.querySelectorAll('.ws-panel-card');
        for (var i = 0; i < panels.length; i++) panels[i].style.display = 'none';

        // Check if memory panel already exists
        var panel = document.getElementById('panel-memory');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'panel-memory';
            panel.className = 'ws-panel-card';
            panel.innerHTML = '<div class="ws-panel-header">🧠 记忆系统</div>' +
                '<div class="ws-panel-body" id="memory-panel-body">加载中...</div>';
            right.appendChild(panel);
        }
        panel.style.display = 'block';
        _loadAllData();
    }

    function hide() {
        _visible = false;
        var panel = document.getElementById('panel-memory');
        if (panel) panel.style.display = 'none';
        var right = document.getElementById('ws-right');
        if (right) {
            var panels = right.querySelectorAll('.ws-panel-card:not([id="panel-memory"])');
            for (var i = 0; i < panels.length; i++) panels[i].style.display = '';
        }
    }

    // ===== Data Loading =====
    function _loadAllData() {
        if (!_projectId) return;
        var p1 = NS.apiGet('/api/projects/' + _projectId + '/memory/relations').then(function(data) {
            _relations = (data && data.relations) ? data.relations : [];
        }).catch(function() { _relations = []; });

        var p2 = NS.apiGet('/api/projects/' + _projectId + '/memory/foreshadowing').then(function(data) {
            _foreshadowing = (data && data.items) ? data.items : [];
        }).catch(function() { _foreshadowing = []; });

        var p3 = NS.apiGet('/api/projects/' + _projectId + '/memory/plot-lines').then(function(data) {
            _plotLines = (data && data.plot_lines) ? data.plot_lines : [];
        }).catch(function() { _plotLines = []; });

        var p4 = NS.apiGet('/api/projects/' + _projectId + '/chapters').then(function(data) {
            _chapters = data || [];
        }).catch(function() { _chapters = []; });

        var p5 = NS.apiGet('/api/projects/' + _projectId + '/characters').then(function(data) {
            _characters = data || [];
        }).catch(function() { _characters = []; });

        Promise.all([p1, p2, p3, p4, p5]).then(function() {
            _render();
        });
    }

    function _reloadRelations() {
        if (!_projectId) return;
        NS.apiGet('/api/projects/' + _projectId + '/memory/relations').then(function(data) {
            _relations = (data && data.relations) ? data.relations : [];
            _render();
        }).catch(function() { _relations = []; _render(); });
    }

    function _reloadForeshadowing() {
        if (!_projectId) return;
        NS.apiGet('/api/projects/' + _projectId + '/memory/foreshadowing').then(function(data) {
            _foreshadowing = (data && data.items) ? data.items : [];
            _render();
        }).catch(function() { _foreshadowing = []; _render(); });
    }

    function _reloadPlotLines() {
        if (!_projectId) return;
        NS.apiGet('/api/projects/' + _projectId + '/memory/plot-lines').then(function(data) {
            _plotLines = (data && data.plot_lines) ? data.plot_lines : [];
            _render();
        }).catch(function() { _plotLines = []; _render(); });
    }

    // ===== Render Main =====
    function _render() {
        var body = document.getElementById('memory-panel-body');
        if (!body) return;

        var html = '';
        // Tab bar
        html += '<div class="mem-tabs">' +
            '<button class="mem-tab' + (_activeTab === 'relations' ? ' active' : '') + '" onclick="Memory._switchTab(\'relations\')">关系图</button>' +
            '<button class="mem-tab' + (_activeTab === 'foreshadowing' ? ' active' : '') + '" onclick="Memory._switchTab(\'foreshadowing\')">伏笔</button>' +
            '<button class="mem-tab' + (_activeTab === 'plotlines' ? ' active' : '') + '" onclick="Memory._switchTab(\'plotlines\')">情节线</button>' +
            '<button class="mem-tab' + (_activeTab === 'timeline' ? ' active' : '') + '" onclick="Memory._switchTab(\'timeline\')">时间线</button>' +
            '</div>';

        // Tab content
        html += '<div class="mem-content" id="mem-content">';
        if (_activeTab === 'relations') {
            html += _renderRelationsHtml();
        } else if (_activeTab === 'foreshadowing') {
            html += _renderForeshadowingHtml();
        } else if (_activeTab === 'plotlines') {
            html += _renderPlotLinesHtml();
        } else if (_activeTab === 'timeline') {
            html += _renderTimelineHtml();
        }
        html += '</div>';

        body.innerHTML = html;

        // Draw canvas if on relations tab
        if (_activeTab === 'relations') {
            setTimeout(function() { _drawGraph(); }, 100);
        }
    }

    function _switchTab(tab) {
        _activeTab = tab;
        _render();
    }

    // ===== Tab 1: Relations =====
    function _renderRelationsHtml() {
        var html = '';

        // Relation list
        html += '<div class="mem-section">';
        html += '<div class="mem-section-header">角色关系列表</div>';
        if (_relations.length === 0) {
            html += '<div class="mem-empty">暂无关系数据</div>';
        } else {
            for (var i = 0; i < _relations.length; i++) {
                var rel = _relations[i];
                var color = _relationColors[rel.relation_type] || '#8e8e93';
                html += '<div class="mem-relation-item">' +
                    '<div class="mem-rel-info">' +
                    '<span class="mem-rel-char">' + escHtml(rel.char1_name || '未知') + '</span>' +
                    '<span class="mem-rel-arrow">&harr;</span>' +
                    '<span class="mem-rel-char">' + escHtml(rel.char2_name || '未知') + '</span>' +
                    '<span class="mem-rel-badge" style="background:' + color + '20;color:' + color + ';border:1px solid ' + color + '40">' + escHtml(rel.relation_type || '其他') + '</span>' +
                    '</div>' +
                    '<div class="mem-rel-strength">' +
                    '<span class="mem-rel-strength-label">强度:</span>' +
                    '<span class="mem-rel-strength-bar"><span class="mem-rel-strength-fill" style="width:' + ((rel.strength || 1) * 10) + '%;background:' + color + '"></span></span>' +
                    '<span class="mem-rel-strength-val">' + (rel.strength || 1) + '/10</span>' +
                    '</div>';
                if (rel.description) {
                    html += '<div class="mem-rel-desc">' + escHtml(rel.description) + '</div>';
                }
                html += '<button class="mem-btn-del" onclick="Memory._deleteRelation(\'' + rel.id + '\')">删除</button>' +
                    '</div>';
            }
        }
        html += '</div>';

        // Add relation form
        html += '<div class="mem-section">';
        html += '<div class="mem-section-header">添加关系</div>';
        html += '<div class="mem-form" id="mem-rel-form">';
        html += '<div class="mem-form-row">' +
            '<label class="mem-label">角色A</label>' +
            '<select class="mem-select" id="rel-char1">' +
            '<option value="">-- 选择角色 --</option>';
        for (var ci = 0; ci < _characters.length; ci++) {
            html += '<option value="' + _characters[ci].id + '">' + escHtml(_characters[ci].name || '未命名') + '</option>';
        }
        html += '</select></div>';

        html += '<div class="mem-form-row">' +
            '<label class="mem-label">角色B</label>' +
            '<select class="mem-select" id="rel-char2">' +
            '<option value="">-- 选择角色 --</option>';
        for (var cj = 0; cj < _characters.length; cj++) {
            html += '<option value="' + _characters[cj].id + '">' + escHtml(_characters[cj].name || '未命名') + '</option>';
        }
        html += '</select></div>';

        html += '<div class="mem-form-row">' +
            '<label class="mem-label">关系类型</label>' +
            '<select class="mem-select" id="rel-type">';
        for (var rt = 0; rt < _relationTypes.length; rt++) {
            html += '<option value="' + _relationTypes[rt] + '">' + _relationTypes[rt] + '</option>';
        }
        html += '</select></div>';

        html += '<div class="mem-form-row">' +
            '<label class="mem-label">关系强度: <span id="rel-strength-val">5</span></label>' +
            '<input type="range" class="mem-range" id="rel-strength" min="1" max="10" value="5" oninput="document.getElementById(\'rel-strength-val\').textContent=this.value">' +
            '</div>';

        html += '<div class="mem-form-row">' +
            '<label class="mem-label">描述</label>' +
            '<textarea class="mem-textarea" id="rel-desc" rows="2" placeholder="描述角色间的关系..."></textarea>' +
            '</div>';

        html += '<div class="mem-form-actions">' +
            '<button class="mem-btn-primary" onclick="Memory._addRelation()">保存</button>' +
            '</div>';
        html += '</div></div>';

        // Canvas graph
        html += '<div class="mem-section">';
        html += '<div class="mem-section-header">关系图谱</div>';
        html += '<div class="mem-canvas-wrap">';
        html += '<canvas id="mem-graph-canvas" width="600" height="400"></canvas>';
        html += '</div></div>';

        return html;
    }

    function _addRelation() {
        var char1 = document.getElementById('rel-char1').value;
        var char2 = document.getElementById('rel-char2').value;
        var type = document.getElementById('rel-type').value;
        var strength = parseInt(document.getElementById('rel-strength').value, 10);
        var desc = document.getElementById('rel-desc').value.trim();

        if (!char1 || !char2) { NS.toast('请选择两个角色', 'warning'); return; }
        if (char1 === char2) { NS.toast('不能选择相同角色', 'warning'); return; }

        NS.apiPost('/api/projects/' + _projectId + '/memory/relations', {
            char1_id: char1,
            char2_id: char2,
            relation_type: type,
            strength: strength,
            description: desc
        }).then(function() {
            NS.toast('关系已添加', 'success');
            _reloadRelations();
        }).catch(function(e) {
            NS.toast('添加失败: ' + e.message, 'error');
        });
    }

    function _deleteRelation(rid) {
        if (!confirm('确定删除此关系？')) return;
        NS.apiDelete('/api/projects/' + _projectId + '/memory/relations/' + rid)
            .then(function() {
                NS.toast('关系已删除', 'success');
                _reloadRelations();
            }).catch(function(e) {
                NS.toast('删除失败: ' + e.message, 'error');
            });
    }

    // ===== Tab 2: Foreshadowing =====
    function _renderForeshadowingHtml() {
        var html = '';

        html += '<div class="mem-section">';
        html += '<div class="mem-section-header">伏笔管理</div>';

        if (_foreshadowing.length === 0) {
            html += '<div class="mem-empty">暂无伏笔数据</div>';
        } else {
            for (var i = 0; i < _foreshadowing.length; i++) {
                var fs = _foreshadowing[i];
                var isRevealed = fs.status === 'revealed';
                var badgeClass = isRevealed ? 'mem-badge-revealed' : 'mem-badge-planted';
                var badgeText = isRevealed ? '已揭示' : '已埋设';

                html += '<div class="mem-fs-item" id="fs-item-' + fs.id + '">' +
                    '<div class="mem-fs-header">' +
                    '<span class="mem-fs-badge ' + badgeClass + '">' + badgeText + '</span>' +
                    '<div class="mem-fs-actions">' +
                    '<button class="mem-btn-sm" onclick="Memory._editForeshadowing(\'' + fs.id + '\')">编辑</button>' +
                    '<button class="mem-btn-sm mem-btn-danger" onclick="Memory._deleteForeshadowing(\'' + fs.id + '\')">删除</button>' +
                    '</div></div>' +
                    '<div class="mem-fs-desc">' + escHtml(fs.description || '') + '</div>' +
                    '<div class="mem-fs-meta">' +
                    '<span>埋设章: ' + escHtml(fs.plant_chapter_title || '未知') + '</span>' +
                    '<span class="mem-fs-sep">|</span>' +
                    '<span>揭示章: ' + escHtml(fs.reveal_chapter_title || '未指定') + '</span>' +
                    '</div></div>';
            }
        }
        html += '</div>';

        // Add form
        html += '<div class="mem-section">';
        html += '<div class="mem-section-header">添加伏笔</div>';
        html += '<div class="mem-form" id="mem-fs-form">';
        html += '<div class="mem-form-row">' +
            '<label class="mem-label">描述</label>' +
            '<textarea class="mem-textarea" id="fs-desc" rows="2" placeholder="伏笔描述..."></textarea>' +
            '</div>';

        html += '<div class="mem-form-row">' +
            '<label class="mem-label">埋设章节</label>' +
            '<select class="mem-select" id="fs-plant-ch">' +
            '<option value="">-- 选择章节 --</option>';
        for (var pi = 0; pi < _chapters.length; pi++) {
            html += '<option value="' + _chapters[pi].id + '">' + escHtml(_chapters[pi].title || ('第' + (_chapters[pi].number || '?') + '章')) + '</option>';
        }
        html += '</select></div>';

        html += '<div class="mem-form-row">' +
            '<label class="mem-label">揭示章节</label>' +
            '<select class="mem-select" id="fs-reveal-ch">' +
            '<option value="">-- 未指定 --</option>';
        for (var ri = 0; ri < _chapters.length; ri++) {
            html += '<option value="' + _chapters[ri].id + '">' + escHtml(_chapters[ri].title || ('第' + (_chapters[ri].number || '?') + '章')) + '</option>';
        }
        html += '</select></div>';

        html += '<div class="mem-form-row">' +
            '<label class="mem-label">状态</label>' +
            '<select class="mem-select" id="fs-status">' +
            '<option value="planted">已埋设</option>' +
            '<option value="revealed">已揭示</option>' +
            '</select></div>';

        html += '<div class="mem-form-actions">' +
            '<button class="mem-btn-primary" onclick="Memory._addForeshadowing()">保存</button>' +
            '</div>';
        html += '</div></div>';

        return html;
    }

    function _addForeshadowing() {
        var desc = document.getElementById('fs-desc').value.trim();
        var plantCh = document.getElementById('fs-plant-ch').value;
        var revealCh = document.getElementById('fs-reveal-ch').value;
        var status = document.getElementById('fs-status').value;

        if (!desc) { NS.toast('请输入伏笔描述', 'warning'); return; }

        var data = { description: desc, status: status };
        if (plantCh) data.plant_chapter_id = plantCh;
        if (revealCh) data.reveal_chapter_id = revealCh;

        NS.apiPost('/api/projects/' + _projectId + '/memory/foreshadowing', data)
            .then(function() {
                NS.toast('伏笔已添加', 'success');
                _reloadForeshadowing();
            }).catch(function(e) {
                NS.toast('添加失败: ' + e.message, 'error');
            });
    }

    function _editForeshadowing(fid) {
        var item = null;
        for (var i = 0; i < _foreshadowing.length; i++) {
            if (_foreshadowing[i].id === fid) { item = _foreshadowing[i]; break; }
        }
        if (!item) return;

        var div = document.getElementById('fs-item-' + fid);
        if (!div) return;

        var isRevealed = item.status === 'revealed';

        var chOptions = '';
        for (var j = 0; j < _chapters.length; j++) {
            chOptions += '<option value="' + _chapters[j].id + '"' +
                (item.plant_chapter_id === _chapters[j].id ? ' selected' : '') + '>' +
                escHtml(_chapters[j].title || ('第' + (_chapters[j].number || '?') + '章')) + '</option>';
        }
        var chOptionsReveal = '<option value=""' + (!item.reveal_chapter_id ? ' selected' : '') + '>-- 未指定 --</option>';
        for (var k = 0; k < _chapters.length; k++) {
            chOptionsReveal += '<option value="' + _chapters[k].id + '"' +
                (item.reveal_chapter_id === _chapters[k].id ? ' selected' : '') + '>' +
                escHtml(_chapters[k].title || ('第' + (_chapters[k].number || '?') + '章')) + '</option>';
        }

        div.innerHTML = '<div class="mem-fs-edit">' +
            '<textarea class="mem-textarea" id="fs-edit-desc-' + fid + '" rows="2">' + escHtml(item.description || '') + '</textarea>' +
            '<div class="mem-form-row"><label class="mem-label">埋设章节</label>' +
            '<select class="mem-select" id="fs-edit-plant-' + fid + '">' + chOptions + '</select></div>' +
            '<div class="mem-form-row"><label class="mem-label">揭示章节</label>' +
            '<select class="mem-select" id="fs-edit-reveal-' + fid + '">' + chOptionsReveal + '</select></div>' +
            '<div class="mem-form-row"><label class="mem-label">状态</label>' +
            '<select class="mem-select" id="fs-edit-status-' + fid + '">' +
            '<option value="planted"' + (!isRevealed ? ' selected' : '') + '>已埋设</option>' +
            '<option value="revealed"' + (isRevealed ? ' selected' : '') + '>已揭示</option>' +
            '</select></div>' +
            '<div class="mem-form-actions">' +
            '<button class="mem-btn-primary" onclick="Memory._saveForeshadowing(\'' + fid + '\')">保存</button>' +
            '<button class="mem-btn-cancel" onclick="Memory._cancelEditForeshadowing(\'' + fid + '\')">取消</button>' +
            '</div></div>';
    }

    function _saveForeshadowing(fid) {
        var desc = document.getElementById('fs-edit-desc-' + fid);
        var plant = document.getElementById('fs-edit-plant-' + fid);
        var reveal = document.getElementById('fs-edit-reveal-' + fid);
        var status = document.getElementById('fs-edit-status-' + fid);

        if (!desc) return;
        var data = {
            description: desc.value.trim(),
            status: status ? status.value : 'planted'
        };
        if (plant && plant.value) data.plant_chapter_id = plant.value;
        if (reveal && reveal.value) data.reveal_chapter_id = reveal.value;

        NS.apiPut('/api/projects/' + _projectId + '/memory/foreshadowing/' + fid, data)
            .then(function() {
                NS.toast('伏笔已更新', 'success');
                _reloadForeshadowing();
            }).catch(function(e) {
                NS.toast('更新失败: ' + e.message, 'error');
            });
    }

    function _cancelEditForeshadowing(fid) {
        _reloadForeshadowing();
    }

    function _deleteForeshadowing(fid) {
        if (!confirm('确定删除此伏笔？')) return;
        NS.apiDelete('/api/projects/' + _projectId + '/memory/foreshadowing/' + fid)
            .then(function() {
                NS.toast('伏笔已删除', 'success');
                _reloadForeshadowing();
            }).catch(function(e) {
                NS.toast('删除失败: ' + e.message, 'error');
            });
    }

    // ===== Tab 3: Plot Lines =====
    function _renderPlotLinesHtml() {
        var html = '';

        // Group by type
        var groups = { 'main': [], 'sub': [], 'hidden': [] };
        for (var i = 0; i < _plotLines.length; i++) {
            var pl = _plotLines[i];
            var t = pl.type || 'sub';
            if (!groups[t]) groups[t] = [];
            groups[t].push(pl);
        }

        var groupConfig = [
            { key: 'main', label: '主线', icon: '', color: '#ff453a' },
            { key: 'sub', label: '支线', icon: '', color: '#f59e0b' },
            { key: 'hidden', label: '隐藏线', icon: '', color: '#0A84FF' }
        ];

        for (var g = 0; g < groupConfig.length; g++) {
            var gc = groupConfig[g];
            var items = groups[gc.key] || [];

            html += '<div class="mem-section">';
            html += '<div class="mem-pl-group-header" style="border-left:3px solid ' + gc.color + '">' +
                '<span class="mem-pl-group-icon" style="color:' + gc.color + '">&#9679;</span>' +
                gc.label + ' <span class="mem-pl-count">(' + items.length + ')</span></div>';

            if (items.length === 0) {
                html += '<div class="mem-empty">暂无' + gc.label + '</div>';
            } else {
                for (var j = 0; j < items.length; j++) {
                    var pl = items[j];
                    var statusBadge = '';
                    var statusClass = '';
                    if (pl.status === 'active') { statusBadge = '进行中'; statusClass = 'mem-badge-active'; }
                    else if (pl.status === 'completed') { statusBadge = '已完成'; statusClass = 'mem-badge-completed'; }
                    else if (pl.status === 'abandoned') { statusBadge = '已废弃'; statusClass = 'mem-badge-abandoned'; }
                    else { statusBadge = pl.status || '未知'; statusClass = 'mem-badge-planted'; }

                    html += '<div class="mem-pl-item">' +
                        '<div class="mem-pl-header">' +
                        '<span class="mem-pl-name">' + escHtml(pl.name || '未命名') + '</span>' +
                        '<span class="mem-pl-status ' + statusClass + '">' + statusBadge + '</span>' +
                        '</div>';
                    if (pl.description) {
                        html += '<div class="mem-pl-desc">' + escHtml(pl.description) + '</div>';
                    }
                    // Chapter tags
                    if (pl.chapter_titles && pl.chapter_titles.length > 0) {
                        html += '<div class="mem-pl-chapters">';
                        for (var c = 0; c < pl.chapter_titles.length; c++) {
                            var chId = pl.chapter_ids ? pl.chapter_ids[c] : '';
                            html += '<span class="mem-pl-ch-tag" onclick="NS.navigate(\'#workspace/' + _projectId + '\');setTimeout(function(){if(typeof Workspace!==\'undefined\'&&Workspace.selectChapter)Workspace.selectChapter(\'' + (chId || '') + '\');},200)" title="跳转到此章节">' +
                                escHtml(pl.chapter_titles[c]) + '</span>';
                        }
                        html += '</div>';
                    }
                    html += '<button class="mem-btn-del" onclick="Memory._deletePlotLine(\'' + pl.id + '\')">删除</button>' +
                        '</div>';
                }
            }
            html += '</div>';
        }

        // Add form
        html += '<div class="mem-section">';
        html += '<div class="mem-section-header">添加情节线</div>';
        html += '<div class="mem-form" id="mem-pl-form">';
        html += '<div class="mem-form-row">' +
            '<label class="mem-label">名称</label>' +
            '<input class="mem-input" id="pl-name" placeholder="情节线名称">' +
            '</div>';
        html += '<div class="mem-form-row">' +
            '<label class="mem-label">描述</label>' +
            '<textarea class="mem-textarea" id="pl-desc" rows="2" placeholder="情节描述..."></textarea>' +
            '</div>';
        html += '<div class="mem-form-row">' +
            '<label class="mem-label">类型</label>' +
            '<select class="mem-select" id="pl-type">' +
            '<option value="main">主线</option>' +
            '<option value="sub">支线</option>' +
            '<option value="hidden">隐藏线</option>' +
            '</select></div>';
        html += '<div class="mem-form-row">' +
            '<label class="mem-label">状态</label>' +
            '<select class="mem-select" id="pl-status">' +
            '<option value="active">进行中</option>' +
            '<option value="completed">已完成</option>' +
            '<option value="abandoned">已废弃</option>' +
            '</select></div>';
        html += '<div class="mem-form-actions">' +
            '<button class="mem-btn-primary" onclick="Memory._addPlotLine()">保存</button>' +
            '</div>';
        html += '</div></div>';

        return html;
    }

    function _addPlotLine() {
        var name = document.getElementById('pl-name').value.trim();
        var desc = document.getElementById('pl-desc').value.trim();
        var type = document.getElementById('pl-type').value;
        var status = document.getElementById('pl-status').value;

        if (!name) { NS.toast('请输入情节线名称', 'warning'); return; }

        NS.apiPost('/api/projects/' + _projectId + '/memory/plot-lines', {
            name: name,
            description: desc,
            type: type,
            status: status
        }).then(function() {
            NS.toast('情节线已添加', 'success');
            _reloadPlotLines();
        }).catch(function(e) {
            NS.toast('添加失败: ' + e.message, 'error');
        });
    }

    function _deletePlotLine(pid) {
        if (!confirm('确定删除此情节线？')) return;
        NS.apiDelete('/api/projects/' + _projectId + '/memory/plot-lines/' + pid)
            .then(function() {
                NS.toast('情节线已删除', 'success');
                _reloadPlotLines();
            }).catch(function(e) {
                NS.toast('删除失败: ' + e.message, 'error');
            });
    }

    // ===== Tab 4: Timeline =====
    function _renderTimelineHtml() {
        var html = '';

        html += '<div class="mem-section">';
        html += '<div class="mem-section-header">章节时间线</div>';

        if (_chapters.length === 0) {
            html += '<div class="mem-empty">暂无章节数据</div>';
        } else {
            html += '<div class="mem-timeline">';
            for (var i = 0; i < _chapters.length; i++) {
                var ch = _chapters[i];
                var isLast = (i === _chapters.length - 1);
                var statusDot = '';
                if (ch.status === 'completed') statusDot = 'mem-tl-dot-done';
                else if (ch.status === 'draft') statusDot = 'mem-tl-dot-draft';
                else statusDot = 'mem-tl-dot-pending';

                html += '<div class="mem-tl-item">' +
                    '<div class="mem-tl-line"><div class="mem-tl-dot ' + statusDot + '"></div>' +
                    (!isLast ? '<div class="mem-tl-connector"></div>' : '') +
                    '</div>' +
                    '<div class="mem-tl-content" onclick="NS.navigate(\'#workspace/' + _projectId + '\');setTimeout(function(){if(typeof Workspace!==\'undefined\'&&Workspace.selectChapter)Workspace.selectChapter(\'' + (ch.id || '') + '\');},200)" title="跳转到此章节">' +
                    '<div class="mem-tl-title">' + (ch.number ? '第' + ch.number + '章 ' : '') + escHtml(ch.title || '未命名') + '</div>' +
                    '<div class="mem-tl-meta">' +
                    '<span class="mem-tl-status">' + (ch.status === 'completed' ? '已完成' : (ch.status === 'draft' ? '草稿' : '待写')) + '</span>';
                if (ch.word_count) {
                    html += '<span class="mem-tl-words">' + ch.word_count + ' 字</span>';
                }
                html += '</div></div></div>';
            }
            html += '</div>';
        }
        html += '</div>';

        return html;
    }

    // ===== Canvas Force-Directed Graph =====
    function _drawGraph() {
        var canvas = document.getElementById('mem-graph-canvas');
        if (!canvas) return;

        var ctx = canvas.getContext('2d');
        var W = canvas.width;
        var H = canvas.height;

        // Clear
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(10,10,15,0.6)';
        ctx.fillRect(0, 0, W, H);

        // Get characters that have relations, plus add all characters
        var nodeMap = {};
        var nodes = [];

        // Create nodes for all characters
        for (var i = 0; i < _characters.length; i++) {
            var ch = _characters[i];
            var node = {
                id: ch.id,
                name: ch.name || '未命名',
                x: W / 2 + (Math.random() - 0.5) * 200,
                y: H / 2 + (Math.random() - 0.5) * 200,
                vx: 0,
                vy: 0,
                color: _charColor(ch.id)
            };
            nodeMap[ch.id] = node;
            nodes.push(node);
        }

        // Build edges from relations
        var edges = [];
        for (var j = 0; j < _relations.length; j++) {
            var rel = _relations[j];
            var from = nodeMap[rel.char1_id];
            var to = nodeMap[rel.char2_id];
            if (from && to) {
                edges.push({
                    from: from,
                    to: to,
                    type: rel.relation_type,
                    strength: rel.strength || 1,
                    color: _relationColors[rel.relation_type] || '#8e8e93'
                });
            }
        }

        if (nodes.length === 0) {
            ctx.fillStyle = '#8e8e93';
            ctx.font = '12px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('暂无角色数据', W / 2, H / 2);
            return;
        }

        // Force simulation
        var iterations = 60;
        var repulsion = 8000;
        var attraction = 0.005;
        var centering = 0.01;
        var damping = 0.85;
        var maxSpeed = 10;

        for (var iter = 0; iter < iterations; iter++) {
            // Repulsion between all node pairs
            for (var a = 0; a < nodes.length; a++) {
                for (var b = a + 1; b < nodes.length; b++) {
                    var dx = nodes[a].x - nodes[b].x;
                    var dy = nodes[a].y - nodes[b].y;
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 1) dist = 1;
                    var force = repulsion / (dist * dist);
                    var fx = (dx / dist) * force;
                    var fy = (dy / dist) * force;
                    nodes[a].vx += fx;
                    nodes[a].vy += fy;
                    nodes[b].vx -= fx;
                    nodes[b].vy -= fy;
                }
            }

            // Attraction along edges
            for (var e = 0; e < edges.length; e++) {
                var edge = edges[e];
                var edx = edge.to.x - edge.from.x;
                var edy = edge.to.y - edge.from.y;
                var edist = Math.sqrt(edx * edx + edy * edy);
                if (edist < 1) edist = 1;
                var eforce = edist * attraction * (edge.strength / 5);
                var efx = (edx / edist) * eforce;
                var efy = (edy / edist) * eforce;
                edge.from.vx += efx;
                edge.from.vy += efy;
                edge.to.vx -= efx;
                edge.to.vy -= efy;
            }

            // Centering force
            for (var n = 0; n < nodes.length; n++) {
                nodes[n].vx += (W / 2 - nodes[n].x) * centering;
                nodes[n].vy += (H / 2 - nodes[n].y) * centering;
            }

            // Apply velocities with damping and speed limit
            for (var m = 0; m < nodes.length; m++) {
                var speed = Math.sqrt(nodes[m].vx * nodes[m].vx + nodes[m].vy * nodes[m].vy);
                if (speed > maxSpeed) {
                    nodes[m].vx = (nodes[m].vx / speed) * maxSpeed;
                    nodes[m].vy = (nodes[m].vy / speed) * maxSpeed;
                }
                nodes[m].x += nodes[m].vx;
                nodes[m].y += nodes[m].vy;
                nodes[m].vx *= damping;
                nodes[m].vy *= damping;

                // Bounds
                var margin = 40;
                nodes[m].x = Math.max(margin, Math.min(W - margin, nodes[m].x));
                nodes[m].y = Math.max(margin, Math.min(H - margin, nodes[m].y));
            }
        }

        // Draw edges
        for (var pe = 0; pe < edges.length; pe++) {
            var pedge = edges[pe];
            ctx.beginPath();
            ctx.moveTo(pedge.from.x, pedge.from.y);
            ctx.lineTo(pedge.to.x, pedge.to.y);
            ctx.strokeStyle = pedge.color;
            ctx.lineWidth = Math.max(1, (pedge.strength || 1) * 0.5);
            ctx.globalAlpha = 0.6;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Draw nodes
        var nodeRadius = 18;
        for (var pn = 0; pn < nodes.length; pn++) {
            var node = nodes[pn];

            // Glow
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeRadius + 4, 0, Math.PI * 2);
            ctx.fillStyle = node.color + '30';
            ctx.fill();

            // Circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
            ctx.fillStyle = node.color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Name label
            ctx.fillStyle = '#f5f5f7';
            ctx.font = 'bold 11px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            var label = node.name.length > 4 ? node.name.substring(0, 4) + '...' : node.name;
            ctx.fillText(label, node.x, node.y);

            // Name below
            ctx.fillStyle = '#98989d';
            ctx.font = '9px -apple-system, sans-serif';
            ctx.fillText(node.name, node.x, node.y + nodeRadius + 12);
        }

        // Legend
        var legendX = 10;
        var legendY = H - 20;
        ctx.textAlign = 'left';
        ctx.font = '9px -apple-system, sans-serif';
        var typeKeys = Object.keys(_relationColors);
        for (var l = 0; l < typeKeys.length; l++) {
            var lx = legendX + l * 52;
            ctx.fillStyle = _relationColors[typeKeys[l]];
            ctx.fillRect(lx, legendY - 4, 8, 8);
            ctx.fillStyle = '#8e8e93';
            ctx.fillText(typeKeys[l], lx + 11, legendY + 2);
        }
    }

    function _charColor(id) {
        var colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
        var hash = 0;
        for (var i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
        return colors[Math.abs(hash) % colors.length];
    }

    // ===== Public API =====
    return {
        show: show,
        hide: hide,
        _switchTab: _switchTab,
        _addRelation: _addRelation,
        _deleteRelation: _deleteRelation,
        _addForeshadowing: _addForeshadowing,
        _editForeshadowing: _editForeshadowing,
        _saveForeshadowing: _saveForeshadowing,
        _cancelEditForeshadowing: _cancelEditForeshadowing,
        _deleteForeshadowing: _deleteForeshadowing,
        _addPlotLine: _addPlotLine,
        _deletePlotLine: _deletePlotLine
    };
})();
