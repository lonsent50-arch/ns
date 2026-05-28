/* Novel Studio — AI Configuration Page */
var AIConfig = (function() {
    'use strict';

    var DEFAULT_SYSTEM_PROMPT = '你是一位专业的网文作家助手，擅长根据用户提供的大纲和设定进行创作。' +
        '你的文笔流畅自然，擅长描写人物心理和场景氛围，对话生动有力。' +
        '请根据用户的需求进行创作，保持风格一致。';

    var DEFAULT_CONFIG = {
        provider: 'deepseek',
        api_key: '',
        base_url: 'https://api.deepseek.com',
        model: 'deepseek-chat',
        temperature: 0.8,
        top_p: 0.9,
        max_tokens: 4096,
        system_prompt: DEFAULT_SYSTEM_PROMPT,
        scenes: {
            'continue':      { model: '', temperature: '', max_tokens: '' },
            'polish':        { model: '', temperature: '', max_tokens: '' },
            'write_chapter': { model: '', temperature: '', max_tokens: '' },
            'expand':        { model: '', temperature: '', max_tokens: '' },
            'cover':         { model: '', temperature: '', max_tokens: '' },
            'blurb':         { model: '', temperature: '', max_tokens: '' }
        }
    };

    var SCENE_LABELS = {
        'continue':      '续写',
        'polish':        '润色',
        'write_chapter': '写本章',
        'expand':        '扩写',
        'cover':         '封面',
        'blurb':         '简介'
    };

    var PROVIDERS = [
        { value: 'openai',    label: 'OpenAI',      defaultUrl: 'https://api.openai.com/v1',       defaultModel: 'gpt-4o' },
        { value: 'anthropic', label: 'Anthropic',   defaultUrl: 'https://api.anthropic.com',        defaultModel: 'claude-sonnet-4-20250514' },
        { value: 'deepseek',  label: 'DeepSeek',    defaultUrl: 'https://api.deepseek.com',         defaultModel: 'deepseek-chat' },
        { value: 'zhipu',     label: '智谱 (GLM)',  defaultUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4' },
        { value: 'qwen',      label: '通义千问',    defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-max' },
        { value: 'moonshot',  label: 'Moonshot',    defaultUrl: 'https://api.moonshot.cn/v1',       defaultModel: 'moonshot-v1-8k' },
        { value: 'custom',    label: '自定义',      defaultUrl: '',                                 defaultModel: '' }
    ];

    var _config = null;
    var _debounceTimer = null;
    var _testResultTimer = null;

    // ==================== Deep Clone ====================
    function _deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // ==================== Load Config ====================
    function _loadConfig(callback) {
        NS.apiGet('/api/user/config').then(function(data) {
            _config = _deepClone(DEFAULT_CONFIG);
            if (data && typeof data === 'object') {
                _mergeConfig(_config, data);
            }
            if (callback) callback(null, _config);
        }).catch(function() {
            // Fallback to localStorage
            try {
                var stored = localStorage.getItem('ns_ai_config');
                if (stored) {
                    var parsed = JSON.parse(stored);
                    _config = _deepClone(DEFAULT_CONFIG);
                    if (parsed && typeof parsed === 'object') {
                        _mergeConfig(_config, parsed);
                    }
                } else {
                    _config = _deepClone(DEFAULT_CONFIG);
                }
            } catch (e) {
                _config = _deepClone(DEFAULT_CONFIG);
            }
            if (callback) callback(null, _config);
        });
    }

    function _mergeConfig(target, source) {
        for (var key in source) {
            if (!source.hasOwnProperty(key)) continue;
            if (key === 'scenes' && typeof source[key] === 'object') {
                for (var sceneKey in source[key]) {
                    if (source[key].hasOwnProperty(sceneKey) && target[key][sceneKey]) {
                        var srcScene = source[key][sceneKey];
                        if (typeof srcScene === 'object') {
                            if (srcScene.model !== undefined) target[key][sceneKey].model = srcScene.model;
                            if (srcScene.temperature !== undefined) target[key][sceneKey].temperature = srcScene.temperature;
                            if (srcScene.max_tokens !== undefined) target[key][sceneKey].max_tokens = srcScene.max_tokens;
                        }
                    }
                }
            } else {
                target[key] = source[key];
            }
        }
    }

    // ==================== Build HTML ====================
    function _buildHTML() {
        var h = '';

        // Page header
        h += '<div class="ac-header">';
        h += '<h1 class="ac-title">AI 配置</h1>';
        h += '<p class="ac-subtitle">管理模型连接、参数预设和场景配置</p>';
        h += '</div>';

        // Scrollable content area
        h += '<div class="ac-scroll">';

        // ── Section: Model Provider & Connection ──
        h += '<section class="ac-section">';
        h += '<h2 class="ac-section-title">模型服务商与连接</h2>';

        // Provider select
        h += '<div class="ac-field">';
        h += '<label class="ac-label">服务商</label>';
        h += '<select class="ac-select" id="ac-provider">';
        for (var i = 0; i < PROVIDERS.length; i++) {
            h += '<option value="' + escHtml(PROVIDERS[i].value) + '">' + escHtml(PROVIDERS[i].label) + '</option>';
        }
        h += '</select>';
        h += '</div>';

        // API Key
        h += '<div class="ac-field">';
        h += '<label class="ac-label">API Key</label>';
        h += '<div class="ac-input-row">';
        h += '<input type="password" class="ac-input ac-input-flex" id="ac-api-key" placeholder="sk-..." autocomplete="off">';
        h += '<button type="button" class="ac-btn-icon" id="ac-toggle-key" title="显示/隐藏">';
        h += '<span id="ac-toggle-icon">&#x1F441;</span>';
        h += '</button>';
        h += '</div>';
        h += '</div>';

        // Base URL
        h += '<div class="ac-field">';
        h += '<label class="ac-label">Base URL</label>';
        h += '<input type="text" class="ac-input" id="ac-base-url" placeholder="https://api.example.com">';
        h += '</div>';

        // Model
        h += '<div class="ac-field">';
        h += '<label class="ac-label">模型名称</label>';
        h += '<input type="text" class="ac-input" id="ac-model" placeholder="gpt-4o">';
        h += '</div>';

        // Test Connection button
        h += '<div class="ac-field">';
        h += '<button type="button" class="ac-btn ac-btn-test" id="ac-test-btn">测试连接</button>';
        h += '<span class="ac-test-result" id="ac-test-result"></span>';
        h += '</div>';

        h += '</section>';

        // ── Section: Model Parameters ──
        h += '<section class="ac-section">';
        h += '<h2 class="ac-section-title">模型参数</h2>';

        // Temperature
        h += '<div class="ac-field">';
        h += '<div class="ac-slider-label">';
        h += '<label class="ac-label">Temperature</label>';
        h += '<span class="ac-slider-val" id="ac-temp-val">0.8</span>';
        h += '</div>';
        h += '<input type="range" class="ac-range" id="ac-temperature" min="0" max="2" step="0.1" value="0.8">';
        h += '</div>';

        // Top P
        h += '<div class="ac-field">';
        h += '<div class="ac-slider-label">';
        h += '<label class="ac-label">Top P</label>';
        h += '<span class="ac-slider-val" id="ac-top-p-val">0.9</span>';
        h += '</div>';
        h += '<input type="range" class="ac-range" id="ac-top-p" min="0" max="1" step="0.05" value="0.9">';
        h += '</div>';

        // Max Tokens
        h += '<div class="ac-field">';
        h += '<div class="ac-slider-label">';
        h += '<label class="ac-label">Max Tokens</label>';
        h += '<span class="ac-slider-val" id="ac-max-tokens-val">4096</span>';
        h += '</div>';
        h += '<input type="range" class="ac-range" id="ac-max-tokens" min="512" max="32768" step="512" value="4096">';
        h += '</div>';

        h += '</section>';

        // ── Section: System Prompt ──
        h += '<section class="ac-section">';
        h += '<h2 class="ac-section-title">System Prompt</h2>';
        h += '<div class="ac-field">';
        h += '<textarea class="ac-textarea" id="ac-system-prompt" rows="5" placeholder="输入自定义 System Prompt..."></textarea>';
        h += '</div>';
        h += '<div class="ac-field">';
        h += '<button type="button" class="ac-btn ac-btn-secondary" id="ac-restore-prompt">恢复默认</button>';
        h += '</div>';
        h += '</section>';

        // ── Section: Per-Scene Configuration ──
        h += '<section class="ac-section">';
        h += '<h2 class="ac-section-title">场景配置覆盖</h2>';
        h += '<p class="ac-desc">留空则使用上方全局设置</p>';

        h += '<div class="ac-table-wrap">';
        h += '<table class="ac-table">';
        h += '<thead><tr>';
        h += '<th class="ac-th-scene">场景</th>';
        h += '<th>模型覆盖</th>';
        h += '<th>Temperature</th>';
        h += '<th>Max Tokens</th>';
        h += '</tr></thead>';
        h += '<tbody>';

        var sceneKeys = ['continue', 'polish', 'write_chapter', 'expand', 'cover', 'blurb'];
        for (var j = 0; j < sceneKeys.length; j++) {
            var key = sceneKeys[j];
            h += '<tr>';
            h += '<td class="ac-td-scene">' + escHtml(SCENE_LABELS[key]) + '</td>';
            h += '<td><input type="text" class="ac-input ac-input-sm" id="ac-scene-model-' + key + '" placeholder="默认"></td>';
            h += '<td><input type="number" class="ac-input ac-input-sm ac-input-num" id="ac-scene-temp-' + key + '" placeholder="默认" min="0" max="2" step="0.1"></td>';
            h += '<td><input type="number" class="ac-input ac-input-sm ac-input-num" id="ac-scene-tokens-' + key + '" placeholder="默认" min="512" max="32768" step="1"></td>';
            h += '</tr>';
        }

        h += '</tbody></table>';
        h += '</div>';
        h += '</section>';

        // ── Section: Usage Statistics ──
        h += '<section class="ac-section">';
        h += '<h2 class="ac-section-title">用量统计</h2>';
        h += '<div class="ac-stats-grid" id="ac-stats">';
        h += '<div class="ac-stat-card"><span class="ac-stat-num" id="ac-stat-today">--</span><span class="ac-stat-label">今日调用</span></div>';
        h += '<div class="ac-stat-card"><span class="ac-stat-num" id="ac-stat-month">--</span><span class="ac-stat-label">本月调用</span></div>';
        h += '<div class="ac-stat-card"><span class="ac-stat-num" id="ac-stat-tokens">--</span><span class="ac-stat-label">预估 Tokens</span></div>';
        h += '</div>';
        h += '</section>';

        h += '</div>'; // .ac-scroll

        // ── Bottom save bar ──
        h += '<div class="ac-bottom-bar">';
        h += '<button type="button" class="ac-btn ac-btn-primary" id="ac-save-btn">保存配置</button>';
        h += '</div>';

        return h;
    }

    // ==================== Populate Form ====================
    function _populateForm() {
        if (!_config) return;

        // Provider
        var providerEl = document.getElementById('ac-provider');
        if (providerEl) providerEl.value = _config.provider || DEFAULT_CONFIG.provider;

        // API Key
        var keyEl = document.getElementById('ac-api-key');
        if (keyEl) keyEl.value = _config.api_key || '';

        // Base URL
        var urlEl = document.getElementById('ac-base-url');
        if (urlEl) urlEl.value = _config.base_url || '';

        // Model
        var modelEl = document.getElementById('ac-model');
        if (modelEl) modelEl.value = _config.model || '';

        // Temperature
        var tempEl = document.getElementById('ac-temperature');
        if (tempEl) tempEl.value = _config.temperature != null ? _config.temperature : DEFAULT_CONFIG.temperature;
        _updateSliderDisplay('ac-temperature', 'ac-temp-val', true);

        // Top P
        var topPEl = document.getElementById('ac-top-p');
        if (topPEl) topPEl.value = _config.top_p != null ? _config.top_p : DEFAULT_CONFIG.top_p;
        _updateSliderDisplay('ac-top-p', 'ac-top-p-val', true);

        // Max Tokens
        var tokensEl = document.getElementById('ac-max-tokens');
        if (tokensEl) tokensEl.value = _config.max_tokens != null ? _config.max_tokens : DEFAULT_CONFIG.max_tokens;
        _updateSliderDisplay('ac-max-tokens', 'ac-max-tokens-val', true);

        // System Prompt
        var promptEl = document.getElementById('ac-system-prompt');
        if (promptEl) promptEl.value = _config.system_prompt || DEFAULT_SYSTEM_PROMPT;

        // Scenes
        if (_config.scenes) {
            var sceneKeys = ['continue', 'polish', 'write_chapter', 'expand', 'cover', 'blurb'];
            for (var i = 0; i < sceneKeys.length; i++) {
                var key = sceneKeys[i];
                var sceneCfg = _config.scenes[key];
                if (!sceneCfg) continue;

                var mEl = document.getElementById('ac-scene-model-' + key);
                var tEl = document.getElementById('ac-scene-temp-' + key);
                var tkEl = document.getElementById('ac-scene-tokens-' + key);
                if (mEl) mEl.value = sceneCfg.model || '';
                if (tEl) tEl.value = sceneCfg.temperature || '';
                if (tkEl) tkEl.value = sceneCfg.max_tokens || '';
            }
        }

        _updateStats();
    }

    function _updateSliderDisplay(sliderId, valId, isFloat) {
        var slider = document.getElementById(sliderId);
        var display = document.getElementById(valId);
        if (!slider || !display) return;
        var v = parseFloat(slider.value);
        display.textContent = isFloat ? v.toFixed(1) : String(Math.round(v));
    }

    // ==================== Gather Config from Form ====================
    function _gatherConfig() {
        var cfg = _deepClone(DEFAULT_CONFIG);

        cfg.provider = _getVal('#ac-provider') || DEFAULT_CONFIG.provider;
        cfg.api_key = _getVal('#ac-api-key') || '';
        cfg.base_url = _getVal('#ac-base-url') || '';
        cfg.model = _getVal('#ac-model') || '';

        var tempStr = _getVal('#ac-temperature');
        cfg.temperature = tempStr ? parseFloat(tempStr) : DEFAULT_CONFIG.temperature;

        var topPStr = _getVal('#ac-top-p');
        cfg.top_p = topPStr ? parseFloat(topPStr) : DEFAULT_CONFIG.top_p;

        var tokensStr = _getVal('#ac-max-tokens');
        cfg.max_tokens = tokensStr ? parseInt(tokensStr, 10) : DEFAULT_CONFIG.max_tokens;

        cfg.system_prompt = _getVal('#ac-system-prompt') || DEFAULT_SYSTEM_PROMPT;

        var sceneKeys = ['continue', 'polish', 'write_chapter', 'expand', 'cover', 'blurb'];
        for (var i = 0; i < sceneKeys.length; i++) {
            var key = sceneKeys[i];
            cfg.scenes[key] = {
                model: _getVal('#ac-scene-model-' + key) || '',
                temperature: _getVal('#ac-scene-temp-' + key) || '',
                max_tokens: _getVal('#ac-scene-tokens-' + key) || ''
            };
        }

        // Preserve stats from in-memory config if present
        if (_config && _config._stats) {
            cfg._stats = _config._stats;
        }

        return cfg;
    }

    function _getVal(selector) {
        var el = document.querySelector(selector);
        return el ? el.value : '';
    }

    // ==================== Save ====================
    function save() {
        var cfg = _gatherConfig();
        _config = cfg;

        // Save to localStorage first (fast, always works)
        try {
            localStorage.setItem('ns_ai_config', JSON.stringify(cfg));
        } catch (e) {
            // quota exceeded or other issue — not critical
        }

        // Save to API
        NS.apiPut('/api/user/config', cfg).then(function() {
            NS.toast('配置已保存', 'success');
        }).catch(function(e) {
            NS.toast('云端保存失败，已保存到本地: ' + e.message, 'warning');
        });
    }

    function _autoSave() {
        if (_debounceTimer) clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(function() {
            save();
        }, 2000);
    }

    // ==================== Provider Change Handler ====================
    function _onProviderChange() {
        var providerEl = document.getElementById('ac-provider');
        if (!providerEl) return;
        var val = providerEl.value;
        for (var i = 0; i < PROVIDERS.length; i++) {
            if (PROVIDERS[i].value === val) {
                var urlEl = document.getElementById('ac-base-url');
                var modelEl = document.getElementById('ac-model');
                if (urlEl && PROVIDERS[i].defaultUrl) urlEl.value = PROVIDERS[i].defaultUrl;
                if (modelEl && PROVIDERS[i].defaultModel) modelEl.value = PROVIDERS[i].defaultModel;
                break;
            }
        }
        _autoSave();
    }

    // ==================== Test Connection ====================
    function testConnection() {
        var provider = _getVal('#ac-provider');
        var apiKey = _getVal('#ac-api-key');
        var baseUrl = _getVal('#ac-base-url');
        var model = _getVal('#ac-model');

        if (!apiKey) {
            _showTestResult(false, '请先输入 API Key');
            return;
        }

        var btn = document.getElementById('ac-test-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '测试中...';
        }
        _showTestResult(null, '正在测试连接...');

        NS.apiPost('/api/ai/test', {
            provider: provider,
            api_key: apiKey,
            base_url: baseUrl,
            model: model
        }).then(function(res) {
            if (res && res.success) {
                _showTestResult(true, res.message || '连接成功');
            } else {
                _showTestResult(false, (res && res.message) || '连接失败');
            }
            if (btn) {
                btn.disabled = false;
                btn.textContent = '测试连接';
            }
        }).catch(function(e) {
            _showTestResult(false, '测试失败: ' + e.message);
            if (btn) {
                btn.disabled = false;
                btn.textContent = '测试连接';
            }
        });
    }

    function _showTestResult(success, message) {
        var el = document.getElementById('ac-test-result');
        if (!el) return;
        if (success === true) {
            el.innerHTML = '<span class="ac-test-ok">&#10004; ' + escHtml(message) + '</span>';
        } else if (success === false) {
            el.innerHTML = '<span class="ac-test-fail">&#10008; ' + escHtml(message) + '</span>';
        } else {
            el.textContent = message || '';
        }
        if (_testResultTimer) clearTimeout(_testResultTimer);
        if (success !== null && success !== undefined) {
            _testResultTimer = setTimeout(function() {
                var r = document.getElementById('ac-test-result');
                if (r) r.innerHTML = '';
            }, 8000);
        }
    }

    // ==================== Usage Statistics ====================
    function _loadStats() {
        // Try API first
        NS.apiGet('/api/user/usage').then(function(data) {
            if (data && typeof data === 'object') {
                _updateStatsDisplay(data);
                if (_config) _config._stats = data;
            } else {
                _loadLocalStats();
            }
        }).catch(function() {
            _loadLocalStats();
        });
    }

    function _loadLocalStats() {
        try {
            var stored = localStorage.getItem('ns_usage_stats');
            if (stored) {
                var data = JSON.parse(stored);
                _updateStatsDisplay(data);
            }
        } catch (e) {
            // ignore
        }
    }

    function _updateStats() {
        if (_config && _config._stats) {
            _updateStatsDisplay(_config._stats);
        } else {
            _loadStats();
        }
    }

    function _updateStatsDisplay(data) {
        var todayEl = document.getElementById('ac-stat-today');
        var monthEl = document.getElementById('ac-stat-month');
        var tokensEl = document.getElementById('ac-stat-tokens');
        if (todayEl) todayEl.textContent = data.today_calls != null ? String(data.today_calls) : '--';
        if (monthEl) monthEl.textContent = data.month_calls != null ? String(data.month_calls) : '--';
        if (tokensEl) tokensEl.textContent = data.estimated_tokens != null ? _formatNumber(data.estimated_tokens) : '--';
    }

    function _formatNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n);
    }

    // ==================== Event Binding ====================
    function _bindEvents() {
        // Provider change
        var providerEl = document.getElementById('ac-provider');
        if (providerEl) {
            providerEl.addEventListener('change', _onProviderChange);
        }

        // API Key toggle
        var toggleBtn = document.getElementById('ac-toggle-key');
        var keyInput = document.getElementById('ac-api-key');
        var toggleIcon = document.getElementById('ac-toggle-icon');
        if (toggleBtn && keyInput && toggleIcon) {
            toggleBtn.addEventListener('click', function() {
                if (keyInput.type === 'password') {
                    keyInput.type = 'text';
                    toggleIcon.innerHTML = '&#x1F576;'; // hide icon
                } else {
                    keyInput.type = 'password';
                    toggleIcon.innerHTML = '&#x1F441;'; // show icon
                }
            });
        }

        // Test connection
        var testBtn = document.getElementById('ac-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', testConnection);
        }

        // Sliders with live value display
        _bindSlider('ac-temperature', 'ac-temp-val', true);
        _bindSlider('ac-top-p', 'ac-top-p-val', true);
        _bindSlider('ac-max-tokens', 'ac-max-tokens-val', false);

        // Restore default system prompt
        var restoreBtn = document.getElementById('ac-restore-prompt');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', function() {
                var promptEl = document.getElementById('ac-system-prompt');
                if (promptEl) {
                    promptEl.value = DEFAULT_SYSTEM_PROMPT;
                    _autoSave();
                }
            });
        }

        // Save button
        var saveBtn = document.getElementById('ac-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                save();
            });
        }

        // Auto-save: bind to all input, select, textarea changes via delegation on config container
        var container = document.getElementById('config-container');
        if (container) {
            container.addEventListener('change', function(e) {
                var tag = e.target.tagName.toLowerCase();
                var id = e.target.id || '';
                // Skip test button
                if (id === 'ac-test-btn') return;
                if (tag === 'input' || tag === 'select' || tag === 'textarea') {
                    _autoSave();
                }
            });
            container.addEventListener('input', function(e) {
                var tag = e.target.tagName.toLowerCase();
                var id = e.target.id || '';
                if (id === 'ac-test-btn') return;
                if (tag === 'input' || tag === 'textarea') {
                    _autoSave();
                }
            });
        }
    }

    function _bindSlider(sliderId, valId, isFloat) {
        var slider = document.getElementById(sliderId);
        if (!slider) return;
        slider.addEventListener('input', function() {
            _updateSliderDisplay(sliderId, valId, isFloat);
        });
    }

    // ==================== Render ====================
    function render() {
        var container = document.getElementById('config-container');
        if (!container) return;

        container.innerHTML = _buildHTML();
        _bindEvents();

        // Load config and populate
        _loadConfig(function() {
            _populateForm();
        });
    }

    // ==================== Public API ====================
    return {
        render: render,
        save: save,
        testConnection: testConnection
    };
})();
