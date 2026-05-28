// Novel Studio — Publish module: Canvas cover generation + AI blurb + export
var Publish = (function() {
    'use strict';

    var _projectId = null;
    var _project = null;
    var _coverConfig = {
        title: '',
        author: '',
        style: '玄幻金紫',
        colorScheme: 'warm',
        fontSize: 42
    };
    var _blurb = '';

    var STYLES = ['玄幻金紫', '都市蓝灰', '科幻青蓝', '古风水墨', '轻小说粉白', '暗黑红黑'];
    var COLOR_SCHEMES = ['warm', 'cool', 'golden', 'dark'];
    var BLURB_STYLES = ['热血', '悬念', '温情', '史诗'];
    var BLURB_LENGTHS = [100, 200, 300];

    // ===== Public API =====

    function open(projectId) {
        _projectId = projectId;
        _project = null;
        _blurb = '';
        _coverConfig = {
            title: '',
            author: '',
            style: '玄幻金紫',
            colorScheme: 'warm',
            fontSize: 42
        };

        NS.apiGet('/api/projects/' + projectId + '/info').then(function(info) {
            _project = info;
            _coverConfig.title = info.title || '';
            _coverConfig.author = info.author || '';
            _render();
        }).catch(function(e) {
            console.warn('Publish: 加载项目信息失败', e.message);
            _project = {};
            _render();
        });
    }

    // ===== Render =====

    function _render() {
        var container = document.getElementById('publish-container');
        if (!container) return;

        var title = escHtml(_coverConfig.title || '未命名作品');
        var author = escHtml(_coverConfig.author || '佚名');

        var styleOpts = '';
        for (var i = 0; i < STYLES.length; i++) {
            var sel = STYLES[i] === _coverConfig.style ? ' selected' : '';
            styleOpts += '<option value="' + STYLES[i] + '"' + sel + '>' + STYLES[i] + '</option>';
        }

        var schemeOpts = '';
        for (var j = 0; j < COLOR_SCHEMES.length; j++) {
            var s = COLOR_SCHEMES[j];
            var sel2 = s === _coverConfig.colorScheme ? ' selected' : '';
            var label = s === 'warm' ? '暖色' : (s === 'cool' ? '冷色' : (s === 'golden' ? '金色' : '暗色'));
            schemeOpts += '<option value="' + s + '"' + sel2 + '>' + label + '</option>';
        }

        var blurbStyleOpts = '';
        for (var k = 0; k < BLURB_STYLES.length; k++) {
            var bs = BLURB_STYLES[k];
            blurbStyleOpts += '<option value="' + bs + '">' + bs + '</option>';
        }

        var blurbLenOpts = '';
        for (var m = 0; m < BLURB_LENGTHS.length; m++) {
            var bl = BLURB_LENGTHS[m];
            blurbLenOpts += '<option value="' + bl + '">' + bl + '字</option>';
        }

        var html = '' +
        '<div class="pub-layout">' +
        // --- Left column: Cover Preview ---
        '<div class="pub-left">' +
            '<div class="pub-cover-wrap">' +
                '<canvas id="pub-cover-canvas" width="600" height="800" class="pub-cover-canvas"></canvas>' +
            '</div>' +
            '<button class="btn btn-accent pub-download-btn" onclick="Publish._downloadCover()">下载封面 PNG</button>' +
        '</div>' +

        // --- Right column: Controls ---
        '<div class="pub-right">' +
            // Section 1: Cover Configuration
            '<div class="pub-section">' +
                '<div class="pub-section-title">封面配置</div>' +
                '<div class="pub-form-group">' +
                    '<label class="pub-label">书名</label>' +
                    '<input type="text" class="pub-input" id="pub-cover-title" value="' + title + '" placeholder="输入书名">' +
                '</div>' +
                '<div class="pub-form-group">' +
                    '<label class="pub-label">作者</label>' +
                    '<input type="text" class="pub-input" id="pub-cover-author" value="' + author + '" placeholder="输入作者名">' +
                '</div>' +
                '<div class="pub-form-row">' +
                    '<div class="pub-form-group pub-form-half">' +
                        '<label class="pub-label">风格模板</label>' +
                        '<select class="pub-select" id="pub-cover-style">' + styleOpts + '</select>' +
                    '</div>' +
                    '<div class="pub-form-group pub-form-half">' +
                        '<label class="pub-label">色调</label>' +
                        '<select class="pub-select" id="pub-cover-scheme">' + schemeOpts + '</select>' +
                    '</div>' +
                '</div>' +
                '<div class="pub-form-group">' +
                    '<label class="pub-label">标题字号: <span id="pub-fontsize-val">' + _coverConfig.fontSize + '</span>px</label>' +
                    '<input type="range" class="pub-range" id="pub-cover-fontsize" min="24" max="72" value="' + _coverConfig.fontSize + '">' +
                '</div>' +
                '<button class="btn btn-secondary pub-random-btn" onclick="Publish._randomizeCover()">随机生成</button>' +
            '</div>' +

            // Section 2: Synopsis/Blurb
            '<div class="pub-section">' +
                '<div class="pub-section-title">AI 简介生成</div>' +
                '<div class="pub-form-row">' +
                    '<div class="pub-form-group pub-form-half">' +
                        '<label class="pub-label">风格</label>' +
                        '<select class="pub-select" id="pub-blurb-style">' + blurbStyleOpts + '</select>' +
                    '</div>' +
                    '<div class="pub-form-group pub-form-half">' +
                        '<label class="pub-label">字数</label>' +
                        '<select class="pub-select" id="pub-blurb-length">' + blurbLenOpts + '</select>' +
                    '</div>' +
                '</div>' +
                '<button class="btn btn-accent pub-gen-btn" onclick="Publish._generateBlurb()">AI 生成简介</button>' +
                '<textarea class="pub-textarea" id="pub-blurb-text" placeholder="AI 生成的简介将显示在这里...">' + escHtml(_blurb) + '</textarea>' +
                '<button class="btn btn-secondary pub-regen-btn" onclick="Publish._generateBlurb()" style="margin-top:8px;">重新生成</button>' +
            '</div>' +

            // Section 3: Export
            '<div class="pub-section">' +
                '<div class="pub-section-title">导出作品</div>' +
                '<div class="pub-export-btns">' +
                    '<button class="btn btn-accent pub-export-btn" onclick="Publish._exportBook(\'txt\')">导出 TXT</button>' +
                    '<button class="btn btn-accent pub-export-btn" onclick="Publish._exportBook(\'html\')">导出 HTML</button>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '</div>';

        container.innerHTML = html;

        // Bind events
        _bindEvents();

        // Draw cover after DOM update
        setTimeout(function() { _drawCover(); }, 50);
    }

    function _bindEvents() {
        var titleInput = document.getElementById('pub-cover-title');
        var authorInput = document.getElementById('pub-cover-author');
        var styleSelect = document.getElementById('pub-cover-style');
        var schemeSelect = document.getElementById('pub-cover-scheme');
        var fontSizeSlider = document.getElementById('pub-cover-fontsize');

        if (titleInput) {
            titleInput.addEventListener('input', function() {
                _coverConfig.title = this.value;
                _drawCover();
            });
        }
        if (authorInput) {
            authorInput.addEventListener('input', function() {
                _coverConfig.author = this.value;
                _drawCover();
            });
        }
        if (styleSelect) {
            styleSelect.addEventListener('change', function() {
                _coverConfig.style = this.value;
                _drawCover();
            });
        }
        if (schemeSelect) {
            schemeSelect.addEventListener('change', function() {
                _coverConfig.colorScheme = this.value;
                _drawCover();
            });
        }
        if (fontSizeSlider) {
            fontSizeSlider.addEventListener('input', function() {
                _coverConfig.fontSize = parseInt(this.value, 10);
                var valEl = document.getElementById('pub-fontsize-val');
                if (valEl) valEl.textContent = _coverConfig.fontSize;
                _drawCover();
            });
        }
    }

    // ===== Cover Drawing (Canvas API) =====

    function _drawCover() {
        var canvas = document.getElementById('pub-cover-canvas');
        if (!canvas) return;

        var ctx = canvas.getContext('2d');
        var w = canvas.width;   // 600
        var h = canvas.height;  // 800
        var cfg = _coverConfig;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Draw template
        switch (cfg.style) {
            case '玄幻金紫': _drawTemplateXuanHuan(ctx, w, h, cfg); break;
            case '都市蓝灰': _drawTemplateDuShi(ctx, w, h, cfg); break;
            case '科幻青蓝': _drawTemplateKeHuan(ctx, w, h, cfg); break;
            case '古风水墨': _drawTemplateGuFeng(ctx, w, h, cfg); break;
            case '轻小说粉白': _drawTemplateQingXiaoShuo(ctx, w, h, cfg); break;
            case '暗黑红黑': _drawTemplateAnHei(ctx, w, h, cfg); break;
            default: _drawTemplateXuanHuan(ctx, w, h, cfg); break;
        }

        // Common: draw border
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
    }

    // --- Template: 玄幻金紫 ---
    function _drawTemplateXuanHuan(ctx, w, h, cfg) {
        // Background gradient: #1a0a2e → #4a1a6b → #2d0a4e
        var bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        bgGrad.addColorStop(0, '#1a0a2e');
        bgGrad.addColorStop(0.5, '#4a1a6b');
        bgGrad.addColorStop(1, '#2d0a4e');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Gold accent lines — diagonal decorative bands
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = '#d4a843';
        ctx.lineWidth = 2;
        for (var i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.moveTo(-100 + i * 60, 0);
            ctx.lineTo(w + 100, h + i * 60);
            ctx.stroke();
        }
        ctx.restore();

        // Glowing orb at center-top
        var cx = w / 2, cy = 260;
        var orbGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 120);
        orbGrad.addColorStop(0, 'rgba(255,215,0,0.18)');
        orbGrad.addColorStop(0.5, 'rgba(255,180,0,0.06)');
        orbGrad.addColorStop(1, 'rgba(255,180,0,0)');
        ctx.fillStyle = orbGrad;
        ctx.fillRect(cx - 200, cy - 200, 400, 400);

        // Small decorative diamonds
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = '#d4a843';
        ctx.lineWidth = 1;
        _drawDiamond(ctx, cx - 100, 150, 8);
        _drawDiamond(ctx, cx + 100, 150, 8);
        _drawDiamond(ctx, cx, 140, 6);
        ctx.restore();

        // Horizontal accent lines
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#d4a843';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(60, 340);
        ctx.lineTo(w - 60, 340);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(60, 344);
        ctx.lineTo(w - 60, 344);
        ctx.stroke();
        ctx.restore();

        // Title — centered
        _drawTitle(ctx, w, h, cfg, 'center', 360);

        // Author
        _drawAuthor(ctx, w, h, cfg);
    }

    // --- Template: 都市蓝灰 ---
    function _drawTemplateDuShi(ctx, w, h, cfg) {
        // Background gradient: #1a1a2e → #2d3a4a → #1a1a2e
        var bgGrad = ctx.createLinearGradient(0, 0, w, h);
        bgGrad.addColorStop(0, '#1a1a2e');
        bgGrad.addColorStop(0.5, '#2d3a4a');
        bgGrad.addColorStop(1, '#1a1a2e');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // City silhouette — simple geometric buildings
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#a0b4c8';
        var buildings = [
            {x: 20, y: 550, w: 80, h: 250},
            {x: 110, y: 480, w: 60, h: 320},
            {x: 180, y: 510, w: 90, h: 290},
            {x: 280, y: 440, w: 50, h: 360},
            {x: 340, y: 520, w: 70, h: 280},
            {x: 420, y: 460, w: 55, h: 340},
            {x: 490, y: 530, w: 90, h: 270}
        ];
        for (var i = 0; i < buildings.length; i++) {
            var b = buildings[i];
            ctx.fillRect(b.x, b.y, b.w, b.h);
            // Window dots
            ctx.fillStyle = 'rgba(255,255,200,0.04)';
            for (var row = b.y + 15; row < b.y + b.h - 15; row += 20) {
                for (var col = b.x + 10; col < b.x + b.w - 10; col += 15) {
                    if (Math.random() > 0.35) {
                        ctx.fillRect(col, row, 4, 6);
                    }
                }
            }
            ctx.fillStyle = 'rgba(160,180,200,0.08)';
        }
        ctx.restore();

        // Ground line
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = '#a0b4c8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h - 100);
        ctx.lineTo(w, h - 100);
        ctx.stroke();
        ctx.restore();

        // Thin vertical accent lines
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.strokeStyle = '#a0b4c8';
        ctx.lineWidth = 1;
        for (var j = 0; j < 8; j++) {
            ctx.beginPath();
            ctx.moveTo(80 + j * 70, 0);
            ctx.lineTo(80 + j * 70 + 15, h);
            ctx.stroke();
        }
        ctx.restore();

        // Title — left-aligned
        _drawTitle(ctx, w, h, cfg, 'left', 200);

        // Author
        _drawAuthor(ctx, w, h, cfg);
    }

    // --- Template: 科幻青蓝 ---
    function _drawTemplateKeHuan(ctx, w, h, cfg) {
        // Background gradient: #0a1a2e → #1a4a6b
        var bgGrad = ctx.createLinearGradient(0, 0, w, h);
        bgGrad.addColorStop(0, '#0a1a2e');
        bgGrad.addColorStop(1, '#1a4a6b');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Circuit-line decorations
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.5;

        // Horizontal circuit traces
        var traces = [
            {y: 120, x1: 60, x2: 250},
            {y: 130, x1: 280, x2: 450},
            {y: 140, x1: 80, x2: 220},
            {y: 150, x1: 350, x2: 520},
            {y: 160, x1: 100, x2: 300},
            {y: 620, x1: 80, x2: 300},
            {y: 630, x1: 350, x2: 540},
            {y: 640, x1: 50, x2: 250},
            {y: 650, x1: 300, x2: 500},
            // Vertical traces
            {x: 80, y1: 120, y2: 160},
            {x: 250, y1: 120, y2: 160},
            {x: 350, y1: 150, y2: 160},
            {x: 100, y1: 620, y2: 650},
            {x: 300, y1: 620, y2: 650},
            {x: 500, y1: 630, y2: 650}
        ];
        for (var i = 0; i < traces.length; i++) {
            var t = traces[i];
            ctx.beginPath();
            if (t.y !== undefined) {
                ctx.moveTo(t.x1, t.y);
                ctx.lineTo(t.x2, t.y);
            } else {
                ctx.moveTo(t.x, t.y1);
                ctx.lineTo(t.x, t.y2);
            }
            ctx.stroke();
        }

        // Circuit dots (nodes)
        var nodes = [
            {x: 80, y: 120}, {x: 250, y: 120}, {x: 280, y: 130}, {x: 450, y: 130},
            {x: 80, y: 140}, {x: 220, y: 140}, {x: 350, y: 150}, {x: 520, y: 150},
            {x: 80, y: 620}, {x: 300, y: 620}, {x: 100, y: 640}, {x: 500, y: 630}
        ];
        ctx.fillStyle = '#22d3ee';
        for (var j = 0; j < nodes.length; j++) {
            ctx.beginPath();
            ctx.arc(nodes[j].x, nodes[j].y, 3, 0, Math.PI * 2);
            ctx.fill();
            // Outer ring
            ctx.beginPath();
            ctx.arc(nodes[j].x, nodes[j].y, 6, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();

        // Central glowing hexagon
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        var hx = w / 2, hy = 400, hr = 160;
        ctx.beginPath();
        for (var k = 0; k < 6; k++) {
            var angle = (Math.PI / 3) * k - Math.PI / 6;
            var px = hx + hr * Math.cos(angle);
            var py = hy + hr * Math.sin(angle);
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Title — centered
        _drawTitle(ctx, w, h, cfg, 'center', 370);

        // Author
        _drawAuthor(ctx, w, h, cfg);
    }

    // --- Template: 古风水墨 ---
    function _drawTemplateGuFeng(ctx, w, h, cfg) {
        // Background gradient: #f5f0e8 → #d5c8b0
        var bgGrad = ctx.createLinearGradient(0, 0, w, h);
        bgGrad.addColorStop(0, '#f5f0e8');
        bgGrad.addColorStop(1, '#d5c8b0');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Ink wash circles (faint)
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#2c1810';
        ctx.beginPath();
        ctx.arc(w * 0.7, 340, 200, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(w * 0.3, 550, 140, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(w * 0.6, 180, 100, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Ink splatter dots
        ctx.save();
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = '#2c1810';
        var dots = [
            {x: 80, y: 200, r: 4}, {x: 500, y: 160, r: 6}, {x: 450, y: 600, r: 5},
            {x: 120, y: 520, r: 7}, {x: 350, y: 250, r: 3}, {x: 520, y: 400, r: 4},
            {x: 90, y: 380, r: 5}, {x: 380, y: 700, r: 6}, {x: 200, y: 650, r: 4}
        ];
        for (var i = 0; i < dots.length; i++) {
            ctx.beginPath();
            ctx.arc(dots[i].x, dots[i].y, dots[i].r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Vertical brush-stroke accent lines
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.strokeStyle = '#2c1810';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(80, 70);
        ctx.lineTo(80, 240);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(520, 70);
        ctx.lineTo(520, 240);
        ctx.stroke();
        ctx.restore();

        // Horizontal seal-like accent
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.strokeStyle = '#8b2500';
        ctx.lineWidth = 1;
        ctx.strokeRect(60, 580, w - 120, 1);
        ctx.strokeRect(60, 584, w - 120, 0.5);
        ctx.restore();

        // Title — vertical (right side)
        _drawTitleVertical(ctx, w, h, cfg);

        // Author
        _drawAuthor(ctx, w, h, cfg);
    }

    function _drawTitleVertical(ctx, w, h, cfg) {
        var title = cfg.title || '未命名';
        var fontSize = cfg.fontSize;
        var chars = title.split('');
        var maxChars = Math.min(chars.length, 8);

        ctx.save();
        ctx.fillStyle = '#2c1810';
        ctx.font = 'bold ' + fontSize + 'px "STKaiti", "KaiTi", "Noto Serif SC", "SimSun", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        var startX = w - 100;
        var startY = (h - maxChars * (fontSize + 14)) / 2;

        for (var i = 0; i < maxChars; i++) {
            ctx.fillText(chars[i], startX, startY + i * (fontSize + 14));
        }
        ctx.restore();
    }

    // --- Template: 轻小说粉白 ---
    function _drawTemplateQingXiaoShuo(ctx, w, h, cfg) {
        // Background gradient: #fff0f5 → #ffe4e1
        var bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        bgGrad.addColorStop(0, '#fff0f5');
        bgGrad.addColorStop(0.5, '#ffe4e1');
        bgGrad.addColorStop(1, '#fff0f5');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Cherry blossom petals (simple ellipse shapes)
        ctx.save();
        ctx.globalAlpha = 0.15;
        var petals = [
            {x: 80, y: 120}, {x: 150, y: 200}, {x: 480, y: 150}, {x: 520, y: 100},
            {x: 100, y: 650}, {x: 200, y: 720}, {x: 450, y: 680}, {x: 500, y: 740},
            {x: 60, y: 400}, {x: 540, y: 350}, {x: 120, y: 280}, {x: 470, y: 260},
            {x: 300, y: 100}, {x: 320, y: 700}
        ];
        ctx.fillStyle = '#ffb7c5';
        for (var i = 0; i < petals.length; i++) {
            var p = petals[i];
            var angle = (i * 37 + 15) * Math.PI / 180;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.ellipse(0, 0, 8, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            // Second petal crossing
            ctx.beginPath();
            ctx.ellipse(0, 0, 5, 10, Math.PI / 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();

        // Soft decorative circles
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.strokeStyle = '#e8a0b4';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 220, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 180, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Thin horizontal bars
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = '#e8a0b4';
        ctx.fillRect(120, 310, w - 240, 2);
        ctx.fillRect(160, 316, w - 320, 1);
        ctx.fillRect(120, 490, w - 240, 2);
        ctx.fillRect(160, 496, w - 320, 1);
        ctx.restore();

        // Title — centered
        _drawTitle(ctx, w, h, cfg, 'center', 360);

        // Author
        _drawAuthor(ctx, w, h, cfg);
    }

    // --- Template: 暗黑红黑 ---
    function _drawTemplateAnHei(ctx, w, h, cfg) {
        // Background gradient: #0a0a0a → #2a0a0a
        var bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        bgGrad.addColorStop(0, '#0a0a0a');
        bgGrad.addColorStop(0.5, '#2a0a0a');
        bgGrad.addColorStop(1, '#0a0a0a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Blood-red accent lines
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#8b0000';
        ctx.lineWidth = 2;
        // Angled slash lines
        for (var i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(0, 200 + i * 120);
            ctx.lineTo(w, 100 + i * 120);
            ctx.stroke();
        }
        ctx.restore();

        // Central dark radial glow
        var cx = w / 2, cy = h / 2;
        var glowGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, 400);
        glowGrad.addColorStop(0, 'rgba(139,0,0,0.08)');
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, w, h);

        // Thorny arc decorations
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.strokeStyle = '#8b0000';
        ctx.lineWidth = 1.5;
        // Top arc
        ctx.beginPath();
        ctx.arc(cx, 280, 160, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        // Bottom arc
        ctx.beginPath();
        ctx.arc(cx, 520, 160, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
        // Small "thorns"
        ctx.fillStyle = '#8b0000';
        var thornAngles = [1.15, 1.35, 1.55, 1.75, 1.9, 0.15, 0.35, 0.55, 0.75, 0.9];
        for (var j = 0; j < thornAngles.length; j++) {
            var ta = thornAngles[j];
            var tcx = j < 5 ? cx : cx;
            var tcy = j < 5 ? 280 : 520;
            var tx = tcx + 160 * Math.cos(ta * Math.PI);
            var ty = tcy + 160 * Math.sin(ta * Math.PI);
            ctx.beginPath();
            ctx.arc(tx, ty, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Horizontal accent bars
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#8b0000';
        ctx.fillRect(80, 340, w - 160, 1);
        ctx.fillRect(100, 344, w - 200, 0.5);
        ctx.restore();

        // Title — centered
        _drawTitle(ctx, w, h, cfg, 'center', 370);

        // Author
        _drawAuthor(ctx, w, h, cfg);
    }

    // ===== Shared drawing helpers =====

    function _drawTitle(ctx, w, h, cfg, align, yPos) {
        var title = cfg.title || '未命名';
        var fontSize = cfg.fontSize;

        ctx.save();
        ctx.textBaseline = 'middle';

        var isDark = (cfg.style === '古风水墨' || cfg.style === '轻小说粉白');
        ctx.fillStyle = isDark ? '#2c1810' : '#f5f5f7';
        ctx.font = 'bold ' + fontSize + 'px "PingFang SC", "Noto Serif SC", "STSong", serif';

        if (align === 'left') {
            ctx.textAlign = 'left';
            // Wrap text if needed
            var maxWidth = w - 120;
            var lines = _wrapText(ctx, title, maxWidth);
            var lineHeight = fontSize * 1.4;
            var totalH = lines.length * lineHeight;
            var startY = yPos - totalH / 2 + lineHeight / 2;
            for (var i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], 80, startY + i * lineHeight);
            }
        } else {
            ctx.textAlign = 'center';
            var maxWidth2 = w - 120;
            var lines2 = _wrapText(ctx, title, maxWidth2);
            var lineHeight2 = fontSize * 1.4;
            var totalH2 = lines2.length * lineHeight2;
            var startY2 = yPos - totalH2 / 2 + lineHeight2 / 2;
            for (var j = 0; j < lines2.length; j++) {
                ctx.fillText(lines2[j], w / 2, startY2 + j * lineHeight2);
            }
        }
        ctx.restore();
    }

    function _drawAuthor(ctx, w, h, cfg) {
        var author = cfg.author || '佚名';
        var isDark = (cfg.style === '古风水墨' || cfg.style === '轻小说粉白');
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isDark ? 'rgba(44,24,16,0.6)' : 'rgba(255,255,255,0.5)';
        ctx.font = '18px "PingFang SC", "Noto Sans SC", sans-serif';
        ctx.fillText(author, w / 2, h - 80);
        ctx.restore();
    }

    function _wrapText(ctx, text, maxWidth) {
        var words = text.split('');
        var lines = [];
        var currentLine = '';
        for (var i = 0; i < words.length; i++) {
            var testLine = currentLine + words[i];
            var metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = words[i];
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine.length > 0) lines.push(currentLine);
        return lines;
    }

    function _drawDiamond(ctx, x, y, size) {
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size, y);
        ctx.closePath();
        ctx.stroke();
    }

    // ===== Randomize Cover =====

    function _randomizeCover() {
        var randomStyle = STYLES[Math.floor(Math.random() * STYLES.length)];
        var randomScheme = COLOR_SCHEMES[Math.floor(Math.random() * COLOR_SCHEMES.length)];

        _coverConfig.style = randomStyle;
        _coverConfig.colorScheme = randomScheme;

        // Update UI
        var styleSelect = document.getElementById('pub-cover-style');
        var schemeSelect = document.getElementById('pub-cover-scheme');
        if (styleSelect) styleSelect.value = randomStyle;
        if (schemeSelect) schemeSelect.value = randomScheme;

        _drawCover();
    }

    // ===== Download Cover =====

    function _downloadCover() {
        var canvas = document.getElementById('pub-cover-canvas');
        if (!canvas) return;

        try {
            var link = document.createElement('a');
            link.download = (_coverConfig.title || 'cover') + '_cover.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            NS.toast('封面已下载', 'success');
        } catch (e) {
            NS.toast('下载失败: ' + e.message, 'error');
        }
    }

    // ===== AI Blurb Generation =====

    function _generateBlurb() {
        var blurbStyle = document.getElementById('pub-blurb-style');
        var blurbLength = document.getElementById('pub-blurb-length');
        var textarea = document.getElementById('pub-blurb-text');

        var style = blurbStyle ? blurbStyle.value : '热血';
        var length = blurbLength ? parseInt(blurbLength.value, 10) : 100;

        if (!_projectId) {
            NS.toast('请先打开项目', 'error');
            return;
        }

        var btn = document.querySelector('.pub-gen-btn');
        var origText = btn ? btn.textContent : '';
        if (btn) {
            btn.disabled = true;
            btn.textContent = '生成中...';
        }

        NS.apiPost('/api/projects/' + _projectId + '/ai/generate', {
            action: 'blurb',
            params: {
                style: style,
                length: length,
                title: _coverConfig.title || ''
            }
        }).then(function(result) {
            _blurb = result.blurb || result.content || result.text || '';
            if (textarea) textarea.value = _blurb;
            if (btn) { btn.disabled = false; btn.textContent = origText; }
            if (_blurb) {
                NS.toast('简介已生成', 'success');
            } else {
                NS.toast('AI 未返回内容', 'warning');
            }
        }).catch(function(e) {
            console.warn('Publish: AI 生成简介失败', e.message);
            // Fallback: generate a simple template blurb
            _blurb = '《' + (_coverConfig.title || '未命名作品') + '》是一部' + style + '风格的小说。\n\n故事围绕主人公的成长历程展开，在一系列扣人心弦的事件中，展现了一个宏大而细腻的世界观。作品融合了深刻的主题思考与精彩的情节设计，为读者呈现一场难忘的阅读体验。';
            if (textarea) textarea.value = _blurb;
            if (btn) { btn.disabled = false; btn.textContent = origText; }
            NS.toast('AI 服务不可用，已生成模板简介', 'warning');
        });
    }

    // ===== Export =====

    function _exportBook(fmt) {
        if (!_projectId) {
            NS.toast('请先打开项目', 'error');
            return;
        }

        var url = '/api/projects/' + _projectId + '/export/' + fmt;
        // Trigger file download via hidden iframe/link
        var link = document.createElement('a');
        link.href = url;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        NS.toast('导出 ' + fmt.toUpperCase() + ' 已开始', 'success');
    }

    // ===== Public API =====

    return {
        open: open,
        _randomizeCover: _randomizeCover,
        _downloadCover: _downloadCover,
        _generateBlurb: _generateBlurb,
        _exportBook: _exportBook,
        _drawCover: _drawCover
    };
})();
