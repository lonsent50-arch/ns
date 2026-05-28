var ImportWizard = (function() {
    'use strict';

    var _step = 1;
    var _fileText = '';
    var _parsedStructure = null; // {volumes: [{title, chapters: [{title, content}]}]}
    var _projects = [];
    var _selectedChapterIds = {}; // "v-i"-"c-j" -> true for merge selection
    var _fileName = '';
    var _fileSize = 0;

    // ===== Public API =====
    function show() { render(); }

    function render() {
        switch (_step) {
            case 1: _renderStep1(); break;
            case 2: _renderStep2(); break;
            case 3: _renderStep3(); break;
            default: _step = 1; _renderStep1();
        }
    }

    // ===== Step 1: File Upload =====
    function _renderStep1() {
        var container = document.getElementById('import-container');
        if (!container) return;

        container.innerHTML =
            '<div class="iw-card">' +
                '<div class="iw-step-bar">' +
                    _stepIndicatorHTML(1) +
                '</div>' +
                '<div class="iw-body">' +
                    '<h2 class="iw-title">导入作品文件</h2>' +
                    '<p class="iw-desc">支持 TXT、Markdown、Word (.docx) 格式，AI 将自动解析卷章结构</p>' +
                    '<div class="iw-drop-zone" id="iw-drop-zone">' +
                        '<div class="iw-drop-icon">📂</div>' +
                        '<div class="iw-drop-text">拖拽文件到此处 或 点击选择</div>' +
                        '<div class="iw-drop-hint">支持 .txt / .md / .docx</div>' +
                        '<input type="file" id="iw-file-input" accept=".txt,.md,.docx" style="display:none;">' +
                    '</div>' +
                    (_fileName ? '<div class="iw-file-info" id="iw-file-info">' +
                        '<span class="iw-file-icon">📄</span>' +
                        '<span class="iw-file-name">' + escHtml(_fileName) + '</span>' +
                        '<span class="iw-file-size">' + _formatSize(_fileSize) + '</span>' +
                        '<button class="iw-file-clear" id="iw-file-clear" title="移除文件">&times;</button>' +
                    '</div>' : '') +
                '</div>' +
                '<div class="iw-actions">' +
                    '<button class="iw-btn iw-btn-secondary" onclick="ImportWizard._goBack()" disabled>上一步</button>' +
                    '<button class="iw-btn iw-btn-primary" id="iw-btn-next-1" ' + (_fileText ? '' : 'disabled') + ' onclick="ImportWizard._goStep2()">下一步 &rarr;</button>' +
                '</div>' +
            '</div>';

        // Bind events
        var dropZone = document.getElementById('iw-drop-zone');
        var fileInput = document.getElementById('iw-file-input');
        if (dropZone && fileInput) {
            dropZone.addEventListener('click', function() { fileInput.click(); });
            dropZone.addEventListener('dragover', function(e) { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('iw-dragover'); });
            dropZone.addEventListener('dragleave', function(e) { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('iw-dragover'); });
            dropZone.addEventListener('drop', function(e) {
                e.preventDefault(); e.stopPropagation();
                dropZone.classList.remove('iw-dragover');
                var files = e.dataTransfer.files;
                if (files && files.length > 0) _handleFile(files[0]);
            });
            fileInput.addEventListener('change', function(e) {
                if (e.target.files && e.target.files.length > 0) _handleFile(e.target.files[0]);
            });
        }
        var clearBtn = document.getElementById('iw-file-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                _fileText = '';
                _fileName = '';
                _fileSize = 0;
                _parsedStructure = null;
                render();
            });
        }
    }

    function _handleFile(file) {
        if (!file) return;
        _fileName = file.name;
        _fileSize = file.size;

        var ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'docx') {
            NS.toast('DOCX 文件需要在服务器端解析，上传后将自动发送给后端处理', 'warning');
            // Still read as text but warn user
            _fileText = '[DOCX_BINARY]';
            _fileName = file.name;
            _fileSize = file.size;
            _renderStep1();
            return;
        }

        var reader = new FileReader();
        reader.onload = function(e) {
            _fileText = e.target.result || '';
            // Basic validation
            if (!_fileText || _fileText.trim().length === 0) {
                NS.toast('文件内容为空，请检查文件', 'error');
                _fileText = '';
                return;
            }
            _renderStep1();
        };
        reader.onerror = function() {
            NS.toast('文件读取失败，请重试', 'error');
            _fileText = '';
        };
        reader.readAsText(file);
    }

    function _goStep2() {
        if (!_fileText || _fileText.trim().length === 0) {
            NS.toast('请先选择文件', 'warning');
            return;
        }
        _step = 2;
        _selectedChapterIds = {};
        _parseStructure();
    }

    // Exposed for inline onclick
    window.ImportWizard = window.ImportWizard || {};
    ImportWizard._goStep2 = _goStep2;
    ImportWizard._goBack = _goBack;
    ImportWizard._goStep3 = _goStep3;

    // ===== Step 2: Parse & Preview =====
    function _parseStructure() {
        _renderStep2Loading();
        NS.apiPost('/api/ai/parse-structure', { text: _fileText })
            .then(function(res) {
                if (res && res.success && res.volumes) {
                    _parsedStructure = res;
                    _renderStep2();
                } else {
                    NS.toast('解析失败：' + ((res && res.error) || '返回数据异常'), 'error');
                    _renderStep2(); // render with error state
                }
            })
            .catch(function(e) {
                NS.toast('解析请求失败：' + e.message, 'error');
                _renderStep2();
            });
    }

    function _renderStep2Loading() {
        var container = document.getElementById('import-container');
        if (!container) return;
        container.innerHTML =
            '<div class="iw-card">' +
                '<div class="iw-step-bar">' +
                    _stepIndicatorHTML(2) +
                '</div>' +
                '<div class="iw-body iw-body-loading">' +
                    '<div class="iw-spinner"></div>' +
                    '<p class="iw-loading-text">AI 正在解析文件结构...</p>' +
                    '<p class="iw-loading-sub">识别卷、章划分，提取标题，这可能需要几秒钟</p>' +
                '</div>' +
            '</div>';
    }

    function _renderStep2() {
        var container = document.getElementById('import-container');
        if (!container) return;

        var volumes = _parsedStructure ? (_parsedStructure.volumes || []) : [];
        var totalChapters = 0;
        for (var i = 0; i < volumes.length; i++) {
            totalChapters += volumes[i].chapters ? volumes[i].chapters.length : 0;
        }

        var treeHTML = _renderStructureTree(volumes);

        container.innerHTML =
            '<div class="iw-card">' +
                '<div class="iw-step-bar">' +
                    _stepIndicatorHTML(2) +
                '</div>' +
                '<div class="iw-body">' +
                    '<div class="iw-step2-header">' +
                        '<h2 class="iw-title">预览 & 调整结构</h2>' +
                        '<p class="iw-desc">共 ' + volumes.length + ' 卷，' + totalChapters + ' 章。可编辑标题、删除、合并或拆分章节</p>' +
                        '<button class="iw-btn iw-btn-outline iw-reparse-btn" onclick="ImportWizard._reparse()">🔄 重新解析</button>' +
                    '</div>' +
                    '<div class="iw-tree" id="iw-structure-tree">' + treeHTML + '</div>' +
                    '<div class="iw-merge-bar" id="iw-merge-bar" style="display:none;">' +
                        '<span class="iw-merge-count" id="iw-merge-count">已选 0 章</span>' +
                        '<button class="iw-btn iw-btn-outline" onclick="ImportWizard._mergeChapters()">合并选中章节</button>' +
                        '<button class="iw-btn iw-btn-ghost" onclick="ImportWizard._clearSelection()">取消选择</button>' +
                    '</div>' +
                '</div>' +
                '<div class="iw-actions">' +
                    '<button class="iw-btn iw-btn-secondary" onclick="ImportWizard._goBack()">&larr; 上一步</button>' +
                    '<button class="iw-btn iw-btn-primary" ' + (volumes.length === 0 ? 'disabled' : '') + ' onclick="ImportWizard._goStep3()">下一步 &rarr;</button>' +
                '</div>' +
            '</div>';

        // Bind inline edit events
        _bindStructureEvents(volumes);
        _updateMergeBar();
    }

    function _renderStructureTree(volumes) {
        if (!volumes || volumes.length === 0) {
            return '<div class="iw-tree-empty">解析未返回有效结构。请<a href="javascript:ImportWizard._reparse()" style="color:var(--accent);">重新解析</a>。</div>';
        }
        var html = '';
        for (var i = 0; i < volumes.length; i++) {
            var vol = volumes[i];
            var chs = vol.chapters || [];
            html += '<div class="iw-vol-node">' +
                '<div class="iw-vol-header">' +
                    '<span class="iw-vol-icon">📖</span>' +
                    '<span class="iw-vol-title">' + escHtml(vol.title || ('第' + (i + 1) + '卷')) + '</span>' +
                    '<span class="iw-vol-count">' + chs.length + ' 章</span>' +
                '</div>' +
                '<div class="iw-ch-list">';
            for (var j = 0; j < chs.length; j++) {
                var ch = chs[j];
                var key = 'v' + i + '-c' + j;
                var isSelected = _selectedChapterIds[key];
                html += '<div class="iw-ch-row ' + (isSelected ? 'iw-ch-selected' : '') + '">' +
                    '<span class="iw-ch-drag" title="拖拽排序">&equiv;</span>' +
                    '<label class="iw-ch-check">' +
                        '<input type="checkbox" class="iw-ch-checkbox" data-key="' + key + '" ' + (isSelected ? 'checked' : '') + '>' +
                    '</label>' +
                    '<input type="text" class="iw-ch-title" data-vol="' + i + '" data-ch="' + j + '" value="' + escHtml(ch.title || '') + '" placeholder="章节标题">' +
                    '<button class="iw-ch-split" data-vol="' + i + '" data-ch="' + j + '" title="拆分为两章">✂</button>' +
                    '<button class="iw-ch-remove" data-vol="' + i + '" data-ch="' + j + '" title="删除此章">&times;</button>' +
                '</div>';
            }
            html += '</div></div>';
        }
        return html;
    }

    function _bindStructureEvents(volumes) {
        // Checkbox change events
        var checkboxes = document.querySelectorAll('.iw-ch-checkbox');
        for (var k = 0; k < checkboxes.length; k++) {
            checkboxes[k].addEventListener('change', function() {
                var key = this.getAttribute('data-key');
                if (this.checked) {
                    _selectedChapterIds[key] = true;
                } else {
                    delete _selectedChapterIds[key];
                }
                _updateMergeBar();
                // Update row highlight
                var row = this.closest('.iw-ch-row');
                if (row) row.classList.toggle('iw-ch-selected', this.checked);
            });
        }

        // Title input change events
        var titleInputs = document.querySelectorAll('.iw-ch-title');
        for (var t = 0; t < titleInputs.length; t++) {
            titleInputs[t].addEventListener('change', function() {
                var vi = parseInt(this.getAttribute('data-vol'));
                var ci = parseInt(this.getAttribute('data-ch'));
                if (volumes[vi] && volumes[vi].chapters && volumes[vi].chapters[ci]) {
                    volumes[vi].chapters[ci].title = this.value;
                }
            });
        }

        // Remove button events
        var removeBtns = document.querySelectorAll('.iw-ch-remove');
        for (var r = 0; r < removeBtns.length; r++) {
            removeBtns[r].addEventListener('click', function() {
                var vi = parseInt(this.getAttribute('data-vol'));
                var ci = parseInt(this.getAttribute('data-ch'));
                _removeChapter(vi, ci);
            });
        }

        // Split button events
        var splitBtns = document.querySelectorAll('.iw-ch-split');
        for (var s = 0; s < splitBtns.length; s++) {
            splitBtns[s].addEventListener('click', function() {
                var vi = parseInt(this.getAttribute('data-vol'));
                var ci = parseInt(this.getAttribute('data-ch'));
                _splitChapter(vi, ci);
            });
        }
    }

    function _removeChapter(volIdx, chIdx) {
        if (!_parsedStructure || !_parsedStructure.volumes) return;
        var vol = _parsedStructure.volumes[volIdx];
        if (!vol || !vol.chapters) return;
        var title = (vol.chapters[chIdx] && vol.chapters[chIdx].title) || '未命名';
        // Simple confirm
        if (!confirm('确定删除章节「' + title + '」？')) return;
        vol.chapters.splice(chIdx, 1);
        // If volume is empty, remove it
        if (vol.chapters.length === 0) {
            _parsedStructure.volumes.splice(volIdx, 1);
        }
        _selectedChapterIds = {};
        _renderStep2();
    }

    function _splitChapter(volIdx, chIdx) {
        if (!_parsedStructure || !_parsedStructure.volumes) return;
        var vol = _parsedStructure.volumes[volIdx];
        if (!vol || !vol.chapters) return;
        var ch = vol.chapters[chIdx];
        if (!ch) return;
        var content = ch.content || '';
        if (content.trim().length === 0) {
            NS.toast('该章节无内容，无法拆分', 'warning');
            return;
        }
        var splitPoint = prompt('请输入拆分关键词或段落开头（在该词之前拆分）：', '');
        if (!splitPoint || !splitPoint.trim()) return;

        var idx = content.indexOf(splitPoint.trim());
        if (idx < 0) {
            NS.toast('未找到拆分关键词「' + splitPoint.trim() + '」，请检查输入', 'error');
            return;
        }
        var part1 = content.substring(0, idx).trim();
        var part2 = content.substring(idx).trim();
        if (!part1 || !part2) {
            NS.toast('拆分后某一章内容太短，请尝试其他拆分位置', 'warning');
            return;
        }
        var title1 = ch.title || '章节';
        var title2 = title1 + '（续）';
        ch.content = part1;
        ch.title = title1;
        var newCh = { title: title2, content: part2 };
        vol.chapters.splice(chIdx + 1, 0, newCh);
        _selectedChapterIds = {};
        _renderStep2();
        NS.toast('已拆分为两章', 'success');
    }

    function _mergeChapters() {
        var keys = Object.keys(_selectedChapterIds);
        if (keys.length < 2) {
            NS.toast('请至少选择两个章节进行合并', 'warning');
            return;
        }
        // Parse keys to find chapters
        var chapters = [];
        var volMap = {}; // volIdx -> {vol, chapters: [{idx, ch, key}]}
        for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            var parts = key.match(/^v(\d+)-c(\d+)$/);
            if (!parts) continue;
            var vi = parseInt(parts[1]);
            var ci = parseInt(parts[2]);
            if (!_parsedStructure.volumes[vi]) continue;
            var vol = _parsedStructure.volumes[vi];
            if (!vol.chapters || !vol.chapters[ci]) continue;
            if (!volMap[vi]) volMap[vi] = { vol: vol, items: [] };
            volMap[vi].items.push({ idx: ci, ch: vol.chapters[ci], key: key });
        }

        // Only merge chapters within the same volume
        var volKeys = Object.keys(volMap);
        for (var vk = 0; vk < volKeys.length; vk++) {
            var entry = volMap[volKeys[vk]];
            if (entry.items.length < 2) continue;
            // Sort by index
            entry.items.sort(function(a, b) { return a.idx - b.idx; });
            var mergedTitle = entry.items[0].ch.title || '合并章节';
            var mergedContent = '';
            for (var m = 0; m < entry.items.length; m++) {
                if (m > 0) mergedContent += '\n\n---\n\n';
                mergedContent += (entry.items[m].ch.content || '');
            }
            // Replace first chapter with merged, remove others
            var firstIdx = entry.items[0].idx;
            entry.vol.chapters[firstIdx] = { title: mergedTitle, content: mergedContent };
            // Remove rest (in reverse order)
            var removeIndices = [];
            for (var r = 1; r < entry.items.length; r++) removeIndices.push(entry.items[r].idx);
            removeIndices.sort(function(a, b) { return b - a; });
            for (var ri = 0; ri < removeIndices.length; ri++) {
                entry.vol.chapters.splice(removeIndices[ri], 1);
            }
        }
        _selectedChapterIds = {};
        _renderStep2();
        NS.toast('章节合并完成', 'success');
    }

    function _clearSelection() {
        _selectedChapterIds = {};
        _updateMergeBar();
        var checkboxes = document.querySelectorAll('.iw-ch-checkbox');
        for (var c = 0; c < checkboxes.length; c++) checkboxes[c].checked = false;
        var rows = document.querySelectorAll('.iw-ch-row');
        for (var r = 0; r < rows.length; r++) rows[r].classList.remove('iw-ch-selected');
    }

    function _updateMergeBar() {
        var bar = document.getElementById('iw-merge-bar');
        var countEl = document.getElementById('iw-merge-count');
        if (!bar || !countEl) return;
        var count = Object.keys(_selectedChapterIds).length;
        if (count >= 2) {
            bar.style.display = 'flex';
            countEl.textContent = '已选 ' + count + ' 章';
        } else {
            bar.style.display = 'none';
        }
    }

    function _reparse() {
        if (!_fileText || _fileText.trim().length === 0) {
            NS.toast('没有可解析的文件内容', 'error');
            return;
        }
        _selectedChapterIds = {};
        _parseStructure();
    }
    ImportWizard._reparse = _reparse;
    ImportWizard._mergeChapters = _mergeChapters;
    ImportWizard._clearSelection = _clearSelection;

    // ===== Step 3: Import Config =====
    function _goStep3() {
        if (!_parsedStructure || !_parsedStructure.volumes || _parsedStructure.volumes.length === 0) {
            NS.toast('解析结构为空，请返回上一步检查', 'warning');
            return;
        }
        _step = 3;
        _loadAndRenderStep3();
    }

    function _loadAndRenderStep3() {
        // Load projects list for dropdown
        NS.apiGet('/api/projects').then(function(data) {
            _projects = data && data.projects ? data.projects : (data || []);
            _renderStep3();
        }).catch(function() {
            _projects = [];
            _renderStep3();
        });
    }

    function _renderStep3() {
        var container = document.getElementById('import-container');
        if (!container) return;

        var volumes = _parsedStructure ? (_parsedStructure.volumes || []) : [];
        var totalChapters = 0;
        for (var i = 0; i < volumes.length; i++) {
            totalChapters += volumes[i].chapters ? volumes[i].chapters.length : 0;
        }

        var projectOptions = '';
        for (var p = 0; p < _projects.length; p++) {
            projectOptions += '<option value="' + escHtml('' + (_projects[p].id || '')) + '">' + escHtml(_projects[p].title || _projects[p].name || '未命名') + '</option>';
        }

        container.innerHTML =
            '<div class="iw-card">' +
                '<div class="iw-step-bar">' +
                    _stepIndicatorHTML(3) +
                '</div>' +
                '<div class="iw-body">' +
                    '<h2 class="iw-title">开始导入</h2>' +
                    '<p class="iw-desc">确认导入设置，将解析好的结构导入到项目中</p>' +
                    '<div class="iw-form">' +
                        '<div class="iw-form-group">' +
                            '<label class="iw-label">书名 <span class="iw-required">*</span></label>' +
                            '<input type="text" class="iw-input" id="iw-book-name" placeholder="请输入书名（如未命名则自动生成）" value="' + escHtml(_fileName ? _fileName.replace(/\.[^.]+$/, '') : '') + '">' +
                        '</div>' +
                        '<div class="iw-form-group">' +
                            '<label class="iw-label">导入方式</label>' +
                            '<div class="iw-radio-group">' +
                                '<label class="iw-radio">' +
                                    '<input type="radio" name="iw-import-mode" value="new" checked onchange="ImportWizard._toggleImportMode()">' +
                                    '<span class="iw-radio-label">创建新项目</span>' +
                                '</label>' +
                                '<label class="iw-radio">' +
                                    '<input type="radio" name="iw-import-mode" value="existing" onchange="ImportWizard._toggleImportMode()">' +
                                    '<span class="iw-radio-label">追加到已有项目</span>' +
                                '</label>' +
                            '</div>' +
                        '</div>' +
                        '<div class="iw-form-group" id="iw-project-select-group" style="display:none;">' +
                            '<label class="iw-label">选择项目</label>' +
                            '<select class="iw-select" id="iw-project-select">' +
                                projectOptions +
                            '</select>' +
                            (_projects.length === 0 ? '<p class="iw-hint">暂无已有项目</p>' : '') +
                        '</div>' +
                        '<div class="iw-summary">' +
                            '<div class="iw-summary-icon">📊</div>' +
                            '<div class="iw-summary-text">共 <strong>' + volumes.length + '</strong> 卷，<strong>' + totalChapters + '</strong> 章 将被导入</div>' +
                        '</div>' +
                        '<div class="iw-progress" id="iw-import-progress" style="display:none;">' +
                            '<div class="iw-progress-bar">' +
                                '<div class="iw-progress-fill" id="iw-progress-fill" style="width:0%;"></div>' +
                            '</div>' +
                            '<div class="iw-progress-text" id="iw-progress-text">准备导入...</div>' +
                        '</div>' +
                        '<div class="iw-result" id="iw-import-result" style="display:none;"></div>' +
                    '</div>' +
                '</div>' +
                '<div class="iw-actions">' +
                    '<button class="iw-btn iw-btn-secondary" onclick="ImportWizard._goBackToStep2()">&larr; 上一步</button>' +
                    '<button class="iw-btn iw-btn-primary" id="iw-btn-import" onclick="ImportWizard._doImport()">开始导入</button>' +
                '</div>' +
            '</div>';
    }

    function _toggleImportMode() {
        var radios = document.getElementsByName('iw-import-mode');
        var selectGroup = document.getElementById('iw-project-select-group');
        if (!radios || !selectGroup) return;
        var mode = 'new';
        for (var i = 0; i < radios.length; i++) {
            if (radios[i].checked) mode = radios[i].value;
        }
        selectGroup.style.display = mode === 'existing' ? 'block' : 'none';
    }
    ImportWizard._toggleImportMode = _toggleImportMode;

    function _goBackToStep2() {
        _step = 2;
        _renderStep2();
    }
    ImportWizard._goBackToStep2 = _goBackToStep2;

    function _doImport() {
        var radios = document.getElementsByName('iw-import-mode');
        var mode = 'new';
        for (var i = 0; i < radios.length; i++) {
            if (radios[i].checked) mode = radios[i].value;
        }

        var bookName = (document.getElementById('iw-book-name') || {}).value || '';
        if (!bookName.trim() && mode === 'new') {
            bookName = _fileName ? _fileName.replace(/\.[^.]+$/, '') : '导入作品';
        }

        if (!bookName.trim() && mode === 'new') {
            NS.toast('请输入书名', 'warning');
            return;
        }

        var importBtn = document.getElementById('iw-btn-import');
        if (importBtn) { importBtn.disabled = true; importBtn.textContent = '导入中...'; }

        var progressEl = document.getElementById('iw-import-progress');
        var progressFill = document.getElementById('iw-progress-fill');
        var progressText = document.getElementById('iw-progress-text');
        if (progressEl) progressEl.style.display = 'block';

        _updateProgress(10, '正在准备导入...');

        if (mode === 'new') {
            _createProjectAndImport(bookName.trim(), progressFill, progressText, progressEl);
        } else {
            var selectEl = document.getElementById('iw-project-select');
            var projectId = selectEl ? selectEl.value : '';
            if (!projectId) {
                NS.toast('请选择一个项目', 'warning');
                if (importBtn) { importBtn.disabled = false; importBtn.textContent = '开始导入'; }
                if (progressEl) progressEl.style.display = 'none';
                return;
            }
            _importToExistingProject(projectId, progressFill, progressText, progressEl, importBtn);
        }
    }
    ImportWizard._doImport = _doImport;

    function _createProjectAndImport(bookName, progressFill, progressText, progressEl) {
        _updateProgress(20, '正在创建新项目...');
        NS.apiPost('/api/projects', { title: bookName })
            .then(function(res) {
                var projectId = res.id || res.project_id;
                if (!projectId) throw new Error('创建项目失败，未返回项目ID');
                _updateProgress(40, '项目已创建，开始导入章节...');
                _importChaptersToProject(projectId, progressFill, progressText, progressEl);
            })
            .catch(function(e) {
                NS.toast('创建项目失败：' + e.message, 'error');
                _resetImportButton();
                if (progressEl) progressEl.style.display = 'none';
            });
    }

    function _importToExistingProject(projectId, progressFill, progressText, progressEl, importBtn) {
        _updateProgress(30, '正在导入到已有项目...');
        _importChaptersToProject(projectId, progressFill, progressText, progressEl);
    }

    function _importChaptersToProject(projectId, progressFill, progressText, progressEl) {
        var volumes = _parsedStructure ? (_parsedStructure.volumes || []) : [];

        NS.apiPost('/api/projects/' + projectId + '/import', { volumes: volumes })
            .then(function(res) {
                _updateProgress(100, '导入完成！');
                var imported = res && res.imported ? res.imported : 0;
                _showImportResult(projectId, imported);
            })
            .catch(function(e) {
                NS.toast('导入失败：' + e.message, 'error');
                _resetImportButton();
                if (progressEl) progressEl.style.display = 'none';
            });
    }

    function _updateProgress(percent, text) {
        var fill = document.getElementById('iw-progress-fill');
        var txt = document.getElementById('iw-progress-text');
        if (fill) fill.style.width = percent + '%';
        if (txt) txt.textContent = text || (percent + '%');
    }

    function _showImportResult(projectId, importedCount) {
        var importBtn = document.getElementById('iw-btn-import');
        if (importBtn) { importBtn.style.display = 'none'; }

        var resultEl = document.getElementById('iw-import-result');
        if (!resultEl) return;

        resultEl.style.display = 'block';
        resultEl.innerHTML =
            '<div class="iw-result-icon">&#10003;</div>' +
            '<div class="iw-result-title">导入成功！</div>' +
            '<div class="iw-result-desc">成功导入 ' + importedCount + ' 个章节</div>' +
            '<button class="iw-btn iw-btn-primary iw-result-btn" onclick="NS.navigate(\'#workspace/' + projectId + '\')">前往工作台</button>';
    }

    function _resetImportButton() {
        var importBtn = document.getElementById('iw-btn-import');
        if (importBtn) { importBtn.disabled = false; importBtn.textContent = '开始导入'; }
    }

    // ===== Navigation =====
    function _goBack() {
        if (_step === 2) { _step = 1; render(); }
        else if (_step === 3) { _step = 2; _renderStep2(); }
        else { NS.navigate('#bookshelf'); }
    }

    // ===== Helper: Step Indicator HTML =====
    function _stepIndicatorHTML(active) {
        var steps = ['上传文件', '预览结构', '开始导入'];
        var html = '';
        for (var i = 0; i < steps.length; i++) {
            var cls = (i + 1) === active ? 'iw-step-active' : ((i + 1) < active ? 'iw-step-done' : '');
            html += '<div class="iw-step-item ' + cls + '">' +
                '<div class="iw-step-circle">' +
                    (i + 1 < active ? '&#10003;' : (i + 1)) +
                '</div>' +
                '<div class="iw-step-label">' + steps[i] + '</div>' +
            '</div>';
            if (i < steps.length - 1) {
                html += '<div class="iw-step-line ' + (i + 1 < active ? 'iw-step-line-done' : '') + '"></div>';
            }
        }
        return html;
    }

    // ===== Helper: File Size Formatting =====
    function _formatSize(bytes) {
        if (!bytes) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    return {
        show: show,
        render: render
    };
})();
