// Novel Studio — 数据飞轮：自动进化引擎
// 黑名单隐式学习 + 预测模型误差校准
var Evolution = (function() {
    var STORAGE_KEY_BLACKLIST = 'novel-studio-auto-blacklist';
    var STORAGE_KEY_BIAS = 'novel-studio-retention-bias';
    var STORAGE_KEY_DELETED = 'novel-studio-deleted-words';

    var _autoBlacklist = [];
    var _deletedWords = {};
    var _retentionBias = null;
    var _lastAiInsertTime = 0;

    // ── 初始化：从 localStorage 恢复状态 ──
    function _init() {
        try {
            var bl = localStorage.getItem(STORAGE_KEY_BLACKLIST);
            if (bl) _autoBlacklist = JSON.parse(bl);
        } catch(e) { _autoBlacklist = []; }

        try {
            var dw = localStorage.getItem(STORAGE_KEY_DELETED);
            if (dw) _deletedWords = JSON.parse(dw);
        } catch(e) { _deletedWords = {}; }

        try {
            var rb = localStorage.getItem(STORAGE_KEY_BIAS);
            if (rb) _retentionBias = JSON.parse(rb);
        } catch(e) { _retentionBias = null; }
    }

    function _saveBlacklist() {
        try { localStorage.setItem(STORAGE_KEY_BLACKLIST, JSON.stringify(_autoBlacklist)); } catch(e) {}
    }
    function _saveDeleted() {
        try { localStorage.setItem(STORAGE_KEY_DELETED, JSON.stringify(_deletedWords)); } catch(e) {}
    }
    function _saveBias() {
        try { localStorage.setItem(STORAGE_KEY_BIAS, JSON.stringify(_retentionBias)); } catch(e) {}
    }

    // ── Backspace/Delete 监听 ──
    function _getWordAtCursor() {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return '';
        var node = sel.anchorNode;
        if (!node || node.nodeType !== Node.TEXT_NODE) return '';
        var text = node.textContent || '';
        var offset = sel.anchorOffset;
        // 向后扫描找词起始
        var start = offset;
        while (start > 0 && /[一-鿿\w]/.test(text[start - 1])) start--;
        // 向前扫描找词结束
        var end = offset;
        while (end < text.length && /[一-鿿\w]/.test(text[end])) end++;
        return text.substring(start, end).trim();
    }

    function _onEditorKeydown(e) {
        if (e.key !== 'Backspace' && e.key !== 'Delete') return;
        if (!_lastAiInsertTime || (Date.now() - _lastAiInsertTime > 60000)) return;

        // 提取光标处的词（被删除/修改的词）
        var word = _getWordAtCursor();
        if (!word || word.length <= 2) return;

        // 递增删除计数
        _deletedWords[word] = (_deletedWords[word] || 0) + 1;
        _saveDeleted();

        // 达到阈值 → 自动加入黑名单
        if (_deletedWords[word] >= 3 && _autoBlacklist.indexOf(word) < 0) {
            _autoBlacklist.push(word);
            _saveBlacklist();
            _deletedWords[word] = 0;
            _saveDeleted();
            if (typeof showToast === 'function') {
                showToast("🧬 自动进化：'" + word + "' 已加入套话黑名单", 'info');
            }
        }
    }

    // ── 绑定编辑器键盘事件 ──
    function _bindEditor() {
        var editor = document.getElementById('editor-body');
        if (!editor) {
            // editor 可能尚未渲染，延迟重试
            setTimeout(_bindEditor, 500);
            return;
        }
        editor.addEventListener('keydown', _onEditorKeydown);
    }

    // ── 公共 API ──

    // AI 文本插入时调用
    function markAiInsert(text) {
        if (!text) return;
        _lastAiInsertTime = Date.now();
    }

    // 获取合并后的黑名单（静态 + 自动进化）
    function getMergedBlacklist() {
        if (_autoBlacklist.length === 0) {
            return (typeof DEAI_CLICHE_BANK_JS !== 'undefined') ? DEAI_CLICHE_BANK_JS : {};
        }
        var merged = {};
        if (typeof DEAI_CLICHE_BANK_JS !== 'undefined') {
            for (var k in DEAI_CLICHE_BANK_JS) {
                if (DEAI_CLICHE_BANK_JS.hasOwnProperty(k)) {
                    merged[k] = DEAI_CLICHE_BANK_JS[k];
                }
            }
        }
        merged._auto = { label: '🧬 自动进化', words: _autoBlacklist.slice() };
        return merged;
    }

    // ── 预测偏差校准 ──

    function calibrateBias(fromInputs) {
        // fromInputs: true = 从校准输入框读取，否则用传入的 {ch1,ch3,d7,d8}
        var real = {};
        if (fromInputs) {
            real.ch1 = parseFloat((document.getElementById('calib-ch1') || {}).value);
            real.ch3 = parseFloat((document.getElementById('calib-ch3') || {}).value);
            real.d7  = parseFloat((document.getElementById('calib-d7') || {}).value);
            real.d8  = parseFloat((document.getElementById('calib-d8') || {}).value);
        }

        // 读取当前预测值
        var pred = {
            ch1: parseFloat((document.getElementById('ret-ch1') || {}).textContent),
            ch3: parseFloat((document.getElementById('ret-ch3') || {}).textContent),
            d7:  parseFloat((document.getElementById('ret-d7') || {}).textContent),
            d8:  parseFloat((document.getElementById('ret-d8') || {}).textContent)
        };

        var bias = {};
        var hasValid = false;
        ['ch1', 'ch3', 'd7', 'd8'].forEach(function(k) {
            if (!isNaN(real[k]) && !isNaN(pred[k])) {
                bias[k] = Math.round((real[k] - pred[k]) * 100) / 100;
                hasValid = true;
            } else {
                bias[k] = _retentionBias ? (_retentionBias[k] || 0) : 0;
            }
        });

        if (hasValid) {
            _retentionBias = bias;
            _saveBias();
            if (typeof showToast === 'function') {
                var parts = [];
                if (!isNaN(real.ch1)) parts.push('ch1:' + (bias.ch1 >= 0 ? '+' : '') + bias.ch1);
                if (!isNaN(real.ch3)) parts.push('ch3:' + (bias.ch3 >= 0 ? '+' : '') + bias.ch3);
                showToast('📡 偏差系数已校准：' + parts.join(', '), 'success');
            }
            // 清空输入框
            if (fromInputs) {
                ['calib-ch1','calib-ch3','calib-d7','calib-d8'].forEach(function(id) {
                    var el = document.getElementById(id); if (el) el.value = '';
                });
            }
        } else {
            if (typeof showToast === 'function') {
                showToast('请至少输入一个有效的真实留存数据', 'info');
            }
        }

        return bias;
    }

    function getBias() {
        return _retentionBias;
    }

    // 对 AI 预测结果应用偏差修正
    function applyBias(data) {
        if (!_retentionBias || !data) return data;
        // clamp 到合理范围 [0, 100]
        function clamp(v) { return Math.max(0, Math.min(100, Math.round(v * 100) / 100)); }
        var adjusted = {
            ch1_read_rate:   clamp((data.ch1_read_rate || 0) + (_retentionBias.ch1 || 0)),
            ch3_retention:   clamp((data.ch3_retention || 0) + (_retentionBias.ch3 || 0)),
            d7_retention:    clamp((data.d7_retention || 0) + (_retentionBias.d7 || 0)),
            d8_read_rate:    clamp((data.d8_read_rate || 0) + (_retentionBias.d8 || 0)),
            platform:        data.platform,
            tip:             data.tip,
            bias_applied:    true
        };
        return adjusted;
    }

    // ── 初始化 ──
    _init();
    _bindEditor();

    // ── 暴露 API ──
    return {
        markAiInsert:       markAiInsert,
        getMergedBlacklist: getMergedBlacklist,
        calibrateBias:      calibrateBias,
        getBias:            getBias,
        applyBias:          applyBias,
        // 调试/测试
        _getAutoBlacklist:  function() { return _autoBlacklist.slice(); },
        _getDeletedWords:   function() { return Object.assign({}, _deletedWords); },
        _reset: function() {
            _autoBlacklist = []; _deletedWords = {}; _retentionBias = null; _lastAiInsertTime = 0;
            localStorage.removeItem(STORAGE_KEY_BLACKLIST);
            localStorage.removeItem(STORAGE_KEY_DELETED);
            localStorage.removeItem(STORAGE_KEY_BIAS);
        }
    };
})();
