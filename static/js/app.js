// Novel Studio v2 - 前端核心逻辑
const API_BASE = '';
let currentProjectId = null;
let currentChapterId = null;
let chapters = [];
let characters = [];
let outlineNodes = [];
window._aiMessages = { chat: [], continue: [], polish: [], deai: [], brainstorm: [] };
// ===== SaaS 会员阶梯功能鉴权 =====
let userTier = 'free';
function getUserTier() { return userTier; }
function isFeatureUnlockedTier() { return userTier !== 'free'; }
function normalizeUserTier(tierInfo) {
    if (!tierInfo) return 'free';
    var map = { free: 'free', basic: 'pro', pro: 'pro', premium: 'platinum' };
    return map[tierInfo.id] || 'free';
}
function getAiMessages(mode) { return window._aiMessages[mode] || []; }

// ===== 一键成书状态 =====
window._bookGenPlan = [];
window._bookGenIndex = 0;
window._bookGenTotal = 0;
window._bookGenRunning = false;

const PREMIUM_UPGRADE_HTML = '<div style="text-align:center;padding:40px 20px;"><div style="font-size:48px;margin-bottom:16px;">🔒</div><h3 style="color:var(--text-primary);margin-bottom:8px;">高级功能</h3><p style="color:var(--text-muted);font-size:13px;margin-bottom:16px;">此功能需要升级会员才能使用</p><button class="btn btn-primary" onclick="openSlideout(\'vip\')">💎 升级会员</button></div>';

// ===== 模型选择 =====
window._currentModel = 'deepseek';

function getCurrentModel() {
    return window._currentModel || 'deepseek';
}

// ===== 统一 AI Action 分发 =====
function aiAction(mode) {
    switch(mode) {
        case 'continue': continueWithDirection(); break;
        case 'polish': sendAiMessage('polish', 'ai-input-polish', 'ai-messages-polish'); break;
        case 'chat': aiChatSend(); break;
        case 'brainstorm': sendAiMessage('brainstorm', 'ai-input-brainstorm', 'ai-messages-brainstorm'); break;
        case 'genre': generateIdeas(); break;
        case 'guided': startGuidedWriting(); break;
        case 'review': runReview('full'); break;
        case 'deai': detectAiFlavor(); break;
        default: showToast('未知 AI 操作: '+mode, 'error');
    }
}

function onModelChange(model) {
    window._currentModel = model;
    // 同步所有 AI 面板的模型选择器
    document.querySelectorAll('.ai-model-select').forEach(sel => { sel.value = model; });
    const meta = window._modelMeta && window._modelMeta[model];
    const name = meta ? meta.name : model;
    showToast('已切换到 ' + name, 'info');
}

// ===== 设置 API =====
async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();

        // 存储模型元数据
        if (data.available_models) {
            window._modelMeta = {};
            const modelNames = { deepseek: 'DeepSeek', gemini: 'Gemini', claude: 'Claude' };
            data.available_models.forEach(m => {
                window._modelMeta[m.id] = {
                    name: m.name || modelNames[m.id] || m.id,
                    price: m.price || '',
                    badge: m.badge || '',
                    icon: m.icon || ''
                };
            });
        }

        // 填充可用模型到所有模型选择器
        populateModelSelectors(data.available_models || []);

        // 设置默认模型
        const defModel = data.default_model || 'deepseek';
        window._currentModel = defModel;
        document.querySelectorAll('.ai-model-select').forEach(sel => { sel.value = defModel; });

        // 更新套餐信息
        const pkgInfo = document.getElementById('settings-package-info');
        if (pkgInfo) {
            pkgInfo.innerHTML = `<strong>${data.tier_name || '免费版'}</strong><br><span style="font-size:12px;color:var(--text-muted);">${data.tier_desc || ''}</span>`;
        }
        const availableModels = document.getElementById('settings-available-models');
        if (availableModels && data.available_models) {
            availableModels.innerHTML = data.available_models.map(m =>
                `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
                    <span style="font-size:16px;">${m.icon || '🤖'}</span>
                    <div><div style="color:var(--text-primary);font-weight:550;">${m.name}</div>
                    <div style="font-size:11px;color:var(--text-muted);">${m.price} · ${m.badge}</div></div>
                </div>`
            ).join('');
        }

        // API Key 已迁移至环境变量配置
        const adminSection = document.getElementById('admin-key-section');
        if (adminSection && data.is_admin) {
            adminSection.style.display = 'block';
        }
    } catch (e) {
        console.error('加载设置失败:', e);
    }
}

function populateModelSelectors(models) {
    if (!models || models.length === 0) models = [{ id: 'deepseek', name: 'DeepSeek' }];
    const html = models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    document.querySelectorAll('.ai-model-select').forEach(sel => {
        const currentVal = sel.value;
        sel.innerHTML = html;
        if (models.find(m => m.id === currentVal)) {
            sel.value = currentVal;
        }
    });
    // 设置页默认模型选择器
    const defSel = document.getElementById('settings-default-model');
    if (defSel) {
        const cur = defSel.value;
        defSel.innerHTML = html;
        if (models.find(m => m.id === cur)) defSel.value = cur;
    }
}

async function saveSettings() {
    const btn = document.querySelector('#slideout-settings button.btn-primary');
    const msg = document.getElementById('settings-msg');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = '保存中...';

    const defModel = document.getElementById('settings-default-model').value;

    try {
        const res = await fetch('/api/settings', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ default_model: defModel })
        });
        const data = await res.json();
        if (data.success) {
            window._currentModel = defModel;
            document.querySelectorAll('.ai-model-select').forEach(sel => { sel.value = defModel; });
            msg.innerHTML = '<span style="color:#4caf50;">✅ 设置已保存</span>';
        } else {
            msg.innerHTML = '<span style="color:#f44336;">❌ ' + (data.error || '保存失败') + '</span>';
        }
    } catch (e) {
        msg.innerHTML = '<span style="color:#f44336;">❌ 保存失败: ' + e.message + '</span>';
    }
    btn.disabled = false;
    btn.textContent = '💾 保存设置';
}

async function saveAdminKeys() {
    const msg = document.getElementById('admin-keys-msg');
    if (msg) msg.innerHTML = '<span style="color:#f59e0b;">API Key 已迁移至 .env 环境变量配置，请编辑服务器 .env 文件后重启服务</span>';
}

function toggleKeyVisibility(id) {
    // API Key 已迁移至环境变量，此函数保留用于兼容性
}

// ===== 新手引导 =====
async function checkOnboarding() {
    try {
        const res = await fetch('/api/onboarding');
        const data = await res.json();
        if (!data.completed) {
            setTimeout(() => openModal('onboarding-modal'), 600);
        }
    } catch(e) { /* 引导检查失败不阻塞 */ }
}

function skipOnboarding() {
    closeModal();
    fetch('/api/onboarding', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ experience: '', genre: '' })
    });
}

function completeOnboarding() {
    const exp = document.getElementById('obo-exp').value;
    const genre = document.getElementById('obo-genre').value;
    document.getElementById('onboard-step-1').style.display = 'none';
    document.getElementById('onboard-step-2').style.display = 'block';
    fetch('/api/onboarding', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ experience: exp, genre: genre })
    });
}

function closeOnboarding() { closeModal(); }

async function generateInvite() {
    try {
        const res = await fetch('/api/invite/generate', { method:'POST' });
        const data = await res.json();
        if (data.error) { showToast(data.error, 'error'); return; }
        const fullUrl = window.location.origin + data.url;
        document.getElementById('invite-result').innerHTML =
            '你的推荐链接:<br><code style="color:var(--accent);cursor:pointer;font-size:11px;" onclick="navigator.clipboard.writeText(\''+fullUrl+'\');showToast(\'已复制!\',\'success\')" title="点击复制">'+fullUrl+'</code>'+
            '<br><span style="color:var(--text-muted);">推荐码: '+data.code+'</span>';
        navigator.clipboard.writeText(fullUrl).then(() => showToast('推荐链接已复制！发给你的写手朋友吧', 'success'));
        setTimeout(() => loadInviteStats(), 500);
    } catch(e) {
        showToast('生成失败，请先激活许可证', 'error');
    }
}

async function loadInviteStats() {
    const codeEl = document.getElementById('invite-result');
    const codeMatch = codeEl?.textContent.match(/NVS-[A-F0-9]+/);
    if (!codeMatch) { document.getElementById('invite-result').innerHTML += '<br><span style="color:#ff453a;">请先生成推荐链接</span>'; return; }
    try {
        const res = await fetch('/api/invite/'+codeMatch[0]+'/stats');
        const data = await res.json();
        if (data.error) return;
        const stats = document.getElementById('invite-stats');
        stats.style.display = 'block';
        stats.innerHTML = '📊 点击 '+data.clicks+' 次 | 注册 '+data.signups+' 人 | 已领奖励 '+data.rewards_claimed+' 次';
    } catch(e) {}
}

async function claimReferralReward() {
    const codeEl = document.getElementById('invite-result');
    const codeMatch = codeEl?.textContent.match(/NVS-[A-F0-9]+/);
    const inviteParam = new URLSearchParams(window.location.search).get('invite');
    const code = inviteParam || (codeMatch ? codeMatch[0] : '');

    if (!code) {
        showToast('请先生成推荐链接，或通过好友的推荐链接进入', 'error');
        return;
    }

    // 如果是自己的推荐码，提示不能自己推荐自己
    if (codeMatch && code === codeMatch[0]) {
        // 检查 URL 中是否有不同的 invite 参数
        if (!inviteParam) {
            showToast('这是你自己的推荐码，请分享给好友使用。如果你是通过好友链接进来的，会自动检测。', 'info');
            return;
        }
    }

    try {
        const res = await fetch('/api/invite/claim-reward', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ code: inviteParam || code })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            loadInviteStats();
        } else {
            showToast(data.error || '领取失败', 'error');
        }
    } catch(e) {
        showToast('领取失败: '+e.message, 'error');
    }
}

// ===== 写作计时器 (P0.4) =====
let _writingTimer = null;
let _writingSeconds = 0;
let _isWritingActive = false;
let _lastActivityTime = 0;

function startWritingTimer() {
    if (_writingTimer) return;
    _isWritingActive = true;
    _writingTimer = setInterval(() => {
        const now = Date.now();
        if (now - _lastActivityTime < 5000) {
            _writingSeconds++;
            if (_writingSeconds % 30 === 0) { reportWritingTime(); }
        }
    }, 1000);
}

function stopWritingTimer() {
    _isWritingActive = false;
    if (_writingTimer) { clearInterval(_writingTimer); _writingTimer = null; reportWritingTime(); }
}

async function reportWritingTime() {
    if (!currentProjectId || _writingSeconds <= 5) return;
    const secs = _writingSeconds;
    _writingSeconds = 0;
    await apiPost('/api/projects/'+currentProjectId+'/stats', {time_spent: secs});
}

document.addEventListener('DOMContentLoaded', () => {
    loadProjects(); initEventListeners(); loadBalanceStatus(); checkOnboarding();
    // 通过推荐链接进入时自动提示
    const inviteParam = new URLSearchParams(window.location.search).get('invite');
    if (inviteParam) {
        setTimeout(() => {
            document.getElementById('invite-result').innerHTML =
                '<span style="color:#30d158;">🎁 检测到推荐码: '+inviteParam+'</span><br><span style="color:var(--text-muted);">激活许可证后，点击「领取推荐奖励」获得 5 次额外 AI 调用</span>';
            showToast('你通过好友推荐进入，激活后可领取奖励！', 'info');
        }, 1000);
    }
});

function initEventListeners() {
    // Ctrl+S is handled by inline keyboard shortcut in index.html
    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', function(e) { if (e.target === overlay) closeModal(); });
    });
    // ESC to close modal or slideout
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (typeof _currentSlideout !== 'undefined' && _currentSlideout) {
                closeSlideout();
            } else {
                closeModal();
            }
        }
    });
}

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function formatDate(s) {
    if (!s) return '';
    try {
        const d = new Date(s); 
        if (isNaN(d.getTime())) return s.slice(0,10);
        return (d.getMonth()+1)+'/'+d.getDate()+' '+d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');
    } catch(e) { return s.slice(0,10); }
}

async function apiGet(url) {
    try { return await (await fetch(url)).json(); }
    catch(e) { showToast('请求失败: '+e.message,'error'); return null; }
}
async function apiPost(url, data) {
    try { return await (await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})).json(); }
    catch(e) { showToast('请求失败: '+e.message,'error'); return null; }
}
async function apiPut(url, data) {
    try { return await (await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})).json(); }
    catch(e) { showToast('请求失败: '+e.message,'error'); return null; }
}
async function apiDelete(url) {
    try { return await (await fetch(url,{method:'DELETE'})).json(); }
    catch(e) { showToast('请求失败: '+e.message,'error'); return null; }
}

function showToast(msg, type) {
    let c = document.querySelector('.toast-container');
    if (!c) { c = document.createElement('div'); c.className='toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = 'toast '+(type||'info'); t.textContent = msg;
    c.appendChild(t); setTimeout(()=>t.remove(), 3000);
}

// ===== 项目管理 =====
function selectProjectGenre(btn) {
    // 支持新旧两种 chip 样式
    btn.parentElement.querySelectorAll('.genre-chip,.genre-chip-new').forEach(b => {
        b.classList.remove('genre-chip-active', 'active');
    });
    btn.classList.add(btn.classList.contains('genre-chip-new') ? 'active' : 'genre-chip-active');
    document.getElementById('new-project-genre').value = btn.dataset.genre;
}

async function loadProjects() {
    const res = await apiGet('/api/projects');
    const list = document.getElementById('project-grid');
    if (!res || res.length===0) { list.innerHTML='<div class="empty-state" style="padding:60px 16px;"><div class="es-icon">📂</div><div class="es-title">暂无项目</div><div class="es-desc">点击按钮创建第一个项目</div></div>'; return; }
    const infos = await Promise.all(res.map(p => apiGet('/api/projects/'+p.id+'/info').catch(()=>null)));
    list.innerHTML = res.map((p,i)=>{
        const info = infos[i] || {};
        const name = escHtml(p.name||'未命名项目');
        const words = info.total_words ? (info.total_words>=10000 ? (info.total_words/10000).toFixed(1)+'万字' : info.total_words+'字') : '0字';
        const chCount = info.chapter_count || 0;
        const date = formatDate(p.updated_at);
        const active = p.id===currentProjectId;
        return '<div class="project-card '+(active?'active':'')+'" onclick="event.target.closest(\'.proj-del-btn\')||openProject(\''+p.id+'\')"><div class="proj-card-icon">📖</div><div class="proj-card-body"><div class="proj-card-title">'+name+'</div><div class="proj-card-meta">'+chCount+'章 · '+words+' · '+date+'</div></div><button class="proj-del-btn" onclick="event.stopPropagation();deleteProject(\''+p.id+'\',\''+name.replace(/'/g,"\\'")+'\')" title="删除项目">🗑</button></div>';
    }).join('');
}

async function deleteProject(pid, name) {
    showConfirm('确定要删除项目「'+name+'」吗？\n\n此操作不可撤销，所有章节、大纲、角色数据将被永久删除。', async function(ok) {
        if (!ok) return;
        const res = await apiDelete('/api/projects/'+pid);
        if (res && res.success) {
            // 清除 IndexedDB 中该项目的所有草稿
            if (typeof NovelDB !== 'undefined') {
                NovelDB.clearProjectDrafts(pid);
            }
            if (currentProjectId === pid) {
                currentProjectId = null;
                currentChapterId = null;
                chapters = [];
                // Reset to welcome state
                var welcome = document.getElementById('welcome-overlay');
                var editorWrap = document.getElementById('editor-wrap');
                var lore = document.getElementById('lore-monitor');
                if (welcome) welcome.style.display = 'flex';
                if (editorWrap) editorWrap.style.display = 'none';
                if (lore) lore.style.display = 'none';
                // Reset brand header
                var brandText = document.querySelector('.brand-text');
                if (brandText) brandText.textContent = 'Novel Studio';
                var brandSub = document.querySelector('.brand-sub');
                if (brandSub) brandSub.textContent = '工业级 · AI网文工作台';
                // Reset editor
                var et = document.getElementById('editor-title'); if (et) et.value = '';
                setEditorContent('');
                renderStoryTree();
            }
            showToast('项目已删除', 'success');
            await loadProjects();
        }
    });
}

async function createProject() {
    const name = document.getElementById('new-project-name').value.trim();
    const desc = document.getElementById('new-project-desc').value.trim();
    const genre = document.getElementById('new-project-genre').value;
    if (!name) { showToast('请输入项目名称','error'); return; }
    const res = await apiPost('/api/projects', {name, description: desc, genre: genre});
    if (res && res.id) {
        closeModal(); await loadProjects();
        // Auto-open outline flow
        openProject(res.id, 'outline');
        // Pre-fill outline params
        setTimeout(() => {
            const genreMap = {xuanhuan:'玄幻',dushi:'都市',kehuan:'科幻',xuanyi:'悬疑',yanqing:'言情',wuxia:'武侠',lishi:'历史'};
            const genreName = genreMap[genre] || genre || '';
            document.getElementById('outline-premise').value = '《' + name + '》' + (genreName ? ' — ' + genreName + '题材' : '');
            document.getElementById('outline-genre').value = genreName;
        }, 500);
        showToast('项目创建成功！请生成大纲开始创作', 'success');
    }
}

async function openProject(pid, targetTab) {
    currentProjectId = pid;
    // Hide welcome overlay, show editor + lore
    var welcome = document.getElementById('welcome-overlay');
    var editorWrap = document.getElementById('editor-wrap');
    var lore = document.getElementById('lore-monitor');
    if (welcome) welcome.style.display = 'none';
    if (editorWrap) editorWrap.style.display = 'flex';
    if (lore) lore.style.display = 'block';

    const info = await apiGet('/api/projects/'+pid+'/info');
    if (info) {
        // Update brand header with project name
        var brandText = document.querySelector('.brand-text');
        if (brandText) brandText.textContent = info.name || '未命名';
        var brandSub = document.querySelector('.brand-sub');
        const words = info.total_words ? (info.total_words>=10000?(info.total_words/10000).toFixed(1)+'万字':info.total_words+'字') : '0字';
        if (brandSub) brandSub.textContent = (info.chapter_count||0)+'章 · '+words;
        window._projectInfo = info;
    }
    await Promise.all([loadChapters(), loadCharacters(), loadOutline(), loadStats(), loadWorldItems()]);

    // 稿件安全生命线：检查 IndexedDB 中是否有未同步的草稿
    if (typeof NovelDB !== 'undefined') {
        NovelDB.getUnsynchronizedDrafts(pid).then(function(drafts) {
            if (drafts && drafts.length > 0) {
                var count = drafts.length;
                var latestDraft = drafts.reduce(function(a, b) {
                    return (a.updatedAt > b.updatedAt) ? a : b;
                });
                // 自动恢复最近的未同步草稿
                var chId = latestDraft.chapterId;
                if (chId && latestDraft.content) {
                    var ch = chapters.find(function(c) { return c.id === chId; });
                    var chTitle = ch ? ch.title : '未知章节';
                    setEditorContent(latestDraft.content);
                    if (ch) {
                        var titleEl = document.getElementById('editor-title');
                        if (titleEl) titleEl.value = ch.title;
                    }
                    currentChapterId = chId;
                    var wc = (latestDraft.content || '').replace(/\s/g, '').length;
                    var wcDisp = document.getElementById('wc-display');
                    if (wcDisp) wcDisp.textContent = wc.toLocaleString() + ' 字';
                    var wcEl = document.getElementById('editor-wordcount');
                    if (wcEl) wcEl.textContent = wc.toLocaleString() + ' 字';
                    showToast('📝 已自动为您恢复至最新草稿（' + chTitle + '）', 'info');
                }
            }
        }).catch(function() { /* 静默 */ });
    }

    // If target is outline and no nodes exist, show guide
    if (targetTab === 'outline' && outlineNodes.length === 0) {
        setTimeout(function() { openSlideout('outline'); showOutlineGuide(); }, 600);
    }
    // Open target slideout if specified
    if (targetTab && targetTab !== 'chapters' && targetTab !== 'outline') {
        setTimeout(function() { openSlideout(targetTab); }, 400);
    }
}

// ===== 章节 =====
async function loadChapters() {
    if (!currentProjectId) return;
    chapters = await apiGet('/api/projects/'+currentProjectId+'/chapters') || [];
    renderChapterList(); updateStats();
}

function renderChapterList() { renderStoryTree(); }

function renderStoryTree() {
    var tree = document.getElementById('story-tree');
    if (!tree) return;
    if (!currentProjectId) {
        tree.innerHTML = '<div class="empty-state" style="padding:40px 16px;"><div class="es-icon">📦</div><div class="es-title">暂无项目</div><div class="es-desc">点击上方按钮创建项目</div></div>';
        return;
    }
    if (!chapters || chapters.length === 0) {
        tree.innerHTML = '<div class="empty-state" style="padding:40px 16px;"><div class="es-icon">📄</div><div class="es-title">暂无章节</div><div class="es-desc">Ctrl+Enter 开始 AI 续写第一章</div></div>';
        return;
    }
    // Assign phases: 起/承/转/合 distributed across chapters
    var phases = ['起','承','转','合'];
    var html = '<div class="tree-section-header">📖 故事树 <span style="font-size:10px;color:var(--text-muted);margin-left:8px;">'+chapters.length+'章</span></div>';
    chapters.forEach(function(ch, i) {
        var phaseIdx = Math.min(Math.floor(i / Math.max(1, chapters.length) * 4), 3);
        var phase = phases[phaseIdx];
        var phaseCls = 'phase-'+['qi','cheng','zhuan','he'][phaseIdx];
        var active = ch.id === currentChapterId ? ' active' : '';
        var aiTag = ch.source === 'ai' ? '<span class="ch-tag ch-tag-ai">AI</span>' : '';
        html += '<div class="tree-node'+active+'" onclick="selectChapter(\''+ch.id+'\')" draggable="true" ondragstart="onChapterDragStart(event,\''+ch.id+'\','+i+')" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onChapterDrop(event,'+i+')">';
        html += '<span class="tree-phase '+phaseCls+'">'+phase+'</span>';
        html += '<span class="tree-index">'+(i+1)+'.</span>';
        html += '<div class="tree-title-wrap"><span class="tree-title" title="'+escHtml(ch.title)+'">'+escHtml(ch.title)+'</span>'+aiTag+'</div>';
        html += '<span class="tree-wc">'+(ch.word_count||0)+'字</span>';
        html += '<button class="tree-del" onclick="event.stopPropagation();deleteChapterById(\''+ch.id+'\')" title="删除">×</button>';
        html += '</div>';
    });
    tree.innerHTML = html;
    // Also update character list in slideout
    renderCharacterList();
}

// ===== 拖拽 (P0.2) =====
let _dragChapterIndex = -1;
function onChapterDragStart(e, cid, idx) { _dragChapterIndex = idx; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', cid); }
function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.classList.add('drag-over'); }
function onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
async function onChapterDrop(e, toIdx) {
    e.preventDefault(); e.currentTarget.classList.remove('drag-over');
    if (_dragChapterIndex < 0 || _dragChapterIndex === toIdx) return;
    const item = chapters.splice(_dragChapterIndex, 1)[0];
    chapters.splice(toIdx, 0, item);
    renderChapterList();
    await apiPost('/api/projects/'+currentProjectId+'/chapters/reorder', {chapter_ids: chapters.map(c=>c.id)});
    _dragChapterIndex = -1;
}

// ===== 大纲拖拽 =====
let _dragOutlineId = null;
function onOutlineDragStart(e, nid) { _dragOutlineId = nid; e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; }
async function onOutlineDrop(e, targetId) {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    if (!_dragOutlineId || _dragOutlineId === targetId) return;
    const target = outlineNodes.find(n=>n.id===targetId);
    if (!target) return;
    await apiPut('/api/projects/'+currentProjectId+'/outline/'+_dragOutlineId, {
        parent_id: target.parent_id || null,
        level: target.level || 0,
        sort_order: (target.sort_order || 0) + 1
    });
    await loadOutline(); showToast('大纲节点已移动','success');
    _dragOutlineId = null;
}

async function selectChapter(cid) {
    if (currentChapterId) await saveCurrentChapter();
    currentChapterId = cid;
    const ch = chapters.find(c=>c.id===cid);
    if (ch) {
        var titleEl = document.getElementById('editor-title');
        if (titleEl) titleEl.value = ch.title;
        setEditorContent(ch.content||'');
        // Contextual placeholder for empty chapters
        var body = document.getElementById('editor-body');
        if (body && (!ch.content || ch.content.trim() === '')) {
            body.setAttribute('data-placeholder', '📖 「' + ch.title + '」\n\n按 Ctrl+Enter 让 AI 根据大纲续写本章\n或直接输入文字开始创作');
        }
        var wcEl = document.getElementById('editor-wordcount');
        if (wcEl) wcEl.textContent = (ch.word_count||0)+' 字';
        var wcDisp = document.getElementById('wc-display');
        if (wcDisp) wcDisp.textContent = (ch.word_count||0).toLocaleString()+' 字';
        var statusCh = document.getElementById('status-chapter');
        if (statusCh) statusCh.textContent = ch.title;
        // Auto-summarize
        autoSummarizeChapter(cid);
    }
    renderStoryTree();
    renderDashboard();
    updateChapterNav();
    updateSaveStatus('saved');
}

async function createChapter() {
    if (!currentProjectId) { showToast('请先打开项目','error'); return; }
    const res = await apiPost('/api/projects/'+currentProjectId+'/chapters',{title:'新章节'});
    if (res && res.id) { await loadChapters(); selectChapter(res.id); showToast('章节已创建','success'); }
}

function selectFirstChapter() {
    if (chapters && chapters.length > 0) {
        selectChapter(chapters[0].id);
    } else {
        showToast('暂无章节', 'info');
    }
}

async function deleteCurrentChapter() {
    if (!currentChapterId) return;
    showConfirm('确定要删除当前章节吗?', async function(ok) {
        if (!ok) return;
        const res = await apiDelete('/api/projects/'+currentProjectId+'/chapters/'+currentChapterId);
        if (res && res.success) {
            currentChapterId=null;
            var titleEl = document.getElementById('editor-title');
            if (titleEl) titleEl.value = '';
            setEditorContent('');
            await loadChapters();
        }
    });
}

async function saveCurrentChapter() {
    if (!currentChapterId || !currentProjectId) return;
    updateSaveStatus('saving');
    var titleEl = document.getElementById('editor-title');
    var title = titleEl ? titleEl.value : '';
    var content = getEditorContent();
    const res = await apiPut('/api/projects/'+currentProjectId+'/chapters/'+currentChapterId, {title,content});
    if (res && res.success) {
        const ch = chapters.find(c=>c.id===currentChapterId);
        if (ch) { ch.title=title; ch.word_count=res.word_count; }
        updateSaveStatus('saved');
        var statusEl = document.getElementById('status-saved');
        if (statusEl) statusEl.textContent = '已保存 '+new Date().toLocaleTimeString();
        var wcDisp = document.getElementById('wc-display');
        if (wcDisp) wcDisp.textContent = (res.word_count||0).toLocaleString()+' 字';
        if (typeof NovelDB !== 'undefined') {
            NovelDB.markSynced(currentProjectId, currentChapterId, content);
        }
    } else if (res && res.error) {
        updateSaveStatus('error');
        showToast('保存失败: ' + res.error, 'error');
    } else {
        updateSaveStatus('error');
        showToast('保存失败: 网络异常，草稿已保留在本地', 'error');
    }
}

// onEditorInput() is defined in index.html inline script for contenteditable sync.
// This version is a fallback that tracks writing activity time.
// The inline script version (loaded after app.js) takes precedence.
// Note: The inline onEditorInput() in index.html takes precedence and handles
// word count sync, auto-save, POV patrol, and deviation checks.
function onEditorInput() {
    _lastActivityTime = Date.now();
}


// ===== 角色 =====
async function loadCharacters() {
    if (!currentProjectId) return;
    characters = await apiGet('/api/projects/'+currentProjectId+'/characters') || [];
    renderCharacterList();
    // 自动更新 POV 角色选择器
    if (typeof updatePovCharSelector === 'function') updatePovCharSelector();
    if (characters.length > 0 && !window._povCharacter) {
        window._povCharacter = characters[0].name;
        if (typeof updatePovCharSelector === 'function') updatePovCharSelector();
    }
}

// ===== Chapter Navigation =====
function navigateChapter(direction) {
    if (!chapters || chapters.length === 0) return;
    var idx = chapters.findIndex(function(c) { return c.id === currentChapterId; });
    if (idx === -1) idx = 0;
    var newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= chapters.length) {
        if (direction === -1) showToast('已经是第一章', 'info');
        else showToast('已经是最后一章', 'info');
        return;
    }
    selectChapter(chapters[newIdx].id);
    updateChapterNav();
}

function updateChapterNav() {
    var el = document.getElementById('ch-nav-info');
    if (!el || !chapters) return;
    var idx = chapters.findIndex(function(c) { return c.id === currentChapterId; });
    if (idx === -1) idx = 0;
    el.textContent = (idx + 1) + '/' + chapters.length;
}

// ===== Save Status Indicator =====
function updateSaveStatus(status) {
    var el = document.getElementById('ch-save-status');
    if (!el) return;
    if (status === 'saving') {
        el.textContent = '💾 保存中...'; el.className = 'ch-save-status saving';
    } else if (status === 'saved') {
        el.textContent = '✅ 已保存'; el.className = 'ch-save-status saved';
        clearTimeout(window._saveStatusTimer);
        window._saveStatusTimer = setTimeout(function() {
            el.textContent = '💾 已保存'; el.className = 'ch-save-status';
        }, 2000);
    } else if (status === 'error') {
        el.textContent = '❌ 保存失败'; el.className = 'ch-save-status error';
    } else if (status === 'dirty') {
        el.textContent = '✏️ 未保存'; el.className = 'ch-save-status';
    }
}

// ===== AI 写完整本章 =====
async function writeCurrentChapter() {
    if (!currentProjectId || !currentChapterId) { showToast('请先打开项目和章节', 'error'); return; }

    // Show loading
    var lel = document.getElementById('ai-loading-continue');
    var slideoutEl = document.getElementById('slideout-ai-continue');
    if (!slideoutEl) { showToast('AI 续写面板未加载', 'error'); return; }
    var container = document.getElementById('ai-messages-continue');
    if (!container) return;

    if (lel) lel.style.display = 'flex';
    if (slideoutEl.classList.contains('open')) { /* already open */ }
    else { openSlideout('ai-continue'); }

    try {
        var targetWords = 3000; // Default, can be made configurable
        var res = await fetch('/api/projects/' + currentProjectId + '/ai/write-chapter', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: getEditorContent(),
                chapter_id: currentChapterId,
                target_words: targetWords,
                model: getCurrentModel()
            })
        });
        var data = await res.json();
        if (lel) lel.style.display = 'none';

        if (data.content) {
            // Show result in slideout
            var aiDiv = document.createElement('div');
            aiDiv.className = 'ai-msg assistant';
            aiDiv.innerHTML = '<div class="msg-role">✍️ AI 写本章（' + (data.word_count || 0).toLocaleString() + '字）</div><div>' +
                escHtml(data.content).replace(/\n/g, '<br>') + '</div>';
            container.appendChild(aiDiv);

            // Quality warnings
            if (data.quality_warnings && data.quality_warnings.length > 0) {
                var warnDiv = document.createElement('div');
                warnDiv.className = 'ai-msg quality-warn';
                warnDiv.innerHTML = '<div class="msg-role">⚠️ 质量提醒</div><div>' +
                    data.quality_warnings.map(function(w) { return '• ' + escHtml(w); }).join('<br>') + '</div>';
                container.appendChild(warnDiv);
            }

            // Insert into editor
            if (currentChapterId) {
                var existing = getEditorContent();
                var newContent = existing ? existing + '\n\n' + data.content : data.content;
                setEditorContent(newContent);
                if (typeof Evolution !== 'undefined') Evolution.markAiInsert(data.content);
                onEditorInput();
                showToast('本章已生成（' + (data.word_count || 0).toLocaleString() + '字），内容已插入编辑器', 'success');
            }

            container.scrollTop = container.scrollHeight;
        } else if (data.error) {
            showToast('生成失败: ' + data.error, 'error');
        }
    } catch (e) {
        if (lel) lel.style.display = 'none';
        showToast('请求失败: ' + e.message, 'error');
    }
}

// ===== Fullscreen Toggle =====
function toggleFullscreen() {
    var wrap = document.getElementById('editor-wrap');
    if (!wrap) return;
    wrap.classList.toggle('fullscreen');
    var btn = document.querySelector('.ch-action-btn[title*="全屏"]');
    if (btn) {
        btn.textContent = wrap.classList.contains('fullscreen') ? '⛶' : '⛶';
    }
    // Focus editor when entering fullscreen
    if (wrap.classList.contains('fullscreen')) {
        var body = document.getElementById('editor-body');
        if (body) body.focus();
    }
}

// ESC to exit fullscreen
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        var wrap = document.getElementById('editor-wrap');
        if (wrap && wrap.classList.contains('fullscreen')) {
            wrap.classList.remove('fullscreen');
        }
    }
});

function renderCharacterList() {
    const list = document.getElementById('character-list');
    if (!list) return;
    if (!characters || characters.length===0) { list.innerHTML='<div class="empty-state"><div class="es-icon">👤</div><div class="es-title">暂无角色</div></div>'; renderActiveCharacters(); return; }
    list.innerHTML = characters.map(ch=>'<div class="character-card" onclick="editCharacter(\''+ch.id+'\')"><div class="cc-name">'+escHtml(ch.name)+'</div><div class="cc-meta">'+(ch.gender?'<span>'+escHtml(ch.gender)+'</span>':'')+' '+(ch.age?'<span>· '+escHtml(ch.age)+'岁</span>':'')+'</div><div class="cc-desc">'+(ch.personality||'').slice(0,80)+'</div></div>').join('');
    renderActiveCharacters();
}

// ===== Left Panel: Lore Monitor =====
function renderActiveCharacters() {
    var container = document.getElementById('active-characters');
    if (!container) return;
    if (!characters || characters.length === 0) {
        container.innerHTML = '<div style="padding:8px 12px;font-size:11px;color:var(--text-muted);">暂无角色</div>';
        return;
    }
    var shown = characters.slice(0, 8);
    container.innerHTML = shown.map(function(ch) {
        var statusColors = { '存活': 'var(--green)', '死亡': 'var(--red)', '未知': 'var(--text-muted)' };
        var status = ch.status || '存活';
        var color = statusColors[status] || 'var(--text-muted)';
        return '<div class="char-chip"><span class="char-status-dot" style="background:'+color+';"></span><span class="char-chip-name">'+escHtml(ch.name)+'</span><span class="char-chip-status">['+escHtml(status)+']</span></div>';
    }).join('');
    if (characters.length > 8) {
        container.innerHTML += '<div style="font-size:10px;color:var(--text-muted);padding:4px 12px;">还有 '+(characters.length-8)+' 个角色...</div>';
    }
}

function renderWorldRules() {
    var container = document.getElementById('world-rules');
    if (!container) return;
    if (!window._worldItems || window._worldItems.length === 0) {
        container.innerHTML = '<div style="padding:8px 12px;font-size:11px;color:var(--text-muted);">暂无设定约束</div>';
        return;
    }
    var shown = window._worldItems.slice(0, 5);
    container.innerHTML = shown.map(function(item) {
        return '<div class="rule-item"><span class="rule-cat">'+escHtml(item.category||'other')+'</span><span class="rule-name">'+escHtml(item.name||'')+'</span></div>';
    }).join('');
}

// ===== SaaS 会员阶梯 UI 门控 =====
function lockMetricCard(cardId, featureName) {
    var card = document.getElementById(cardId);
    if (!card || card.querySelector('.metric-lock-overlay')) return;
    card.classList.add('metric-card-locked');
    var overlay = document.createElement('div');
    overlay.className = 'metric-lock-overlay';
    overlay.innerHTML = '<div class="metric-lock-icon">🔒</div><div class="metric-lock-label">' + (featureName || '高级功能') + '</div>';
    overlay.onclick = function() {
        showToast('此功能为【专业版】专属，用数据指导创作，大幅提升签约率', 'info');
    };
    card.appendChild(overlay);
}

function unlockMetricCard(cardId) {
    var card = document.getElementById(cardId);
    if (!card) return;
    card.classList.remove('metric-card-locked');
    var overlay = card.querySelector('.metric-lock-overlay');
    if (overlay) overlay.remove();
}

function applyTierGating() {
    if (userTier === 'free') {
        lockMetricCard('deviation-card', '剧情偏离度监控');
        lockMetricCard('retention-card', '验证期留存预测');
    } else {
        unlockMetricCard('deviation-card');
        unlockMetricCard('retention-card');
    }
}

// ===== Right Panel: Dashboard =====
function renderDashboard() {
    applyTierGating();
    updateRealismRadar();
    updateHookAnalyzer();
    updateClichéList();
    if (isFeatureUnlockedTier()) {
        checkPlotDeviation();
        predictRetention();
    }
    if (typeof povPatrol === 'function') povPatrol();
}

// ===== 一键健康度报告 — Canvas 渲染 + 下载 =====
function generateHealthReport() {
    if (!currentProjectId || !currentChapterId) {
        showToast('请先打开项目并选择章节', 'info');
        return;
    }

    // ═══════════════════════════════════════════
    //  数据采集 — 从仪表盘卡片抓取所有指标
    // ═══════════════════════════════════════════
    function elText(id) { var e = document.getElementById(id); return e ? (e.textContent || '').trim() : '—'; }
    function elVal(id) { var e = document.getElementById(id); return e ? parseInt(e.textContent) || 0 : 0; }

    var ch1 = elText('ret-ch1'), ch3 = elText('ret-ch3'), d7 = elText('ret-d7'), d8 = elText('ret-d8');
    var platform = elText('retention-platform');
    var povCount = elText('pov-violation-count');
    var povStatus = elText('pov-alert-status');
    var clicheStatus = elText('cliche-status');
    var clicheSummary = elText('cliche-summary');
    var devPct = elText('deviation-pct');
    var devStatus = elText('deviation-status');
    var realismScoreVal = elVal('realism-score');
    var realismStatus = elText('realism-status');
    var hookScoreVal = elVal('hook-score');
    var hookStatusText = elText('hook-status');
    var chapterTitle = document.getElementById('editor-title');
    var chTitle = chapterTitle ? chapterTitle.value.trim() : '未命名章节';
    var wc = elText('editor-wordcount');

    // 计算去AI味套话命中次数
    var clicheTotal = 0;
    var clicheMatch = clicheSummary.match(/(\d+)\s*次/g);
    if (clicheMatch) { for (var i = 0; i < clicheMatch.length; i++) { var n = parseInt(clicheMatch[i]); if (!isNaN(n)) clicheTotal += n; } }
    if (!clicheTotal && clicheStatus.indexOf('✓') < 0 && clicheStatus.indexOf('干净') < 0) { var m2 = clicheStatus.match(/(\d+)/); if (m2) clicheTotal = parseInt(m2[1]); }
    var deaiScoreVal = Math.max(0, 100 - clicheTotal * 8); // 每处命中扣8分

    // POV 越界次数
    var povViolationCount = parseInt(povCount) || 0;
    var povOk = povStatus.indexOf('✓') >= 0 || povStatus.indexOf('安全') >= 0;
    var povScoreVal = povOk ? 100 : Math.max(0, 100 - povViolationCount * 15);

    // 剧情偏离度
    var devNum = parseFloat(devPct) || 0;

    var now = new Date();
    var dateStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + ' ' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

    // ═══════════════════════════════════════════
    //  Canvas 初始化 — 1080×1920 手机全面屏
    // ═══════════════════════════════════════════
    var W = 1080, H = 1920;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var PAD = 80; // 全局边距

    // 深空背景
    ctx.fillStyle = '#07070f';
    ctx.fillRect(0, 0, W, H);

    // 细微噪点纹理
    ctx.globalAlpha = 0.015;
    for (var i = 0; i < 3000; i++) {
        ctx.fillStyle = i % 3 === 0 ? '#7c3aed' : i % 3 === 1 ? '#3b82f6' : '#06b6d4';
        ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
    ctx.globalAlpha = 1;

    // 顶部光晕
    var glowGrad = ctx.createRadialGradient(W/2, 0, 0, W/2, 0, 600);
    glowGrad.addColorStop(0, 'rgba(124,58,237,0.12)');
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, W, 600);

    // ═══════════════════════════════════════════
    //  头部品牌栏 — 暗黑科技极客风
    // ═══════════════════════════════════════════
    var headerH = 200;
    var headerGrad = ctx.createLinearGradient(0, 0, W, headerH);
    headerGrad.addColorStop(0, '#0d0d20');
    headerGrad.addColorStop(0.5, '#12122a');
    headerGrad.addColorStop(1, '#0d0d20');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, W, headerH);

    // 顶部细线
    var topLineGrad = ctx.createLinearGradient(0, 0, W, 0);
    topLineGrad.addColorStop(0, 'rgba(124,58,237,0)');
    topLineGrad.addColorStop(0.2, 'rgba(124,58,237,0.6)');
    topLineGrad.addColorStop(0.5, 'rgba(59,130,246,0.8)');
    topLineGrad.addColorStop(0.8, 'rgba(6,182,212,0.6)');
    topLineGrad.addColorStop(1, 'rgba(124,58,237,0)');
    ctx.strokeStyle = topLineGrad;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.stroke();

    // 品牌标识
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px "SF Pro Display", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('NOVEL STUDIO', W/2, 72);

    // 副标题
    ctx.font = '20px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('独家数据精算网文驾驶舱', W/2, 104);

    // 报告标题栏
    var titleBarY = 130, titleBarH = 44;
    ctx.fillStyle = 'rgba(124,58,237,0.1)';
    ctx.strokeStyle = 'rgba(124,58,237,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(W/2 - 200, titleBarY, 400, titleBarH, 8); ctx.fill(); ctx.stroke();
    ctx.font = 'bold 16px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#a78bfa';
    ctx.fillText('🔬 新书验证期 · 硬核排毒体检报告', W/2, titleBarY + 30);

    // ═══════════════════════════════════════════
    //  章节元信息
    // ═══════════════════════════════════════════
    var y = headerH + 40;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('《' + chTitle + '》', PAD, y);
    y += 44;
    ctx.fillStyle = '#64748b';
    ctx.font = '18px "SF Pro Display", "PingFang SC", sans-serif';
    ctx.fillText('📅 ' + dateStr + '    字数：' + wc, PAD, y);

    // 分割线
    y += 36;
    var sepGrad = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
    sepGrad.addColorStop(0, 'rgba(124,58,237,0)');
    sepGrad.addColorStop(0.5, 'rgba(124,58,237,0.4)');
    sepGrad.addColorStop(1, 'rgba(124,58,237,0)');
    ctx.strokeStyle = sepGrad;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();

    // ═══════════════════════════════════════════
    //  核心留存指标 — 可视化进度条
    // ═══════════════════════════════════════════
    y += 44;
    ctx.fillStyle = '#7c3aed';
    ctx.font = 'bold 20px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('━━━  核心留存指标  ━━━', W/2, y);
    y += 48;

    var retentionMetrics = [
        {label: '第1章 读完率', val: parseFloat(ch1) || 0, max: 100, icon: '📖', color: ['#06b6d4', '#3b82f6']},
        {label: '第3章 留存率', val: parseFloat(ch3) || 0, max: 100, icon: '📚', color: ['#8b5cf6', '#7c3aed']},
        {label: '7日 留存率',  val: parseFloat(d7) || 0,  max: 50,  icon: '📅', color: ['#f59e0b', '#d97706']},
        {label: '8日 追读率',  val: parseFloat(d8) || 0,  max: 30,  icon: '📈', color: ['#10b981', '#059669']}
    ];

    retentionMetrics.forEach(function(m) {
        // 指标卡片背景
        var cardX = PAD, cardW = W - PAD * 2, cardH = 64;
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(cardX, y, cardW, cardH, 6); ctx.fill(); ctx.stroke();

        // 图标 + 标签
        ctx.textAlign = 'left';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '18px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(m.icon + '  ' + m.label, PAD + 20, y + 40);

        // 进度条
        var barX = PAD + 300, barW = cardW - 380, barH = 16, barY = y + 24;
        var barBg = ctx.createLinearGradient(0, 0, 0, barH);
        barBg.addColorStop(0, 'rgba(255,255,255,0.04)');
        barBg.addColorStop(1, 'rgba(255,255,255,0.02)');
        ctx.fillStyle = barBg;
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 8); ctx.fill();

        var pct = Math.min(1, m.val / m.max);
        var fillW = Math.max(0, pct * barW);
        if (fillW > 2) {
            var fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
            fillGrad.addColorStop(0, m.color[0]);
            fillGrad.addColorStop(1, m.color[1]);
            ctx.fillStyle = fillGrad;
            ctx.beginPath(); ctx.roundRect(barX, barY, fillW, barH, 8); ctx.fill();
        }

        // 数值
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px "SF Pro Display", "PingFang SC", sans-serif';
        ctx.fillText(m.val + '%', W - PAD - 20, y + 40);

        // 刻度
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '11px "SF Pro Display", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('/' + m.max + '%', W - PAD - 20 - ctx.measureText(m.val + '%').width - 8, y + 40);

        y += cardH + 12;
    });

    // 平台标注
    y += 4;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('🎯 推荐首发平台：' + (platform && platform !== '—' ? platform : '待评估'), PAD + 10, y);

    // 分割线
    y += 40;
    ctx.strokeStyle = sepGrad;
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();

    // ═══════════════════════════════════════════
    //  质量诊断 — 四维可视化指标卡
    // ═══════════════════════════════════════════
    y += 44;
    ctx.fillStyle = '#3b82f6';
    ctx.font = 'bold 20px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('━━━  质量深度诊断  ━━━', W/2, y);
    y += 48;

    var qualityCards = [
        {
            icon: '🚫', title: '去AI味·套话净化度',
            score: deaiScoreVal, max: 100,
            color: deaiScoreVal >= 80 ? ['#10b981', '#059669'] : deaiScoreVal >= 50 ? ['#f59e0b', '#d97706'] : ['#ef4444', '#dc2626'],
            status: deaiScoreVal >= 80 ? '✓ 文本纯净' : deaiScoreVal >= 50 ? '⚠ 存在套话' : '✗ 严重AI味',
            detail: '命中 ' + clicheTotal + ' 处套话'
        },
        {
            icon: '🔒', title: 'POV 视角合规率',
            score: povScoreVal, max: 100,
            color: povScoreVal >= 80 ? ['#10b981', '#059669'] : povScoreVal >= 50 ? ['#f59e0b', '#d97706'] : ['#ef4444', '#dc2626'],
            status: povScoreVal >= 80 ? '✓ 视角安全' : povScoreVal >= 50 ? '⚠ 有越界' : '✗ 严重越界',
            detail: povOk ? '0 处上帝视角越界' : povViolationCount + ' 处上帝视角越界'
        },
        {
            icon: '🧭', title: '生存逻辑·写实度指数',
            score: realismScoreVal, max: 100,
            color: realismScoreVal >= 60 ? ['#10b981', '#059669'] : realismScoreVal >= 40 ? ['#f59e0b', '#d97706'] : ['#ef4444', '#dc2626'],
            status: realismScoreVal >= 60 ? '✓ 写实合格' : realismScoreVal >= 40 ? '⚠ 需加强' : '✗ 逻辑滑坡',
            detail: (realismStatus || '—')
        },
        {
            icon: '🪝', title: '断章钩子·次页转化力',
            score: hookScoreVal, max: 100,
            color: hookScoreVal >= 70 ? ['#10b981', '#059669'] : hookScoreVal >= 45 ? ['#f59e0b', '#d97706'] : ['#ef4444', '#dc2626'],
            status: hookScoreVal >= 70 ? '✓ 强力钩子' : hookScoreVal >= 45 ? '⚠ 钩子偏弱' : '✗ 钩子缺失',
            detail: (hookStatusText || '—')
        }
    ];

    qualityCards.forEach(function(card) {
        var cardX = PAD, cardW = W - PAD * 2, cardH = 110;
        // 卡片背景
        ctx.fillStyle = 'rgba(255,255,255,0.015)';
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(cardX, y, cardW, cardH, 8); ctx.fill(); ctx.stroke();

        // 左侧彩色边条
        var leftBarGrad = ctx.createLinearGradient(0, y, 0, y + cardH);
        leftBarGrad.addColorStop(0, card.color[0]);
        leftBarGrad.addColorStop(1, card.color[1]);
        ctx.fillStyle = leftBarGrad;
        ctx.fillRect(cardX, y + 16, 4, cardH - 32);

        // 图标 + 标题
        ctx.textAlign = 'left';
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 20px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(card.icon + '  ' + card.title, PAD + 28, y + 34);

        // 状态标签
        ctx.textAlign = 'right';
        ctx.fillStyle = card.score >= 60 ? '#10b981' : card.score >= 40 ? '#f59e0b' : '#ef4444';
        ctx.font = '16px "PingFang SC", sans-serif';
        ctx.fillText(card.status, W - PAD - 20, y + 34);

        // 分数大数字
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px "SF Pro Display", "PingFang SC", sans-serif';
        ctx.fillText(card.score, PAD + 28, y + 80);

        ctx.fillStyle = '#64748b';
        ctx.font = '14px "PingFang SC", sans-serif';
        ctx.fillText('/ ' + card.max + ' 分', PAD + 28 + ctx.measureText(card.score + '').width + 8, y + 80);

        // 详情小字
        ctx.textAlign = 'right';
        ctx.fillStyle = '#64748b';
        ctx.font = '13px "PingFang SC", sans-serif';
        ctx.fillText(card.detail, W - PAD - 20, y + 80);

        y += cardH + 14;
    });

    // 剧情偏离度
    if (!isNaN(devNum) && devNum > 0) {
        var devLabel = devNum > 50 ? '剧情严重偏离大纲' : devNum > 20 ? '剧情轻微偏离' : '剧情贴合大纲';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#64748b';
        ctx.font = '13px "PingFang SC", sans-serif';
        ctx.fillText('🎯 剧情偏离度：' + devNum + '% — ' + devLabel + (devStatus && devStatus !== '—' ? '（' + devStatus + '）' : ''), PAD + 28, y + 10);
    }

    // 分割线
    y += 48;
    ctx.strokeStyle = sepGrad;
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();

    // ═══════════════════════════════════════════
    //  冷峻技术流诊断评语
    // ═══════════════════════════════════════════
    y += 44;
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 18px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('📋 技术流诊断评语', PAD, y);
    y += 30;

    // 构建诊断文本
    var diagnosisParts = [];
    if (!povOk && povViolationCount > 0) diagnosisParts.push('存在 ' + povViolationCount + ' 处上帝视角越界');
    if (clicheTotal > 0) diagnosisParts.push('AI 味套话命中 ' + clicheTotal + ' 次');
    if (realismScoreVal < 50) diagnosisParts.push('生存逻辑指数偏低（' + realismScoreVal + '分）');
    if (hookScoreVal < 45) diagnosisParts.push('尾部断章钩子微弱（' + hookScoreVal + '分）');
    if (devNum > 30) diagnosisParts.push('剧情偏离大纲 ' + devNum + '%');
    if (diagnosisParts.length === 0) {
        diagnosisParts.push('各项指标均在健康阈值内，继续推进');
    }

    var diagnosisText = '当前章节：' + diagnosisParts.join('，') + '。';
    if (diagnosisParts.length >= 3) {
        diagnosisText += ' 建议立刻优化防弃书。';
    } else if (diagnosisParts.length >= 1) {
        diagnosisText += ' 建议针对性优化后再推进下一章。';
    } else {
        diagnosisText += ' 章节质量优秀，建议保持当前创作策略。';
    }

    // 诊断文字卡片
    var diagX = PAD, diagW = W - PAD * 2;
    var lines = [];
    var words = diagnosisText;
    var maxCharsPerLine = 36;
    ctx.font = '18px "PingFang SC", "Microsoft YaHei", sans-serif';
    while (words.length > 0) {
        var lineLen = Math.min(maxCharsPerLine, words.length);
        // 尝试在标点处断行
        if (lineLen < words.length) {
            var breakPts = ['。', '；', '，', '、', ' '];
            for (var bi = 0; bi < breakPts.length; bi++) {
                var bp = words.lastIndexOf(breakPts[bi], lineLen);
                if (bp > lineLen * 0.6) { lineLen = bp + 1; break; }
            }
        }
        lines.push(words.substring(0, lineLen));
        words = words.substring(lineLen);
    }
    var diagH = 40 + lines.length * 32;
    ctx.fillStyle = 'rgba(245,158,11,0.05)';
    ctx.strokeStyle = 'rgba(245,158,11,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(diagX, y, diagW, diagH, 8); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    for (var li = 0; li < lines.length; li++) {
        ctx.fillText(lines[li], PAD + 20, y + 30 + li * 32);
    }
    y += diagH + 30;

    // ═══════════════════════════════════════════
    //  防伪与裂变水印
    // ═══════════════════════════════════════════
    var wmY = H - 180;
    // 分割线
    var wmSepGrad = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
    wmSepGrad.addColorStop(0, 'rgba(148,163,184,0)');
    wmSepGrad.addColorStop(0.5, 'rgba(148,163,184,0.2)');
    wmSepGrad.addColorStop(1, 'rgba(148,163,184,0)');
    ctx.strokeStyle = wmSepGrad;
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(PAD, wmY); ctx.lineTo(W - PAD, wmY); ctx.stroke();

    wmY += 28;
    // 暗纹防伪文字
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(148,163,184,0.25)';
    ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('本报告由 Novel Studio 数据智能创作者工作台 独家提供', W/2, wmY);
    wmY += 24;
    ctx.fillStyle = 'rgba(148,163,184,0.18)';
    ctx.font = '12px "PingFang SC", sans-serif';
    ctx.fillText('内测通道开放中 · 扫描二维码获取抢先体验资格', W/2, wmY);
    wmY += 22;
    ctx.fillStyle = 'rgba(148,163,184,0.12)';
    ctx.font = '11px "SF Pro Display", sans-serif';
    ctx.fillText('POWERED BY NOVEL STUDIO · AI-DRIVEN CREATIVE INTELLIGENCE · INTERNAL BETA', W/2, wmY);

    // ═══════════════════════════════════════════
    //  触发下载
    // ═══════════════════════════════════════════
    canvas.toBlob(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'novel-health-report-' + dateStr.replace(/[: ]/g, '-') + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('📊 硬核排毒体检报告已生成，正在下载...', 'success');
    }, 'image/png');
}

async function updateRealismRadar() {
    var scoreEl = document.getElementById('realism-score');
    if (!scoreEl) return;

    var fantasyBar = document.getElementById('realism-fantasy-bar');
    var envBar = document.getElementById('realism-env-bar');
    var gapBar = document.getElementById('realism-gap-bar');
    var fantasyVal = document.getElementById('realism-fantasy-val');
    var envVal = document.getElementById('realism-env-val');
    var gapVal = document.getElementById('realism-gap-val');
    var statusEl = document.getElementById('realism-status');
    var diagEl = document.getElementById('realism-diagnosis');
    var card = document.getElementById('realism-card');

    // 默认值
    var score = 50, fantasyRisk = 0, envPressure = 0, cognitiveGap = 0;
    var diagnosis = '', warning = false;

    if (currentProjectId && currentChapterId) {
        try {
            var content = typeof getEditorContent === 'function' ? getEditorContent() : '';
            if (content && content.trim()) {
                var res = await fetch('/api/projects/' + currentProjectId + '/ai/realism-radar', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: content })
                });
                var data = await res.json();
                if (data && !data.error) {
                    score = data.realism_score || 50;
                    fantasyRisk = data.power_fantasy_risk || 0;
                    envPressure = data.environment_pressure || 0;
                    cognitiveGap = data.cognitive_gap || 0;
                    diagnosis = data.diagnosis || '';
                    warning = data.warning || false;
                }
            }
        } catch(e) { /* silent fallback */ }
    }

    // 渲染分数
    scoreEl.textContent = score;
    if (score >= 60) scoreEl.style.color = 'var(--green)';
    else if (score >= 40) scoreEl.style.color = 'var(--orange)';
    else scoreEl.style.color = 'var(--red)';

    // 渲染三轴进度条
    if (fantasyBar) fantasyBar.style.width = fantasyRisk + '%';
    if (envBar) envBar.style.width = envPressure + '%';
    if (gapBar) gapBar.style.width = cognitiveGap + '%';
    if (fantasyVal) { fantasyVal.textContent = fantasyRisk; fantasyVal.style.color = fantasyRisk > 40 ? 'var(--red)' : 'var(--text-muted)'; }
    if (envVal) { envVal.textContent = envPressure; envVal.style.color = envPressure > 30 ? 'var(--green)' : 'var(--text-muted)'; }
    if (gapVal) { gapVal.textContent = cognitiveGap; gapVal.style.color = cognitiveGap > 30 ? 'var(--accent)' : 'var(--text-muted)'; }

    // 状态标签
    if (statusEl) {
        if (warning) {
            statusEl.textContent = '⚠️ 逻辑滑坡';
            statusEl.style.background = 'rgba(220,38,38,0.15)';
            statusEl.style.color = '#f87171';
        } else if (score >= 60) {
            statusEl.textContent = '写实合格';
            statusEl.style.background = 'rgba(48,209,88,0.12)';
            statusEl.style.color = 'var(--green)';
        } else if (score >= 40) {
            statusEl.textContent = '需加强';
            statusEl.style.background = 'rgba(245,158,11,0.12)';
            statusEl.style.color = 'var(--orange)';
        } else {
            statusEl.textContent = '⚠️ 逻辑滑坡';
            statusEl.style.background = 'rgba(220,38,38,0.15)';
            statusEl.style.color = '#f87171';
        }
    }

    // 卡片样式
    if (card) {
        card.classList.remove('warn-realism', 'low-realism');
        if (warning) {
            card.classList.add('warn-realism');
        } else if (score < 40) {
            card.classList.add('low-realism');
        }
    }

    // 诊断文字
    if (diagEl) {
        diagEl.textContent = diagnosis;
        diagEl.style.background = warning ? 'rgba(220,38,38,0.08)' : 'transparent';
        diagEl.style.color = warning ? '#fca5a5' : 'var(--text-secondary)';
    }
}

// Token 精算：留存预测 — 高价值重度路径，调用后端 AI
async function predictRetention() {
    var container = document.getElementById('retention-tip');
    if (!container) return;
    if (!currentProjectId || !currentChapterId) {
        container.textContent = '打开章节后生成预测...';
        return;
    }
    var content = typeof getEditorContent === 'function' ? getEditorContent() : '';
    if (!content || content.trim().length < 100) {
        container.textContent = '内容太短，继续写作后自动预测...';
        return;
    }

    // Pro 层级月度配额检查
    if (userTier === 'pro') {
        var used = window._predictRetentionUsed || 0;
        var limit = window._predictRetentionLimit || 50;
        if (used >= limit) {
            container.textContent = '本月预测次数已用完（' + limit + '/' + limit + '），下月自动重置';
            return;
        }
    }

    // 显示加载状态
    ['ret-ch1', 'ret-ch3', 'ret-d7', 'ret-d8'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.textContent = '...';
    });
    container.textContent = 'AI 正在分析留存...';

    try {
        var res = await fetch('/api/projects/' + currentProjectId + '/ai/predict-retention', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content, chapter_id: currentChapterId })
        });
        if (res.status === 429) {
            container.textContent = '扫描限频，稍后自动重试...';
            return;
        }
        if (res.status === 403) {
            container.textContent = '此功能为【专业版】专属，用数据指导创作，大幅提升签约率';
            return;
        }
        var data = await res.json();
        if (data.error) { container.textContent = data.error; return; }

        // 数据飞轮：应用偏差校准
        if (typeof Evolution !== 'undefined' && Evolution.applyBias) {
            data = Evolution.applyBias(data);
        }

        // 更新四个留存指标
        function setRet(elId, val, cls) {
            var el = document.getElementById(elId);
            if (!el) return;
            el.textContent = val || '—';
            el.className = 'r-pct ' + (cls || 'good');
        }
        setRet('ret-ch1', (data.ch1_read_rate || '—'), data.ch1_read_rate > 70 ? 'good' : data.ch1_read_rate > 50 ? 'warn' : 'bad');
        setRet('ret-ch3', (data.ch3_retention || '—'), data.ch3_retention > 50 ? 'good' : data.ch3_retention > 30 ? 'warn' : 'bad');
        setRet('ret-d7', (data.d7_retention || '—'), data.d7_retention > 20 ? 'good' : data.d7_retention > 10 ? 'warn' : 'bad');
        setRet('ret-d8', (data.d8_read_rate || '—'), data.d8_read_rate > 15 ? 'good' : data.d8_read_rate > 8 ? 'warn' : 'bad');
        container.textContent = (data.tip || '预测完成') + (data.bias_applied ? ' （已自动校准）' : '');

        // 更新平台标签
        var platformEl = document.getElementById('retention-platform');
        if (platformEl && data.platform) platformEl.textContent = data.platform;
    } catch(e) {
        container.textContent = '预测服务暂不可用';
    }
}

async function updateHookAnalyzer() {
    var scoreEl = document.getElementById('hook-score');
    var bar = document.getElementById('hook-bar-fill-main');
    var target = document.getElementById('hook-target');
    var detail = document.getElementById('hook-detail');
    var cutEl = document.getElementById('hook-cut-quality');
    var suggestionEl = document.getElementById('hook-suggestion');
    var statusEl = document.getElementById('hook-status');
    var card = document.getElementById('hook-card');

    if (!scoreEl || !bar || !target) return;

    // 默认状态
    var hookScore = 50, cutQuality = '', diagnosis = '', suggestion = '', lastSentence = '';

    if (currentProjectId && currentChapterId) {
        try {
            var content = typeof getEditorContent === 'function' ? getEditorContent() : '';
            if (content && content.trim().length >= 300) {
                // 截取章节末尾 15% 的文本（至少 300 字，最多 500 字）
                var totalLen = content.length;
                var tailLen = Math.max(300, Math.min(500, Math.round(totalLen * 0.15)));
                var tailText = content.substring(Math.max(0, totalLen - tailLen));

                var res = await fetch('/api/projects/' + currentProjectId + '/ai/analyze-cliffhanger', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tail_text: tailText })
                });
                var data = await res.json();
                if (data && !data.error) {
                    hookScore = data.hook_score || 50;
                    cutQuality = data.cut_quality || '';
                    diagnosis = data.diagnosis || '';
                    suggestion = data.suggestion || '';
                    lastSentence = data.last_sentence || '';
                }
            } else {
                diagnosis = '文本过短（不足300字），无法进行断章钩子分析。';
                hookScore = 0;
                cutQuality = 'insufficient';
            }
        } catch(e) { /* silent fallback */ }
    } else {
        diagnosis = '打开章节后分析...';
        hookScore = 0;
    }

    // 渲染评分
    scoreEl.textContent = hookScore > 0 ? hookScore : '--';
    if (hookScore >= 70) scoreEl.style.color = 'var(--green)';
    else if (hookScore >= 45) scoreEl.style.color = 'var(--orange)';
    else scoreEl.style.color = 'var(--red)';

    // 渲染进度条
    bar.style.width = hookScore + '%';
    target.textContent = hookScore + '%';
    if (hookScore >= 70) { bar.style.background = 'var(--green)'; target.style.color = 'var(--green)'; }
    else if (hookScore >= 45) { bar.style.background = 'var(--orange)'; target.style.color = 'var(--orange)'; }
    else { bar.style.background = 'var(--red)'; target.style.color = 'var(--red)'; }

    // 状态标签
    if (statusEl) {
        if (cutQuality === 'excellent') { statusEl.textContent = '🎯 强力钩子'; statusEl.style.background = 'rgba(48,209,88,0.12)'; statusEl.style.color = 'var(--green)'; }
        else if (cutQuality === 'good') { statusEl.textContent = '👍 有效钩子'; statusEl.style.background = 'rgba(48,209,88,0.08)'; statusEl.style.color = 'var(--green)'; }
        else if (cutQuality === 'weak') { statusEl.textContent = '⚠️ 钩子微弱'; statusEl.style.background = 'rgba(245,158,11,0.12)'; statusEl.style.color = 'var(--orange)'; }
        else if (cutQuality === 'poor') { statusEl.textContent = '🔴 钩子缺失'; statusEl.style.background = 'rgba(220,38,38,0.15)'; statusEl.style.color = '#f87171'; }
        else { statusEl.textContent = '检测中...'; statusEl.style.background = ''; statusEl.style.color = 'var(--text-muted)'; }
    }

    // 切点质量描述
    if (cutEl) {
        if (cutQuality === 'excellent') cutEl.textContent = '切点精准：最后一句话卡在高潮处 ✓';
        else if (cutQuality === 'good') cutEl.textContent = '切点有效：结尾存在悬念元素，可进一步加强';
        else if (cutQuality === 'weak') cutEl.textContent = '切点偏弱：尾部缺乏强力悬念切断点';
        else if (cutQuality === 'poor') cutEl.textContent = '切点失败：结尾属于平淡日常收束';
        else cutEl.textContent = '';
        cutEl.style.color = cutQuality === 'excellent' ? 'var(--green)' : cutQuality === 'poor' ? 'var(--red)' : 'var(--text-muted)';
    }

    // 诊断文字
    if (detail) {
        detail.textContent = diagnosis;
    }

    // 建议文字
    if (suggestionEl && suggestion) {
        suggestionEl.style.display = 'block';
        suggestionEl.textContent = '💡 ' + suggestion;
        suggestionEl.style.background = hookScore < 45 ? 'rgba(245,158,11,0.08)' : 'rgba(99,102,241,0.06)';
    } else if (suggestionEl) {
        suggestionEl.style.display = 'none';
    }

    // 卡片样式
    if (card) {
        card.classList.remove('hook-excellent', 'hook-weak', 'hook-poor');
        if (cutQuality === 'excellent') card.classList.add('hook-excellent');
        else if (cutQuality === 'weak') card.classList.add('hook-weak');
        else if (cutQuality === 'poor') card.classList.add('hook-poor');
    }

    // Scene indicator (keep from old implementation)
    var sceneEl = document.getElementById('scene-indicator');
    if (sceneEl && chapters && chapters.length > 0) {
        var idx = chapters.findIndex(function(c) { return c.id === currentChapterId; });
        var phases = ['起','承','转','合'];
        var phaseIdx = idx >= 0 ? Math.min(Math.floor(idx / Math.max(1, chapters.length) * 4), 3) : 0;
        sceneEl.textContent = phases[phaseIdx];
    }
}

function updateClichéList() {
    scanClichés();  // 实时扫描引擎
}

// ===== 去 AI 味高级滤镜扫描引擎 =====
var DEAI_CLICHE_BANK_JS = {
    despair: {
        label: '🌫️ 绝望/抽象',
        words: ['仿佛', '那一刻', '史诗般', '如同一场饕餮盛宴', '博弈', '拉满',
            '如同', '宛若', '仿佛间', '恍若', '恰似', '犹如',
            '盛宴', '饕餮', '史诗', '天花板', '降维打击',
            '维度', '底层逻辑', '闭环', '赋能', '抓手'],
    },
    action: {
        label: '🎭 动作/表情',
        words: ['嘴角微微上扬', '眼神闪过一丝阴翳', '倒吸一口凉气',
            '眼中闪过一抹', '瞳孔微缩', '眉头微蹙', '眸光一黯',
            '嘴角勾起', '眼中寒光一闪', '面色一沉', '眼神一凛',
            '嘴角微扬', '眼中闪过一丝', '嘴角一抽', '眉头一皱',
            '微微一愣', '面色微变', '心中一沉', '心头一紧',
            '不由一愣', '心头一跳', '脸色一变', '神色一变'],
    },
    fluff: {
        label: '💬 废话文学',
        words: ['总而言之', '不可否认的是', '正如我们所知道的',
            '综上所述', '值得注意的是', '需要强调的是',
            '毫无疑问', '显而易见', '众所周知', '不言而喻',
            '不得不承认', '必须指出', '然而', '此外', '总之',
            '从某种程度上说', '在某种意义上'],
    },
    godview: {
        label: '👁️ 上帝视角',
        words: ['一切都', '从此以后', '命运的安排', '冥冥之中',
            '谁知道', '谁能想到', '令人意想不到的是',
            '这注定', '命运的齿轮', '历史的车轮',
            '多年以后', '回想起来', '后来才知道'],
    },
};

// Token 精算：去AI味套话扫描 — 纯前端 JS 正则，零 HTTP 请求、零云端成本
function scanClichés() {
    var list = document.getElementById('cliche-list');
    var summary = document.getElementById('cliche-summary');
    var statusEl = document.getElementById('cliche-status');
    var catContainer = document.getElementById('cliche-categories');
    if (!list) return;

    if (!currentChapterId) {
        list.innerHTML = '<span style="font-size:10px;color:var(--text-muted);">打开章节后扫描...</span>';
        if (catContainer) catContainer.innerHTML = '<span style="font-size:9px;color:var(--text-muted);">输入文字后自动扫描...</span>';
        if (summary) summary.textContent = '';
        if (statusEl) { statusEl.textContent = '待扫描'; statusEl.style.background = 'rgba(142,142,147,0.12)'; statusEl.style.color = 'var(--text-muted)'; }
        return;
    }

    var content = typeof getEditorContent === 'function' ? getEditorContent() : '';
    if (!content || !content.trim()) {
        resetClicheCard();
        return;
    }

    // 纯前端本地扫描 — 零 API 成本
    var localResult = localScanClichés(content);
    updateClicheCard(localResult);
}

function localScanClichés(content) {
    var hits = {};
    var bank = (typeof Evolution !== 'undefined' && Evolution.getMergedBlacklist) ? Evolution.getMergedBlacklist() : DEAI_CLICHE_BANK_JS;
    for (var catKey in bank) {
        var catData = bank[catKey];
        var catHits = [];
        for (var i = 0; i < catData.words.length; i++) {
            var word = catData.words[i];
            var count = (content.match(new RegExp(escRegex(word), 'g')) || []).length;
            if (count > 0) {
                catHits.push({ word: word, count: count });
            }
        }
        if (catHits.length > 0) {
            hits[catKey] = { label: catData.label, icon: '', total: catHits.reduce(function(s, h) { return s + h.count; }, 0), items: catHits };
        }
    }
    var total = 0;
    var catList = [];
    for (var k in hits) { total += hits[k].total; catList.push(k); }
    var summaryParts = [];
    var sorted = Object.keys(hits).sort(function(a, b) { return hits[b].total - hits[a].total; });
    for (var j = 0; j < sorted.length; j++) {
        var ck = sorted[j];
        summaryParts.push(hits[ck].label.split(' ')[0] + '：' + hits[ck].total + '次');
    }
    return {
        hits: hits,
        total: total,
        summary: summaryParts.length > 0 ? summaryParts.join(' | ') : '✓ 未命中套话黑名单',
        categories: catList,
    };
}

function escRegex(s) {
    return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateClicheCard(data) {
    var total = data.total || 0;
    var hits = data.hits || {};
    var catKeys = data.categories || [];

    // Status badge
    var statusEl = document.getElementById('cliche-status');
    if (statusEl) {
        if (total === 0) {
            statusEl.textContent = '✓ 干净';
            statusEl.style.background = 'rgba(48,209,88,0.12)';
            statusEl.style.color = 'var(--green)';
        } else if (total <= 3) {
            statusEl.textContent = '⚠ ' + total + ' 处';
            statusEl.style.background = 'rgba(245,158,11,0.12)';
            statusEl.style.color = 'var(--orange)';
        } else {
            statusEl.textContent = '🚫 ' + total + ' 处';
            statusEl.style.background = 'rgba(255,69,58,0.15)';
            statusEl.style.color = 'var(--red)';
        }
    }

    // Card class
    var card = document.getElementById('cliche-card');
    if (card) card.className = 'metric-card' + (total > 3 ? ' alert' : '');

    // Category badges with counts
    var catContainer = document.getElementById('cliche-categories');
    if (catContainer) {
        if (catKeys.length === 0) {
            catContainer.innerHTML = '<span style="font-size:9px;color:var(--text-muted);">✓ 所有维度干净</span>';
        } else {
            catContainer.innerHTML = catKeys.sort(function(a, b) { return (hits[b]||{total:0}).total - (hits[a]||{total:0}).total; }).map(function(ck) {
                var catData = hits[ck] || {};
                var bgColor = catData.total > 5 ? 'rgba(255,69,58,0.1)' : catData.total > 2 ? 'rgba(245,158,11,0.1)' : 'rgba(142,142,147,0.08)';
                var txtColor = catData.total > 5 ? 'var(--red)' : catData.total > 2 ? 'var(--orange)' : 'var(--text-secondary)';
                return '<span style="font-size:8px;padding:2px 6px;border-radius:10px;background:' + bgColor + ';color:' + txtColor + ';font-weight:600;">' +
                    escHtml(catData.label || '') + ' ×' + (catData.total || 0) + '</span>';
            }).join('');
        }
    }

    // Top offender words
    var list = document.getElementById('cliche-list');
    if (list) {
        // Flatten all hit words
        var allWords = [];
        for (var ck in hits) {
            var items = hits[ck].items || [];
            for (var i = 0; i < items.length; i++) {
                allWords.push({ word: items[i].word, count: items[i].count, cat: ck });
            }
        }
        allWords.sort(function(a, b) { return b.count - a.count; });
        var top = allWords.slice(0, 12);

        if (top.length === 0) {
            list.innerHTML = '';
        } else {
            list.innerHTML = top.map(function(w) {
                var sev = w.count >= 5 ? 'high' : w.count >= 2 ? 'mid' : 'low';
                var bg = sev === 'high' ? 'rgba(255,69,58,0.12)' : sev === 'mid' ? 'rgba(245,158,11,0.1)' : 'rgba(142,142,147,0.06)';
                var col = sev === 'high' ? 'var(--red)' : sev === 'mid' ? 'var(--orange)' : 'var(--text-secondary)';
                return '<span class="filter-badge" style="font-size:8px;padding:2px 6px;background:' + bg + ';color:' + col + ';border:1px solid ' + bg + ';">' +
                    escHtml(w.word) + (w.count > 1 ? ' ×' + w.count : '') + '</span>';
            }).join('');
        }
    }

    // Summary text
    var summaryEl = document.getElementById('cliche-summary');
    if (summaryEl) summaryEl.textContent = data.summary || '';
}

function resetClicheCard() {
    var list = document.getElementById('cliche-list');
    if (list) list.innerHTML = '';
    var catContainer = document.getElementById('cliche-categories');
    if (catContainer) catContainer.innerHTML = '<span style="font-size:9px;color:var(--text-muted);">输入文字后自动扫描...</span>';
    var summary = document.getElementById('cliche-summary');
    if (summary) summary.textContent = '';
    var statusEl = document.getElementById('cliche-status');
    if (statusEl) { statusEl.textContent = '待扫描'; statusEl.style.background = 'rgba(142,142,147,0.12)'; statusEl.style.color = 'var(--text-muted)'; }
    var card = document.getElementById('cliche-card');
    if (card) card.className = 'metric-card';
}

// ===== 剧情偏离度监控 =====
async function checkPlotDeviation() {
    var bar = document.getElementById('deviation-bar');
    var pctEl = document.getElementById('deviation-pct');
    var statusEl = document.getElementById('deviation-status');
    var msgEl = document.getElementById('deviation-message');
    var kwEl = document.getElementById('deviation-keywords');

    if (!bar || !currentProjectId) return;

    if (!currentChapterId) {
        bar.style.width = '0%'; bar.style.background = 'var(--text-muted)';
        if (pctEl) pctEl.textContent = '—';
        if (statusEl) { statusEl.textContent = '待检测'; statusEl.style.background = 'rgba(142,142,147,0.12)'; statusEl.style.color = 'var(--text-muted)'; }
        if (msgEl) msgEl.textContent = '选择章节后自动检测...';
        return;
    }

    try {
        var content = getEditorContent ? getEditorContent() : '';
        var res = await fetch('/api/projects/' + currentProjectId + '/ai/check-plot-deviation', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content, chapter_id: currentChapterId })
        });
        if (res.status === 403) {
            if (msgEl) msgEl.textContent = '此功能为【专业版】专属，用数据指导创作，大幅提升签约率';
            return;
        }
        var data = await res.json();

        // 更新进度条
        var pct = data.deviation || 0;
        bar.style.width = Math.max(2, pct) + '%';  // 最少 2% 视觉可见
        bar.style.background = data.color || 'var(--green)';

        if (pctEl) pctEl.textContent = (data.match_rate || 0) + '% 匹配';
        if (statusEl) {
            statusEl.textContent = data.status === 'safe' ? '✓ 锚定中' : data.status === 'watch' ? '⚠ 注意' : '🚨 脱轨';
            statusEl.style.color = data.color || 'var(--green)';
            statusEl.style.background = (data.color || 'var(--green)').replace(')', ',0.12)').replace('rgb', 'rgba');
            if (data.color && data.color.startsWith('var(')) {
                // Handle CSS variable colors
                var cssVar = data.color.replace('var(', '').replace(')', '');
                if (cssVar === '--green') statusEl.style.background = 'rgba(48,209,88,0.12)';
                else if (cssVar === '--orange') statusEl.style.background = 'rgba(245,158,11,0.12)';
                else if (cssVar === '--red') statusEl.style.background = 'rgba(255,69,58,0.12)';
            }
        }
        if (msgEl) msgEl.textContent = data.message || '';
        if (kwEl && data.matched_keywords && data.matched_keywords.length > 0) {
            kwEl.style.display = 'block';
            kwEl.textContent = '大纲锚点: ' + data.matched_keywords.slice(0, 8).join(' · ');
        } else if (kwEl) {
            kwEl.style.display = 'none';
        }

        // 对整个卡片做背景色预警
        var card = document.getElementById('deviation-card');
        if (card) {
            card.className = 'metric-card';
            if (data.status === 'danger') card.classList.add('warn');
        }
    } catch (e) {
        // silent — 检测失败不影响写作
        if (msgEl) msgEl.textContent = '检测服务暂不可用';
    }
}

// Load world items for lore monitor (called when opening worldbuilding slideout)
function ensureWorldItems() {
    if (window._worldItems && window._worldItems.length > 0) {
        renderWorldRules();
        return;
    }
    if (!currentProjectId) return;
    apiGet('/api/projects/' + currentProjectId + '/worldbuilding').then(function(res) {
        if (res && res.items) {
            window._worldItems = res.items;
            renderWorldRules();
        }
    }).catch(function() {});
}

async function saveCharacter() {
    const id = document.getElementById('char-edit-id').value;
    const data = { name:document.getElementById('char-name').value, gender:document.getElementById('char-gender').value, age:document.getElementById('char-age').value, personality:document.getElementById('char-personality').value, background:document.getElementById('char-background').value, goal:document.getElementById('char-goal').value, appearance:document.getElementById('char-appearance').value, notes:document.getElementById('char-notes').value };
    if (!data.name) { showToast('请输入角色名称','error'); return; }
    let res;
    if (id) res = await apiPut('/api/projects/'+currentProjectId+'/characters/'+id, data);
    else res = await apiPost('/api/projects/'+currentProjectId+'/characters', data);
    if (res) { closeModal(); await loadCharacters(); showToast(id?'角色已更新':'角色已创建','success'); }
}

function editCharacter(cid) {
    const ch = characters.find(c=>c.id===cid);
    if (!ch) return;
    document.getElementById('char-edit-id').value = ch.id;
    document.getElementById('char-name').value = ch.name||'';
    document.getElementById('char-gender').value = ch.gender||'';
    document.getElementById('char-age').value = ch.age||'';
    document.getElementById('char-personality').value = ch.personality||'';
    document.getElementById('char-background').value = ch.background||'';
    document.getElementById('char-goal').value = ch.goal||'';
    document.getElementById('char-appearance').value = ch.appearance||'';
    document.getElementById('char-notes').value = ch.notes||'';
    document.getElementById('char-modal-title').textContent = '编辑角色';
    // 重置知识账本 tab
    switchCharTab('basic');
    document.getElementById('knowledge-known-names').value = '';
    document.getElementById('knowledge-known-items').value = '';
    document.getElementById('knowledge-save-status').style.display = 'none';
    openModal('character-modal');
}

function newCharacter() {
    document.getElementById('char-edit-id').value='';
    document.getElementById('char-name').value='';
    document.getElementById('char-gender').value='';
    document.getElementById('char-age').value='';
    document.getElementById('char-personality').value='';
    document.getElementById('char-background').value='';
    document.getElementById('char-goal').value='';
    document.getElementById('char-appearance').value='';
    document.getElementById('char-notes').value='';
    document.getElementById('char-modal-title').textContent = '新建角色';
    // 重置知识账本 tab
    switchCharTab('basic');
    document.getElementById('knowledge-known-names').value = '';
    document.getElementById('knowledge-known-items').value = '';
    document.getElementById('knowledge-save-status').style.display = 'none';
    openModal('character-modal');
}

async function deleteCharacter(cid) {
    showConfirm('确定要删除这个角色吗?', async function(ok) {
        if (!ok) return;
        const res = await apiDelete('/api/projects/'+currentProjectId+'/characters/'+cid);
        if (res && res.success) { await loadCharacters(); showToast('角色已删除','info'); }
    });
}

// ── 角色知识账本 Tab ──
function switchCharTab(tab) {
    var basicBtn = document.getElementById('char-tab-basic');
    var knowBtn = document.getElementById('char-tab-knowledge');
    var basicPanel = document.getElementById('char-panel-basic');
    var knowPanel = document.getElementById('char-panel-knowledge');
    if (tab === 'basic') {
        basicPanel.style.display = 'block'; knowPanel.style.display = 'none';
        basicBtn.style.borderBottomColor = 'var(--accent)'; basicBtn.style.color = 'var(--accent)';
        knowBtn.style.borderBottomColor = 'transparent'; knowBtn.style.color = 'var(--text-muted)';
        basicBtn.classList.add('active'); knowBtn.classList.remove('active');
    } else {
        basicPanel.style.display = 'none'; knowPanel.style.display = 'block';
        basicBtn.style.borderBottomColor = 'transparent'; basicBtn.style.color = 'var(--text-muted)';
        knowBtn.style.borderBottomColor = 'var(--accent)'; knowBtn.style.color = 'var(--accent)';
        basicBtn.classList.remove('active'); knowBtn.classList.add('active');
        // 填充章节下拉
        populateKnowledgeChapterSelect();
    }
}

function populateKnowledgeChapterSelect() {
    var sel = document.getElementById('knowledge-chapter-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">— 选择章节 —</option>';
    if (window.chapters && window.chapters.length > 0) {
        window.chapters.forEach(function(ch) {
            sel.innerHTML += '<option value="' + ch.id + '">' + escHtml(ch.title) + '</option>';
        });
    }
}

async function loadKnowledgeForChapter() {
    var charId = document.getElementById('char-edit-id').value;
    var chapterId = document.getElementById('knowledge-chapter-select').value;
    if (!charId || !chapterId) return;

    try {
        var res = await fetch('/api/projects/' + currentProjectId + '/knowledge/' + charId);
        var records = await res.json();
        // 找到对应章节的记录
        var record = records.find(function(r) { return r.chapter_id === chapterId; });
        if (record) {
            var names = [];
            var items = [];
            try { names = JSON.parse(record.known_names || '[]'); } catch(e) {}
            try { items = JSON.parse(record.known_items || '[]'); } catch(e) {}
            document.getElementById('knowledge-known-names').value = names.join(', ');
            document.getElementById('knowledge-known-items').value = items.join(', ');
        } else {
            document.getElementById('knowledge-known-names').value = '';
            document.getElementById('knowledge-known-items').value = '';
        }
    } catch(e) { /* silent */ }
}

async function saveKnowledgeForChapter() {
    var charId = document.getElementById('char-edit-id').value;
    var chapterId = document.getElementById('knowledge-chapter-select').value;
    if (!charId) { showToast('请先保存角色基本信息', 'info'); return; }
    if (!chapterId) { showToast('请选择章节', 'info'); return; }

    var rawNames = document.getElementById('knowledge-known-names').value;
    var rawItems = document.getElementById('knowledge-known-items').value;
    var knownNames = rawNames ? rawNames.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
    var knownItems = rawItems ? rawItems.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];

    try {
        var res = await fetch('/api/projects/' + currentProjectId + '/knowledge/' + charId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapter_id: chapterId, known_names: knownNames, known_items: knownItems, known_events: [] })
        });
        var data = await res.json();
        var statusEl = document.getElementById('knowledge-save-status');
        if (data.success) {
            if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = '✓ 知识记录已保存'; statusEl.style.color = 'var(--green)'; }
            showToast('🧠 知识账本已更新', 'success');
        } else {
            if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = '✗ 保存失败'; statusEl.style.color = 'var(--red)'; }
        }
    } catch(e) { showToast('保存失败', 'error'); }
}

async function generateAllCharacters() {
    if (!currentProjectId) { showToast('请先打开项目','error'); return; }
    // 获取故事梗概（优先从大纲滑动面板读取）
    const premiseEl = document.getElementById('outline-premise');
    const premise = premiseEl ? premiseEl.value.trim() : '';
    if (!premise) { showToast('请先在「情节大纲」面板填写故事梗概','error'); openSlideout('outline'); return; }
    const genre = document.getElementById('outline-genre')?.value || '';
    const style = document.getElementById('outline-style')?.value || '';
    const model = getCurrentModel();

    showToast('AI 正在批量生成角色...', 'info');
    try {
        const res = await fetch('/api/projects/'+currentProjectId+'/ai/generate-characters-batch', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ premise, genre, style, model })
        });
        const data = await res.json();
        if (data.error) { showToast(data.error, 'error'); return; }
        if (data.imported > 0) {
            await loadCharacters();
            showToast('已生成 ' + data.imported + ' 个角色', 'success');
        } else {
            showToast('AI 未生成有效角色，请重试', 'error');
        }
    } catch(e) {
        showToast('生成失败，请重试', 'error');
    }
}

async function quickCreateCharacter() {
    if (!currentProjectId) { showToast('请先打开项目','error'); return; }
    const name = prompt('输入角色名称：', '主角');
    if (!name) return;
    // 用 AI 快速生成角色
    showToast('AI 正在生成角色...', 'info');
    try {
        const premiseEl = document.getElementById('outline-premise');
        const premise = premiseEl ? premiseEl.value.trim() : '';
        const genre = document.getElementById('outline-genre')?.value || '';
        const style = document.getElementById('outline-style')?.value || '';
        const res = await fetch('/api/projects/'+currentProjectId+'/ai/generate-character', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ name, premise, genre, style, model: getCurrentModel() })
        });
        const data = await res.json();
        if (data.error) { showToast(data.error, 'error'); return; }
        // 用返回数据创建角色
        let parsed = {};
        try {
            const cleaned = (data.content||'').replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
            parsed = JSON.parse(cleaned);
        } catch(e) { /* use raw text */ }
        const charData = {
            name: name,
            gender: parsed.gender || '',
            age: parsed.age || '',
            personality: parsed.personality || data.content || '',
            background: parsed.background || '',
            goal: parsed.goal || '',
            appearance: parsed.appearance || '',
            notes: ''
        };
        const cres = await apiPost('/api/projects/'+currentProjectId+'/characters', charData);
        if (cres) { await loadCharacters(); showToast('AI 角色已创建', 'success'); }
    } catch(e) {
        // Fallback: 手动创建
        newCharacter();
    }
}

function showChapterGoals() {
    showToast('写作目标功能：在「写作统计」中设定每日/长期目标', 'info');
    openSlideout('stats');
}

// ===== 大纲 =====
async function loadOutline() {
    if (!currentProjectId) return;
    outlineNodes = await apiGet('/api/projects/'+currentProjectId+'/outline') || [];
    renderOutlineTree();
}

function renderOutlineTree() {
    const container = document.getElementById('outline-tree');
    if (!outlineNodes || outlineNodes.length===0) {
        container.innerHTML = '<div class="empty-state" id="outline-empty-state"><div class="es-icon">🗺️</div><div class="es-title">暂无大纲</div><div class="es-hint">使用下方 AI 工具一键生成故事大纲</div></div>';
        // 显示引导提示
        const guide = document.getElementById('outline-guide');
        if (guide) guide.style.display = 'block';
        return;
    }
    // 有节点时隐藏引导
    const guide = document.getElementById('outline-guide');
    if (guide) guide.style.display = 'none';
    const roots = outlineNodes.filter(n=>!n.parent_id);
    container.innerHTML = roots.map(n=>renderOutlineNode(n)).join('');
}

function renderOutlineNode(node) {
    const kids = outlineNodes.filter(n=>n.parent_id===node.id);
    const indent = Math.min(node.level||0,3);
    const collapsed = window._outlineCollapsed && window._outlineCollapsed[node.id];
    let h = '<div class="outline-node lv'+indent+' '+(node.id===(window._selectedOutlineId||'')?'selected':'')+'" onclick="selectOutlineNode(\''+node.id+'\')" draggable="true" ondragstart="onOutlineDragStart(event,\''+node.id+'\')" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onOutlineDrop(event,\''+node.id+'\')">';
    h += '<span class="on-toggle" onclick="event.stopPropagation();toggleOutlineChildren(\''+node.id+'\')">';
    h += kids.length>0 ? (collapsed?'▶':'▼') : '　';
    h += '</span><span class="on-title">'+escHtml(node.title)+'</span></div>';
    if (kids.length>0 && !collapsed) h += kids.map(c=>renderOutlineNode(c)).join('');
    return h;
}

function selectOutlineNode(nid) {
    window._selectedOutlineId = nid;
    renderOutlineTree();
    const node = outlineNodes.find(n=>n.id===nid);
    if (node) document.getElementById('outline-node-content').value = node.content||'';
}

function toggleOutlineChildren(nid) {
    if (!window._outlineCollapsed) window._outlineCollapsed={};
    window._outlineCollapsed[nid] = !window._outlineCollapsed[nid];
    renderOutlineTree();
}

async function createOutlineNode(pid) {
    if (!currentProjectId) { showToast('请先打开项目','error'); return; }
    const title = prompt('请输入节点标题:');
    if (!title) return;
    const parent = outlineNodes.find(n=>n.id===pid);
    const level = parent ? (parent.level||0)+1 : 0;
    await apiPost('/api/projects/'+currentProjectId+'/outline', {title,parent_id:pid||null,level});
    await loadOutline(); showToast('大纲节点已创建','success');
}

async function saveOutlineNodeContent() {
    if (!window._selectedOutlineId) return;
    const content = document.getElementById('outline-node-content').value;
    const res = await apiPut('/api/projects/'+currentProjectId+'/outline/'+window._selectedOutlineId, {content});
    if (res && res.success) showToast('大纲内容已保存','success');
}

// ===== AI (续写增强 - 方向控制) =====
window._currentDirection = 'auto';

function setDirection(dir, btn) {
    window._currentDirection = dir;
    document.querySelectorAll('#direction-bar .dir-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showToast('写作方向已设为：' + btn.textContent, 'info');
}

async function continueWithDirection() {
    const input = document.getElementById('continue-prompt');
    const message = (input?.value || '').trim();
    if (input) input.value = '';

    const container = document.getElementById('ai-messages-continue');
    if (!container || !currentChapterId) { showToast('请先选择章节','error'); return; }

    // Show user message
    const ud = document.createElement('div');
    ud.className = 'ai-msg user';
    ud.innerHTML = '<div class="msg-role">我</div><div>'+escHtml(message||'(自动续写)')+'</div>';
    container.appendChild(ud);
    container.scrollTop = container.scrollHeight;

    // Loading
    const lel = document.getElementById('ai-loading-continue') || (() => {
        const l = document.createElement('div'); l.id='ai-loading-continue'; l.className='ai-loading';
        l.innerHTML='<div class="dot-flashing"></div><span>AI 思考中...</span>';
        container.parentNode.appendChild(l); return l;
    })();
    if (lel) lel.style.display = 'flex';
    
    try {
        const res = await fetch('/api/projects/'+currentProjectId+'/ai/continue-v2', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
                content: getEditorContent(),
                prompt: message || '请继续创作',
                direction: window._currentDirection,
                chapter_id: currentChapterId,
                model: getCurrentModel()
            })
        });
        const data = await res.json();
        if (lel) lel.style.display = 'none';

        const aiDiv = document.createElement('div');
        aiDiv.className = 'ai-msg assistant';
        aiDiv.innerHTML = '<div class="msg-role">AI 续写</div><div>'+escHtml(data.content||'').replace(/\n/g,'<br>')+'</div>';
        container.appendChild(aiDiv);

        // Quality warnings
        if (data.quality_warnings && data.quality_warnings.length > 0) {
            var warnDiv = document.createElement('div');
            warnDiv.className = 'ai-msg quality-warn';
            warnDiv.innerHTML = '<div class="msg-role">⚠️ 质量提醒</div><div>' +
                data.quality_warnings.map(function(w){ return '• '+escHtml(w); }).join('<br>') + '</div>';
            container.appendChild(warnDiv);
            showToast('续写完成，有 ' + data.quality_warnings.length + ' 条质量提醒', 'info');
        }

        container.scrollTop = container.scrollHeight;

        // 自动插入续写内容
        if (data.content && currentChapterId) {
            setEditorContent(getEditorContent() + '\n\n' + data.content);
            if (typeof Evolution !== 'undefined') Evolution.markAiInsert(data.content);
            onEditorInput();
        }
    } catch(e) {
        if (lel) lel.style.display = 'none';
        showToast('续写失败: '+e.message, 'error');
    }
}

// ===== 一致性检查 =====
async function checkConsistency() {
    if (!currentProjectId) { showToast('请先打开项目','error'); return; }
    
    const container = document.getElementById('ai-messages-continue');
    if (!container) return;
    
    // Loading
    const lel = document.getElementById('ai-loading-continue');
    if (lel) lel.style.display = 'flex';
    
    try {
        const res = await fetch('/api/projects/'+currentProjectId+'/ai/check-consistency', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ model: getCurrentModel() })
        });
        const data = await res.json();
        if (lel) lel.style.display = 'none';
        
        const aiDiv = document.createElement('div');
        aiDiv.className = 'ai-msg assistant';
        const content = data.content || '检查完成';
        // 高亮严重程度
        const formatted = escHtml(content)
            .replace(/🔴/g, '<span style="color:#f85149;">🔴</span>')
            .replace(/🟡/g, '<span style="color:var(--yellow);">🟡</span>')
            .replace(/🟢/g, '<span style="color:var(--green);">🟢</span>')
            .replace(/\n/g, '<br>');
        aiDiv.innerHTML = '<div class="msg-role">🔬 一致性检查</div><div>'+formatted+'</div>';
        container.appendChild(aiDiv);
        container.scrollTop = container.scrollHeight;
    } catch(e) {
        if (lel) lel.style.display = 'none';
        showToast('检查失败: '+e.message, 'error');
    }
}

// ===== 设定一致性检查 =====
async function checkSettingConsistency() {
    if (!currentChapterId) { showToast('请先选择章节', 'error'); return; }
    const content = getEditorContent();
    if (!content.trim()) { showToast('当前章节无内容', 'error'); return; }

    const container = document.getElementById('ai-messages-continue');
    if (!container) return;

    const lel = document.getElementById('ai-loading-continue');
    if (lel) lel.style.display = 'flex';

    try {
        const res = await fetch('/api/projects/' + currentProjectId + '/ai/check-setting-consistency', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ content, model: getCurrentModel() })
        });
        const data = await res.json();
        if (lel) lel.style.display = 'none';

        if (data.error) { showToast(data.error, 'error'); return; }

        // Parse JSON result
        let parsed;
        try {
            const cleaned = (data.content || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            parsed = JSON.parse(cleaned);
        } catch(e) {
            const aiDiv = document.createElement('div');
            aiDiv.className = 'ai-msg assistant';
            aiDiv.innerHTML = '<div class="msg-role">🔍 设定一致性</div><div style="font-size:12px;white-space:pre-wrap;">' + escHtml(data.content || '') + '</div>';
            container.appendChild(aiDiv);
            container.scrollTop = container.scrollHeight;
            return;
        }

        const score = parsed.score != null ? parsed.score : 50;
        let scoreColor, label;
        if (score >= 90) { scoreColor = 'var(--green)'; label = '高度吻合'; }
        else if (score >= 70) { scoreColor = '#f59e0b'; label = '基本一致'; }
        else { scoreColor = '#f85149'; label = '存在矛盾'; }

        let html = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">';
        html += '<div style="width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;border:3px solid ' + scoreColor + ';color:' + scoreColor + ';">' + score + '</div>';
        html += '<div><div style="font-size:14px;font-weight:600;color:' + scoreColor + ';">' + label + '</div>';
        html += '<div style="font-size:11px;color:var(--text-secondary);">' + escHtml(parsed.verdict || '') + '</div></div></div>';

        if (parsed.issues && parsed.issues.length > 0) {
            html += '<div style="margin-top:8px;"><strong style="font-size:12px;">⚠️ 发现 ' + parsed.issues.length + ' 个不一致问题：</strong>';
            parsed.issues.forEach(issue => {
                const sevColor = issue.severity === 'high' ? '#f85149' : issue.severity === 'medium' ? '#f59e0b' : '#888';
                html += '<div style="margin:6px 0;padding:8px 12px;background:var(--bg-input);border-radius:6px;border-left:3px solid ' + sevColor + ';">';
                html += '<div style="font-size:12px;font-weight:600;">' + escHtml(issue.setting || '') + '</div>';
                html += '<div style="font-size:11.5px;color:var(--text-secondary);margin-top:2px;">' + escHtml(issue.problem || '') + '</div>';
                if (issue.suggestion) html += '<div style="font-size:11px;color:var(--green);margin-top:2px;">💡 ' + escHtml(issue.suggestion) + '</div>';
                html += '</div>';
            });
            html += '</div>';
        } else {
            html += '<div style="margin-top:8px;color:var(--green);font-size:12px;">✅ 未发现与世界观设定的矛盾</div>';
        }

        if (parsed.summary) {
            html += '<div style="margin-top:8px;padding:10px;background:rgba(10,132,255,0.05);border-radius:6px;font-size:12px;color:var(--text-secondary);line-height:1.7;">' + escHtml(parsed.summary) + '</div>';
        }

        const aiDiv = document.createElement('div');
        aiDiv.className = 'ai-msg assistant';
        aiDiv.innerHTML = '<div class="msg-role">🔍 设定一致性检查</div><div>' + html + '</div>';
        container.appendChild(aiDiv);
        container.scrollTop = container.scrollHeight;
    } catch(e) {
        if (lel) lel.style.display = 'none';
        showToast('设定检查失败: ' + e.message, 'error');
    }
}

// ===== AI味检测 =====
async function detectAiFlavor() {
    if (!currentChapterId) { showToast('请先选择章节','error'); return; }
    
    const content = getEditorContent();
    if (!content.trim()) { showToast('当前章节无内容','error'); return; }

    const btn = document.getElementById('detect-ai-btn');
    const status = document.getElementById('detect-status');
    const resultDiv = document.getElementById('ai-flavor-result');
    
    if (btn) { btn.disabled = true; btn.textContent = '检测中...'; }
    if (status) status.textContent = '';
    
    try {
        const res = await fetch('/api/projects/'+currentProjectId+'/ai/detect-ai-flavor', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ content, model: getCurrentModel() })
        });
        const data = await res.json();
        
        if (btn) { btn.disabled = false; btn.textContent = '重新检测'; }
        
        // 解析 AI 返回的 JSON
        let parsed;
        try {
            const cleaned = (data.content||'').replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
            parsed = JSON.parse(cleaned);
        } catch(e) {
            if (status) status.textContent = '结果解析失败';
            if (resultDiv) {
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = '<pre style="font-size:11px;color:var(--text-secondary);white-space:pre-wrap;">'+escHtml(data.content||'')+'</pre>';
            }
            return;
        }
        
        // 渲染检测结果
        const score = parsed.score || 0;
        let scoreClass, scoreLabel;
        if (score < 30) { scoreClass = 'afs-low'; scoreLabel = '人味十足'; }
        else if (score < 60) { scoreClass = 'afs-mid'; scoreLabel = '有些AI味'; }
        else { scoreClass = 'afs-high'; scoreLabel = 'AI味较重'; }
        
        if (status) status.textContent = score + '% AI味';
        
        let html = '<div class="ai-flavor-score">';
        html += '<div class="afs-marker '+scoreClass+'">'+score+'%</div>';
        html += '<div><div class="afs-label">'+scoreLabel+'</div>';
        html += '<div class="afs-detail">'+escHtml(parsed.verdict||'')+'</div></div></div>';
        
        if (parsed.issues && parsed.issues.length > 0) {
            html += '<div class="afs-issues"><strong style="font-size:11.5px;">⚠️ 发现的问题：</strong>';
            parsed.issues.forEach(i => { html += '<div class="afs-issue">'+escHtml(i)+'</div>'; });
            html += '</div>';
        }
        
        if (parsed.highlights && parsed.highlights.length > 0) {
            html += '<div class="afs-highlights"><strong style="font-size:11.5px;">📍 标记段落：</strong><br>';
            parsed.highlights.forEach(h => {
                html += '<span class="afs-highlight" title="'+escHtml(h.reason||'')+'">'+escHtml((h.text||'').slice(0,50))+'...</span>';
            });
            html += '</div>';
        }
        
        if (parsed.suggestions && parsed.suggestions.length > 0) {
            html += '<div style="margin-top:8px;"><strong style="font-size:11.5px;color:var(--green);">💡 改进建议：</strong>';
            parsed.suggestions.forEach(s => { html += '<div class="afs-issue" style="color:var(--green);">'+escHtml(s)+'</div>'; });
            html += '</div>';
        }
        
        if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = html;
        }
    } catch(e) {
        if (btn) { btn.disabled = false; btn.textContent = '检测 AI 味'; }
        if (status) status.textContent = '检测失败';
        showToast('检测失败: '+e.message, 'error');
    }
}

// ===== AI 引导式写作 =====
window._guidedHistory = [];
window._guidedStep = 0;

async function startGuidedWriting() {
    if (!currentProjectId) { showToast('请先打开项目','error'); return; }
    
    const intro = document.querySelector('.guided-intro');
    const messages = document.getElementById('ai-messages-guided');
    const inputWrap = document.getElementById('guided-input-wrap');
    const loading = document.getElementById('ai-loading-guided');
    
    if (intro) intro.style.display = 'none';
    if (messages) messages.style.display = 'block';
    if (inputWrap) inputWrap.style.display = 'flex';
    
    window._guidedHistory = [];
    window._guidedStep = 0;
    
    // 添加初始消息
    if (messages) messages.innerHTML = '';
    
    if (loading) loading.style.display = 'flex';
    
    try {
        const res = await fetch('/api/projects/'+currentProjectId+'/ai/guided-write', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ step: 0, history: [], model: getCurrentModel() })
        });
        const data = await res.json();
        if (loading) loading.style.display = 'none';
        
        const aiDiv = document.createElement('div');
        aiDiv.className = 'ai-msg assistant';
        aiDiv.innerHTML = '<div class="msg-role">🧭 写作导师</div><div>'+escHtml(data.content||'').replace(/\n/g,'<br>')+'</div>';
        if (messages) { messages.appendChild(aiDiv); messages.scrollTop = messages.scrollHeight; }
        
        window._guidedHistory.push({ role: 'assistant', content: data.content });
        window._guidedStep = 1;
    } catch(e) {
        if (loading) loading.style.display = 'none';
        showToast('引导失败: '+e.message, 'error');
    }
}

async function continueGuided() {
    const input = document.getElementById('ai-input-guided');
    const answer = (input?.value || '').trim();
    if (!answer) return;
    if (input) input.value = '';
    
    const messages = document.getElementById('ai-messages-guided');
    const loading = document.getElementById('ai-loading-guided');
    
    // Show user answer
    const ud = document.createElement('div');
    ud.className = 'ai-msg user';
    ud.innerHTML = '<div class="msg-role">我</div><div>'+escHtml(answer)+'</div>';
    if (messages) { messages.appendChild(ud); messages.scrollTop = messages.scrollHeight; }
    
    window._guidedHistory.push({ role: 'user', content: answer });
    
    if (loading) loading.style.display = 'flex';
    
    try {
        const res = await fetch('/api/projects/'+currentProjectId+'/ai/guided-write', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ step: window._guidedStep, answer, history: window._guidedHistory, model: getCurrentModel() })
        });
        const data = await res.json();
        if (loading) loading.style.display = 'none';
        
        const aiDiv = document.createElement('div');
        aiDiv.className = 'ai-msg assistant';
        aiDiv.innerHTML = '<div class="msg-role">🧭 写作导师</div><div>'+escHtml(data.content||'').replace(/\n/g,'<br>')+'</div>';
        if (messages) { messages.appendChild(aiDiv); messages.scrollTop = messages.scrollHeight; }
        
        window._guidedHistory.push({ role: 'assistant', content: data.content });
        window._guidedStep++;
    } catch(e) {
        if (loading) loading.style.display = 'none';
        showToast('引导失败: '+e.message, 'error');
    }
}

async function saveGuidedSummary() {
    if (window._guidedHistory.length === 0) { showToast('请先进行引导对话','error'); return; }
    
    // 将整个引导对话历史作为上下文发送给AI生成方案
    const messages = document.getElementById('ai-messages-guided');
    const loading = document.getElementById('ai-loading-guided');
    
    if (loading) loading.style.display = 'flex';
    
    try {
        const res = await fetch('/api/projects/'+currentProjectId+'/ai/guided-write', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
                step: 99,
                answer: '请根据以上对话历史，生成一份完整的创作方案总结。包括：1) 故事类型与题材 2) 核心主题 3) 主要角色建议 4) 情节大纲框架 5) 写作建议。格式清晰，便于直接使用。',
                history: window._guidedHistory,
                model: getCurrentModel()
            })
        });
        const data = await res.json();
        if (loading) loading.style.display = 'none';
        
        const aiDiv = document.createElement('div');
        aiDiv.className = 'ai-msg assistant';
        aiDiv.innerHTML = '<div class="msg-role">📋 创作方案</div><div>'+escHtml(data.content||'').replace(/\n/g,'<br>')+'</div>';
        if (messages) { messages.appendChild(aiDiv); messages.scrollTop = messages.scrollHeight; }
        
        showToast('创作方案已生成！', 'success');
    } catch(e) {
        if (loading) loading.style.display = 'none';
        showToast('生成方案失败: '+e.message, 'error');
    }
}

function resetGuided() {
    window._guidedHistory = [];
    window._guidedStep = 0;
    
    const intro = document.querySelector('.guided-intro');
    const messages = document.getElementById('ai-messages-guided');
    const inputWrap = document.getElementById('guided-input-wrap');
    
    if (intro) intro.style.display = 'block';
    if (messages) { messages.style.display = 'none'; messages.innerHTML = ''; }
    if (inputWrap) inputWrap.style.display = 'none';
    showToast('已重置引导对话', 'info');
}

// ===== 一键成书 =====
async function generateBookPlan() {
    if (!currentProjectId) { showToast('请先打开项目', 'error'); return; }
    const premise = document.getElementById('book-gen-premise').value.trim();
    if (!premise) { showToast('请填写故事构思', 'error'); return; }
    const genre = document.getElementById('book-gen-genre').value;
    const style = document.getElementById('book-gen-style').value.trim();
    const chapterCount = parseInt(document.getElementById('book-gen-count').value) || 10;

    const btn = document.getElementById('book-gen-plan-btn');
    const origText = btn.textContent;
    btn.disabled = true; btn.textContent = '⏳ AI 正在构思章节计划...';

    try {
        const res = await apiPost('/api/projects/' + currentProjectId + '/ai/generate-book-plan', {
            premise, genre, style, chapter_count: chapterCount, model: getCurrentModel()
        });
        btn.disabled = false; btn.textContent = origText;

        if (!res || !res.content) { showToast('AI 生成失败，请重试', 'error'); return; }
        if (res.error) { showToast(res.error, 'error'); return; }

        let plan;
        try {
            const cleaned = res.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            plan = JSON.parse(cleaned);
        } catch (e1) {
            try {
                const match = res.content.match(/\[[\s\S]*\]/);
                if (match) {
                    let jsonStr = match[0];
                    jsonStr = jsonStr.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (m, inner) => {
                        return '"' + inner.replace(/[\x00-\x1f]/g, (c) => {
                            if (c === '\n') return '\\n';
                            if (c === '\r') return '\\r';
                            if (c === '\t') return '\\t';
                            return ' ';
                        }) + '"';
                    });
                    plan = JSON.parse(jsonStr);
                } else { throw new Error('No array'); }
            } catch (e2) {
                showToast('章节计划解析失败，请重试', 'error'); return;
            }
        }
        if (!Array.isArray(plan)) { showToast('章节计划解析失败，请重试', 'error'); return; }
        if (plan.length === 0) { showToast('未能生成章节计划，请更换构思后重试', 'error'); return; }

        window._bookGenPlan = plan;
        window._bookGenTotal = plan.length;
        document.getElementById('book-gen-plan-count').textContent = '共 ' + plan.length + ' 章';
        document.getElementById('book-gen-plan-list').innerHTML = plan.map((ch, i) =>
            '<div style="padding:10px 12px;margin-bottom:6px;background:var(--bg-surface2);border-radius:8px;border:1px solid var(--border);">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
            '<span style="color:var(--accent);font-weight:600;font-size:12px;">第' + (i + 1) + '章</span>' +
            '<span style="font-weight:600;font-size:13px;">' + escHtml(ch.title || '第' + (i + 1) + '章') + '</span></div>' +
            '<div style="font-size:12px;color:var(--text-muted);line-height:1.6;">' + escHtml(ch.summary || '') + '</div></div>'
        ).join('');

        document.getElementById('book-gen-phase-1').style.display = 'none';
        document.getElementById('book-gen-phase-2').style.display = 'block';
        showToast('章节计划已生成，共 ' + plan.length + ' 章', 'success');
    } catch (e) {
        btn.disabled = false; btn.textContent = origText;
        showToast('生成计划失败: ' + e.message, 'error');
    }
}

async function startBookGeneration() {
    if (!window._bookGenPlan || window._bookGenPlan.length === 0) { showToast('请先生成章节计划', 'error'); return; }
    window._bookGenRunning = true;
    window._bookGenIndex = 0;

    document.getElementById('book-gen-phase-1').style.display = 'none';
    document.getElementById('book-gen-phase-2').style.display = 'none';
    document.getElementById('book-gen-phase-3').style.display = 'block';
    document.getElementById('book-gen-phase-4').style.display = 'none';
    document.getElementById('book-gen-log').innerHTML = '';
    document.getElementById('book-gen-progress-fill').style.width = '0%';
    document.getElementById('book-gen-progress-text').textContent = '准备开始...';
    document.getElementById('book-gen-current-chapter').textContent = '';

    await generateNextChapter();
}

async function generateNextChapter() {
    if (!window._bookGenRunning) return;
    if (window._bookGenIndex >= window._bookGenTotal) { await finalizeBookGeneration(); return; }

    const plan = window._bookGenPlan[window._bookGenIndex];
    const chapterNum = window._bookGenIndex + 1;
    const log = document.getElementById('book-gen-log');
    const progressText = document.getElementById('book-gen-progress-text');
    const currentChapterEl = document.getElementById('book-gen-current-chapter');
    const loadingEl = document.getElementById('ai-loading-book-gen');
    const progressFill = document.getElementById('book-gen-progress-fill');

    progressText.textContent = '正在生成第 ' + chapterNum + ' / ' + window._bookGenTotal + ' 章';
    currentChapterEl.textContent = plan.title || ('第' + chapterNum + '章');
    if (loadingEl) loadingEl.style.display = 'flex';

    const logEntry = document.createElement('div');
    logEntry.style.cssText = 'padding:4px 8px;margin-bottom:3px;font-size:12px;';
    logEntry.innerHTML = '<span style="color:var(--accent);">⏳</span> 正在生成：' + escHtml(plan.title || '第' + chapterNum + '章') + '...';
    log.appendChild(logEntry);
    log.scrollTop = log.scrollHeight;

    try {
        const prevSummaries = window._bookGenPlan
            .slice(Math.max(0, window._bookGenIndex - 3), window._bookGenIndex)
            .map((p, i) => '第' + (Math.max(0, window._bookGenIndex - 3) + i + 1) + '章《' + (p.title || '') + '》：' + (p.summary || ''))
            .join('\n');

        const res = await apiPost('/api/projects/' + currentProjectId + '/ai/generate-book-chapter', {
            chapter_index: chapterNum,
            chapter_title: plan.title || ('第' + chapterNum + '章'),
            chapter_summary: plan.summary || '',
            previous_summary: prevSummaries,
            chapter_count: window._bookGenTotal,
            chapter_id: currentChapterId,
            model: getCurrentModel()
        });

        if (loadingEl) loadingEl.style.display = 'none';

        if (res && res.error) {
            logEntry.innerHTML = '<span style="color:var(--red);">❌</span> ' + escHtml(res.error);
            stopBookGeneration();
            return;
        }

        if (!res || !res.content) {
            logEntry.innerHTML = '<span style="color:var(--red);">❌</span> 第' + chapterNum + '章生成失败：AI 返回为空';
            window._bookGenIndex++;
            await generateNextChapter();
            return;
        }

        const saveRes = await apiPost('/api/projects/' + currentProjectId + '/chapters/from-ai', {
            title: plan.title || ('第' + chapterNum + '章'),
            content: res.content,
            source: 'ai'
        });

        if (saveRes && saveRes.id) {
            logEntry.innerHTML = '<span style="color:var(--green);">✅</span> 已保存：' +
                escHtml(plan.title || '第' + chapterNum + '章') + '（' + (saveRes.word_count || 0) + '字）';
        } else {
            logEntry.innerHTML = '<span style="color:var(--yellow);">⚠️</span> 第' + chapterNum + '章已生成但保存失败';
        }

        const pct = Math.round((window._bookGenIndex + 1) / window._bookGenTotal * 100);
        progressFill.style.width = pct + '%';
        window._bookGenIndex++;
        log.scrollTop = log.scrollHeight;
        await generateNextChapter();
    } catch (e) {
        if (loadingEl) loadingEl.style.display = 'none';
        logEntry.innerHTML = '<span style="color:var(--red);">❌</span> 第' + chapterNum + '章失败: ' + escHtml(e.message);
        window._bookGenIndex++;
        log.scrollTop = log.scrollHeight;
        await generateNextChapter();
    }
}

async function finalizeBookGeneration() {
    document.getElementById('ai-loading-book-gen').style.display = 'none';
    document.getElementById('book-gen-progress-fill').style.width = '100%';
    document.getElementById('book-gen-progress-text').textContent = '全部章节生成完毕！';
    document.getElementById('book-gen-current-chapter').textContent = '';
    await loadChapters();
    document.getElementById('book-gen-phase-3').style.display = 'none';
    document.getElementById('book-gen-phase-4').style.display = 'block';
    document.getElementById('book-gen-complete-desc').textContent = '已生成并保存 ' + window._bookGenTotal + ' 个章节。可在写作区继续编辑完善。';
    window._bookGenRunning = false;
    showToast('全书生成完成！共 ' + window._bookGenTotal + ' 章', 'success');
}

function stopBookGeneration() {
    if (!window._bookGenRunning) return;
    window._bookGenRunning = false;
    document.getElementById('ai-loading-book-gen').style.display = 'none';
    document.getElementById('book-gen-progress-text').textContent = '已停止（已生成 ' + window._bookGenIndex + ' 个章节）';
    const log = document.getElementById('book-gen-log');
    const stopEntry = document.createElement('div');
    stopEntry.style.cssText = 'padding:4px 8px;color:var(--yellow);font-size:12px;';
    stopEntry.textContent = '⏹ 已停止。' + window._bookGenIndex + ' 个章节已保存。';
    log.appendChild(stopEntry);
    log.scrollTop = log.scrollHeight;
    showToast('已停止生成', 'info');
}

function resetBookGen() {
    window._bookGenRunning = false;
    window._bookGenPlan = [];
    window._bookGenIndex = 0;
    window._bookGenTotal = 0;
    document.getElementById('book-gen-phase-1').style.display = 'block';
    document.getElementById('book-gen-phase-2').style.display = 'none';
    document.getElementById('book-gen-phase-3').style.display = 'none';
    document.getElementById('book-gen-phase-4').style.display = 'none';
    document.getElementById('book-gen-plan-list').innerHTML = '';
    document.getElementById('book-gen-log').innerHTML = '';
    document.getElementById('book-gen-progress-fill').style.width = '0%';
    document.getElementById('ai-loading-book-gen').style.display = 'none';
}

// ===== 小说转剧本 =====
async function convertToScript() {
    if (!currentProjectId) { showToast('请先打开项目', 'error'); return; }
    if (!chapters || chapters.length === 0) { showToast('项目中没有章节', 'error'); return; }

    const scriptType = document.getElementById('script-type').value;
    const btn = document.getElementById('script-convert-btn');
    const loading = document.getElementById('ai-loading-script');
    const resultDiv = document.getElementById('script-result');
    const contentDiv = document.getElementById('script-content-text');
    const emptyDiv = document.getElementById('script-empty');
    const actionsDiv = document.getElementById('script-actions');

    btn.disabled = true; btn.textContent = '⏳ 改编中...';
    if (loading) loading.style.display = 'flex';

    try {
        const res = await apiPost('/api/projects/' + currentProjectId + '/ai/convert-to-script', {
            script_type: scriptType,
            model: getCurrentModel()
        });

        btn.disabled = false; btn.textContent = '🎬 生成剧本';
        if (loading) loading.style.display = 'none';

        if (res && res.error) { showToast(res.error, 'error'); return; }

        const content = (res && res.content) ? res.content : '';
        if (!content) { showToast('AI 返回为空，请重试', 'error'); return; }

        // 高亮剧本格式
        let formatted = escHtml(content);
        formatted = formatted.replace(/\n/g, '<br>');
        // 场景标题
        formatted = formatted.replace(/(INT\.|EXT\.)[^<]*/g, '<span class="sc-scene">$&</span>');
        // 角色名（顶格大写/中文名后换行+缩进）
        formatted = formatted.replace(/^([一-鿿A-Z]{2,4})(<br>)/gm, '<span class="sc-char">$1</span>$2');
        // 舞台指示 【...】
        formatted = formatted.replace(/【([^】]+)】/g, '<span class="sc-direction">【$1】</span>');
        // 括号动作
        formatted = formatted.replace(/（([^）]+)）/g, '<span class="sc-action">（$1））</span>');
        // 集/幕标题
        formatted = formatted.replace(/(第[一二三四五六七八九十\d]+[集幕场])/g, '<span class="sc-act">$1</span>');

        contentDiv.innerHTML = formatted;
        resultDiv.style.display = 'block';
        if (emptyDiv) emptyDiv.style.display = 'none';
        if (actionsDiv) actionsDiv.style.display = 'flex';
        resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast('剧本生成完成！', 'success');
    } catch (e) {
        btn.disabled = false; btn.textContent = '🎬 生成剧本';
        if (loading) loading.style.display = 'none';
        showToast('剧本生成失败: ' + e.message, 'error');
    }
}

function exportScript() {
    const content = document.getElementById('script-content-text').textContent;
    if (!content) { showToast('请先生成剧本', 'error'); return; }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '剧本_' + new Date().toISOString().slice(0, 10) + '.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('剧本已下载', 'success');
}

// ===== 灵感 & 题材选择 =====
window._selectedGenre = '奇幻';
window._selectedIdeaMode = 'ideas';

function selectGenre(genre, btn) {
    window._selectedGenre = genre;
    document.querySelectorAll('.genre-card').forEach(b => b.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
    const sel = document.getElementById('genre-label');
    if (sel) sel.textContent = genre;
}

function selectIdeaMode(mode, btn) {
    window._selectedIdeaMode = mode;
    document.querySelectorAll('.idea-mode-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const sel = document.getElementById('mode-label');
    if (sel) sel.textContent = mode;
}

async function generateIdeas() {
    if (!currentProjectId) { showToast('请先打开项目','error'); return; }
    
    const container = document.getElementById('ai-messages-genre');
    const loading = document.getElementById('ai-loading-genre');
    const btn = document.getElementById('gen-ideas-btn');
    
    if (btn) { btn.disabled = true; btn.textContent = '生成中...'; }
    if (loading) loading.style.display = 'flex';
    
    try {
        const res = await fetch('/api/projects/'+currentProjectId+'/ai/idea-generator', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
                genre: window._selectedGenre,
                mode: window._selectedIdeaMode,
                context: (getEditorContent() || '').slice(0, 500),
                model: getCurrentModel()
            })
        });
        const data = await res.json();
        if (loading) loading.style.display = 'none';
        if (btn) { const modeSel = document.getElementById('mode-label'); const modeText = modeSel ? modeSel.textContent : '灵感'; btn.textContent = '为 '+window._selectedGenre+' 生成 '+modeText; }
        
        // Clear and show result
        if (container) {
            container.innerHTML = '';
            const aiDiv = document.createElement('div');
            aiDiv.className = 'ai-msg assistant';
            aiDiv.innerHTML = '<div class="msg-role">💡 AI 灵感</div><div>'+escHtml(data.content||'').replace(/\n/g,'<br>')+'</div>';
            container.appendChild(aiDiv);
            container.scrollTop = container.scrollHeight;
        }
    } catch(e) {
        if (loading) loading.style.display = 'none';
        if (btn) { btn.disabled = false; btn.textContent = '生成灵感'; }
        showToast('生成灵感失败: '+e.message, 'error');
    }
}
function aiChatSend() {
    sendAiMessage('chat', 'chat-input', 'ai-messages-chat');
}

async function sendAiMessage(mode, inputId, msgContainerId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const message = input.value.trim();
    if (!message && mode==='chat') return;
    input.value = '';
    const container = document.getElementById(msgContainerId);
    if (!container) return;

    // Show user msg
    const ud = document.createElement('div');
    ud.className = 'ai-msg user';
    ud.innerHTML = '<div class="msg-role">我</div><div>'+escHtml(message||'(自动)')+'</div>';
    container.appendChild(ud);
    container.scrollTop = container.scrollHeight;

    // Loading
    const lid = 'ai-loading-'+mode;
    let lel = document.getElementById(lid);
    if (!lel) { lel = document.createElement('div'); lel.id=lid; lel.className='ai-loading'; lel.innerHTML='<div class="dot-flashing"></div><span>AI 思考中...</span>'; container.parentNode.insertBefore(lel, container.nextSibling); }
    lel.style.display = 'flex';

    let apiUrl, payload;
    if (mode==='chat') {
        apiUrl = '/api/ai/chat';
        const msgs = getAiMessages('chat');
        msgs.push({role:'user',content:message||'你好'});
        payload = {messages:msgs, model:getCurrentModel()};
    } else if (mode==='continue') {
        if (!currentChapterId) { showToast('请先选择章节','error'); lel.style.display='none'; return; }
        apiUrl = '/api/projects/'+currentProjectId+'/ai/continue';
        payload = {content:getEditorContent(), prompt:message, chapter_id: currentChapterId, model:getCurrentModel()};
    } else if (mode==='polish') {
        if (!currentChapterId) { showToast('请先选择章节','error'); lel.style.display='none'; return; }
        apiUrl = '/api/projects/'+currentProjectId+'/ai/polish';
        payload = {content:getEditorContent(), instruction:message, chapter_id: currentChapterId, model:getCurrentModel()};
    } else if (mode==='deai') {
        if (!currentChapterId) { showToast('请先选择章节','error'); lel.style.display='none'; return; }
        apiUrl = '/api/projects/'+currentProjectId+'/ai/deai';
        payload = {content:getEditorContent(), chapter_id: currentChapterId, model:getCurrentModel()};
    } else if (mode==='brainstorm') {
        apiUrl = '/api/projects/'+currentProjectId+'/ai/brainstorm';
        payload = {topic:message, context:'', model:getCurrentModel()};
    }

    try {
        const res = await fetch(apiUrl, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        const data = await res.json();
        lel.style.display = 'none';
        const aiDiv = document.createElement('div');
        aiDiv.className = 'ai-msg assistant';
        const aiContent = data.content || '（AI 返回为空）';
        aiDiv.innerHTML = '<div class="msg-role">AI</div><div>'+escHtml(aiContent).replace(/\n/g,'<br>')+'</div>';
        container.appendChild(aiDiv);
        container.scrollTop = container.scrollHeight;
        if (mode==='chat') { const msgs = getAiMessages('chat'); msgs.push({role:'assistant',content:aiContent}); }
        if (mode==='continue' && currentChapterId) { setEditorContent(getEditorContent()+'\n'+aiContent); if (typeof Evolution !== 'undefined') Evolution.markAiInsert(aiContent); onEditorInput(); showToast('AI续写已插入','success'); }
        // 后台自动归类对话（仅 AI 对话模式）
        if (mode === 'chat' && currentProjectId) {
            trackConversation(message || '你好', aiContent);
        }
    } catch(e) {
        lel.style.display='none'; showToast('AI 请求失败: '+e.message,'error');
    }
}

function _getAiContent(msgContainerId) {
    const container = document.getElementById(msgContainerId);
    if (!container) return '';
    const msgs = container.querySelectorAll('.ai-msg.assistant');
    if (msgs.length===0) return '';
    const last = msgs[msgs.length-1].lastElementChild;
    return last ? last.textContent.trim() : '';
}

function insertAiResult(msgContainerId) {
    const text = _getAiContent(msgContainerId);
    if (text) { setEditorContent(getEditorContent()+'\n'+text); if (typeof Evolution !== 'undefined') Evolution.markAiInsert(text); onEditorInput(); showToast('AI内容已插入','success'); }
}

function replaceWithAiResult(msgContainerId) {
    const text = _getAiContent(msgContainerId);
    if (text) { setEditorContent(text); if (typeof Evolution !== 'undefined') Evolution.markAiInsert(text); onEditorInput(); showToast('内容已替换','success'); }
}

// ===== Bonus 1: AI 内容另存为章节 =====
async function saveAiAsChapter(msgContainerId) {
    if (!currentProjectId) { showToast('请先打开项目','error'); return; }
    const container = document.getElementById(msgContainerId);
    if (!container) return;
    const msgs = container.querySelectorAll('.ai-msg.assistant');
    if (msgs.length===0) return;
    const text = msgs[msgs.length-1].textContent.replace(/^AI.*?:/s,'').trim();
    if (!text) return;
    const title = prompt('请输入章节标题:', 'AI 生成 - 第'+(chapters.length+1)+'章');
    if (!title) return;
    const res = await apiPost('/api/projects/'+currentProjectId+'/chapters/from-ai', {title, content:text, source:'ai'});
    if (res && res.id) { await loadChapters(); selectChapter(res.id); showToast('AI 章节已保存','success'); }
}

// ===== 智能大纲生成（自动导入） =====
async function generateOutlineAI() {
    if (!currentProjectId) { showToast('请先打开项目','error'); return; }
    const premise = document.getElementById('outline-premise').value.trim();
    if (!premise) { showToast('请描述你的故事构思','error'); return; }
    const genre = document.getElementById('outline-genre').value;
    const style = document.getElementById('outline-style').value;

    const btn = document.getElementById('outline-gen-btn');
    const origText = btn.textContent;
    btn.disabled = true; btn.textContent = '⏳ AI 正在构思大纲...';

    try {
        const res = await apiPost('/api/projects/'+currentProjectId+'/outline/generate', {premise, genre, style, model: getCurrentModel()});
        if (!res || !res.content) { showToast('AI 生成失败，请重试','error'); return; }

        // 自动解析并导入
        const raw = res.content;
        let nodes;
        try {
            const cleaned = raw.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
            nodes = JSON.parse(cleaned);
            if (!Array.isArray(nodes)) nodes = [nodes];
        } catch(e) {
            // JSON 解析失败，按文本行解析
            const lines = raw.split('\n').filter(l => l.trim());
            nodes = [];
            let currentLv0 = null;
            for (const line of lines) {
                const trimmed = line.replace(/^[\s\-#\d\.、]*/, '').trim();
                if (!trimmed || trimmed.length < 2) continue;
                if (line.match(/^[卷部]/) || (!line.startsWith(' ') && !line.startsWith('\t') && !line.match(/^\d/))) {
                    nodes.push({level:0, title:trimmed, children:[]});
                    currentLv0 = nodes[nodes.length-1];
                } else if (currentLv0) {
                    const lvl = line.startsWith('    ') ? 2 : 1;
                    currentLv0.children.push({level:lvl, title:trimmed, children:[]});
                }
            }
        }

        if (nodes.length === 0) { showToast('未能解析大纲结构，请重试','error'); return; }

        const imp = await apiPost('/api/projects/'+currentProjectId+'/outline/import', {nodes});
        if (imp && imp.success) {
            await loadOutline();
            showToast('已生成 ' + imp.count + ' 个大纲节点', 'success');
            const guide = document.getElementById('outline-guide');
            if (guide) guide.style.display = 'none';

            // 自动生成世界观和角色
            autoGenerateWorldAndChars(premise, genre, style);
        }
    } finally {
        btn.disabled = false; btn.textContent = origText;
    }
}

async function autoGenerateWorldAndChars(premise, genre, style) {
    const projId = currentProjectId;
    const model = getCurrentModel();

    // 后台生成世界观（不阻塞）
    showToast('AI 正在自动构建世界观和角色...', 'info');
    try {
        const wbRes = await fetch('/api/projects/' + projId + '/ai/generate-worldbuilding', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ premise, genre, style, model })
        });
        const wbData = await wbRes.json();
        if (wbData.imported > 0) {
            showToast('已自动生成 ' + wbData.imported + ' 条世界观设定', 'success');
            if (typeof loadWorldItems === 'function') loadWorldItems();
        }
    } catch (e) { /* silent */ }

    // 批量生成角色
    try {
        const chRes = await fetch('/api/projects/' + projId + '/ai/generate-characters-batch', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ premise, genre, style, model })
        });
        const chData = await chRes.json();
        if (chData.imported > 0) {
            showToast('已自动生成 ' + chData.imported + ' 个角色', 'success');
            if (typeof loadCharacters === 'function') loadCharacters();
        }
    } catch (e) { /* silent */ }

    // 从大纲自动提取角色 + 剧情结构（主线/支线/卷结构）
    try {
        const syncRes = await fetch('/api/projects/' + projId + '/outline/auto-sync', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model })
        });
        const syncData = await syncRes.json();
        if (syncData.success) {
            if (syncData.characters_created > 0) {
                showToast('自动识别 ' + syncData.characters_created + ' 个角色并同步剧情结构', 'success');
                if (typeof loadCharacters === 'function') loadCharacters();
            }
            // 存储剧情结构到全局并显示
            window._plotStructure = syncData.plot_structure;
            if (typeof renderPlotStructure === 'function') {
                renderPlotStructure();
                var psv = document.getElementById('plot-structure-view');
                if (psv) psv.style.display = 'block';
            }
        }
    } catch (e) { /* silent */ }
}

// ===== 剧情走势图渲染 =====
function renderPlotStructure() {
    var ps = window._plotStructure;
    if (!ps) return;

    var container = document.getElementById('plot-structure-view');
    if (!container) return;

    var html = '<div class="ps-section">';
    // 主线
    if (ps.main_plot && ps.main_plot.name) {
        html += '<div class="ps-main"><div class="ps-label">📌 主线</div>';
        html += '<div class="ps-title">' + escHtml(ps.main_plot.name) + '</div>';
        html += '<div class="ps-desc">' + escHtml(ps.main_plot.description || '') + '</div>';
        if (ps.main_plot.stages && ps.main_plot.stages.length > 0) {
            html += '<div class="ps-stages">' + ps.main_plot.stages.map(function(s, i) {
                return '<span class="ps-stage">' + (i + 1) + '. ' + escHtml(s) + '</span>';
            }).join('') + '</div>';
        }
        html += '</div>';
    }
    // 支线
    if (ps.sub_plots && ps.sub_plots.length > 0) {
        html += '<div class="ps-subs"><div class="ps-label">🔀 支线</div>';
        ps.sub_plots.forEach(function(sp) {
            html += '<div class="ps-sub"><div class="ps-sub-name">' + escHtml(sp.name || '') + '</div>';
            html += '<div class="ps-sub-desc">' + escHtml(sp.description || '') + '</div>';
            if (sp.stages && sp.stages.length > 0) {
                html += '<div class="ps-stages">' + sp.stages.map(function(s) {
                    return '<span class="ps-stage sm">' + escHtml(s) + '</span>';
                }).join('') + '</div>';
            }
            html += '</div>';
        });
        html += '</div>';
    }
    // 卷结构
    if (ps.volume_structure && ps.volume_structure.length > 0) {
        html += '<div class="ps-vols"><div class="ps-label">📚 卷结构</div>';
        ps.volume_structure.forEach(function(v) {
            html += '<div class="ps-vol"><span class="ps-vol-name">' + escHtml(v.title || '') + '</span>';
            html += '<span class="ps-vol-ch">（约' + (v.chapter_count || 0) + '章）</span>';
            html += '<div class="ps-vol-summary">' + escHtml(v.summary || '') + '</div></div>';
        });
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

// 大纲引导提示
function showOutlineGuide() {
    const guide = document.getElementById('outline-guide');
    if (guide) {
        guide.style.display = 'block';
        guide.scrollIntoView({behavior:'smooth',block:'center'});
    }
}

function dismissOutlineGuide() {
    const guide = document.getElementById('outline-guide');
    if (guide) guide.style.display = 'none';
}

function importOutlineFromAI() {
    generateChaptersFromOutline(false);
}

async function generateChaptersFromOutline(withAI) {
    if (!currentProjectId) { showToast('请先打开项目', 'error'); return; }
    if (!outlineNodes || outlineNodes.length === 0) { showToast('请先生成大纲', 'error'); return; }

    // Flatten outline tree into ordered list
    var flat = [];
    function walk(nodes, depth) {
        nodes.forEach(function(n) {
            flat.push({id: n.id, title: n.title, content: n.content || '', depth: depth});
            if (n.children && n.children.length > 0) walk(n.children, depth + 1);
        });
    }
    walk(outlineNodes, 0);

    if (flat.length === 0) { showToast('大纲为空', 'error'); return; }

    var btn = document.getElementById('outline-to-chapters-btn');
    if (btn) { btn.disabled = true; btn.textContent = '生成中...'; }

    var created = 0;
    var total = flat.length;
    for (var i = 0; i < flat.length; i++) {
        var node = flat[i];
        var title = (node.depth > 0 ? '  '.repeat(node.depth) : '') + (node.title || '未命名');

        if (withAI) {
            // Generate AI content for this chapter
            try {
                var ctx = flat.slice(0, i).map(function(n) { return n.title; }).join(' → ');
                var aiRes = await fetch('/api/projects/' + currentProjectId + '/ai/generate-book-chapter', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        chapter_index: i + 1,
                        chapter_title: node.title,
                        chapter_summary: node.content || node.title,
                        previous_summary: ctx || '故事开篇',
                        chapter_count: total,
                        chapter_id: null,
                        model: getCurrentModel()
                    })
                });
                var aiData = await aiRes.json();
                if (aiData && aiData.content) {
                    await apiPost('/api/projects/' + currentProjectId + '/chapters/from-ai', {
                        title: node.title,
                        content: aiData.content,
                        source: 'ai-outline'
                    });
                }
            } catch(e) {
                // Fallback: create empty chapter
                await apiPost('/api/projects/' + currentProjectId + '/chapters', {title: node.title});
            }
        } else {
            // Create empty chapter with outline node title
            await apiPost('/api/projects/' + currentProjectId + '/chapters', {title: node.title});
        }
        created++;
    }

    if (btn) { btn.disabled = false; btn.textContent = '📝 转为章节正文'; }
    await loadChapters();
    renderStoryTree();
    showToast('✅ 已从大纲创建 ' + created + ' 个章节' + (withAI ? '（含AI生成内容）' : '，选中章节后 Ctrl+Enter 续写'), 'success');
}

// ===== 统计 =====
async function loadStats() {
    if (!currentProjectId) return;
    const stats = await apiGet('/api/projects/'+currentProjectId+'/stats');
    if (!stats) return;
    const tw1 = document.getElementById('stat-total-words-2'); if (tw1) tw1.textContent = (stats.total_words||0).toLocaleString();
    const cc1 = document.getElementById('stat-chapters-2'); if (cc1) cc1.textContent = stats.chapter_count||0;
    const td1 = document.getElementById('stat-today-2'); if (td1) td1.textContent = (stats.chars_added||0).toLocaleString();
    const goals = await apiGet('/api/projects/'+currentProjectId+'/goals');
    if (goals && goals.length>0) renderGoals(goals);
}

function updateStats() {
    if (!chapters) return;
    const total = chapters.reduce((s,ch)=>s+(ch.word_count||0),0);
    const twu = document.getElementById('stat-total-words-2'); if (twu) twu.textContent = total.toLocaleString();
    const ccu = document.getElementById('stat-chapters-2'); if (ccu) ccu.textContent = chapters.length;
}

function renderGoals(goals) {
    const c = document.getElementById('goals-list');
    if (!goals || goals.length===0) { c.innerHTML='<div class="empty-state"><div class="es-desc">暂无写作目标</div></div>'; return; }
    c.innerHTML = goals.map(g => {
        const pct = g.target_value>0 ? Math.min(100,Math.round(g.current_value/g.target_value*100)) : 0;
        return '<div class="goal-card"><div class="gc-header"><span class="gc-title">'+(g.goal_type==='daily'?'每日目标':'长期目标')+'</span><span class="gc-pct">'+pct+'%</span></div><div class="gc-bar"><div class="gc-bar-fill" style="width:'+pct+'%"></div></div><div class="gc-detail">'+(g.current_value||0)+' / '+(g.target_value||0)+' 字</div></div>';
    }).join('');
}

async function saveGoal() {
    if (!currentProjectId) return;
    const type = document.getElementById('goal-type').value;
    const target = parseInt(document.getElementById('goal-value').value)||500;
    const res = await apiPost('/api/projects/'+currentProjectId+'/goals', {goal_type:type,target_value:target});
    if (res && res.id) { closeModal(); await loadStats(); showToast('目标已设定','success'); }
}

// ===== 自定义确认对话框 =====
window._confirmResolve = null;
function showConfirm(message, onOk) {
    var modal = document.getElementById('confirm-modal');
    var title = document.getElementById('confirm-title');
    var okBtn = document.getElementById('confirm-ok-btn');
    var cancelBtn = document.getElementById('confirm-cancel-btn');
    title.textContent = message;
    modal.style.display = 'flex';
    okBtn.focus();
    window._confirmResolve = onOk;
    var cleanup = function() {
        modal.style.display = 'none';
        okBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
    };
    var onConfirm = function() { cleanup(); if (window._confirmResolve) window._confirmResolve(true); };
    var onCancel = function() { cleanup(); if (window._confirmResolve) window._confirmResolve(false); };
    okBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
}

// ===== Modal/Export =====
function openModal(mid) { document.getElementById(mid).style.display='flex'; }
function closeModal() {
    document.querySelectorAll('.modal-overlay').forEach(el => el.style.display='none');
    // 关闭时重置新建项目模态框
    const nm = document.getElementById('new-project-name');
    const nd = document.getElementById('new-project-desc');
    const ng = document.getElementById('new-project-genre');
    if (nm) nm.value = '';
    if (nd) nd.value = '';
    if (ng) ng.value = '';
    document.querySelectorAll('.genre-chip-new.active,.genre-chip.genre-chip-active').forEach(b => b.classList.remove('active','genre-chip-active'));
}

function exportProject(format) {
    if (!currentProjectId) { showToast('请先打开项目','error'); return; }
    window.open('/api/projects/'+currentProjectId+'/export/'+format, '_blank');
    showToast('正在导出...','info');
}

// ===== Feature A: 智能导入（全局拖拽） =====
let _importData = null;
let _importFilename = null;

(function initDropzone() {
    const overlay = document.getElementById('dropzone-overlay');
    if (!overlay) return;
    
    // 全局 drag/drop 事件
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        document.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
    });
    
    let _dragCounter = 0;
    document.addEventListener('dragenter', () => { _dragCounter++; overlay.classList.add('active'); });
    document.addEventListener('dragleave', () => { _dragCounter--; if (_dragCounter <= 0) { _dragCounter = 0; overlay.classList.remove('active'); } });
    
    document.addEventListener('drop', e => {
        overlay.classList.remove('active');
        _dragCounter = 0;
        const files = e.dataTransfer.files;
        if (files.length > 0) handleDroppedFile(files[0]);
    });
    
    // 也支持 overlay 上的点击选择文件
    overlay.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.md,.docx';
        input.onchange = () => { if (input.files.length > 0) handleDroppedFile(input.files[0]); };
        input.click();
    });
})();

async function handleDroppedFile(file) {
    if (!currentProjectId) { showToast('请先打开一个项目','error'); return; }
    
    showToast('正在上传文件...', 'info');
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const resp = await fetch('/api/projects/'+currentProjectId+'/import/upload', { method:'POST', body: formData });
        const data = await resp.json();
        if (data.error) { showToast(data.error, 'error'); return; }
        
        _importData = data;
        _importFilename = data.filename || file.name;
        
        // 显示 AI 分析中
        openModal('import-modal');
        document.getElementById('import-summary').innerHTML = '<span style="color:var(--accent);">🤖 AI 正在分析...</span>';
        document.getElementById('import-preview').innerHTML = '<div class="dot-flashing" style="margin:20px auto;"></div>';
        document.getElementById('import-checkboxes').innerHTML = '';
        document.getElementById('import-apply-btn').disabled = true;
        document.getElementById('import-error').style.display = 'none';
        
        // AI 分析
        const analyzeResp = await fetch('/api/projects/'+currentProjectId+'/import/analyze', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ text: data.content, filename: data.filename, model: getCurrentModel() })
        });
        const analyzeData = await analyzeResp.json();
        
        if (analyzeData.analysis) {
            renderImportPreview(analyzeData.analysis);
        } else {
            document.getElementById('import-summary').textContent = '⚠️ AI 分析失败，请重试';
        }
    } catch(e) {
        showToast('导入失败: '+e.message, 'error');
        closeModal();
    }
}

function renderImportPreview(rawAnalysis) {
    let parsed;
    try {
        const cleaned = rawAnalysis.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
    } catch(e) {
        document.getElementById('import-summary').textContent = '⚠️ AI 分析结果解析失败';
        document.getElementById('import-preview').innerHTML = '<pre style="white-space:pre-wrap;font-size:11px;color:var(--text-secondary);">'+escHtml(rawAnalysis)+'</pre>';
        return;
    }
    
    const type = parsed.type || 'mixed';
    const typeNames = {outline:'大纲结构', characters:'角色设定', chapters:'章节正文', mixed:'混合类型'};
    const confidence = Math.round((parsed.confidence || 0.8) * 100);
    
    document.getElementById('import-summary').innerHTML = 
        '识别类型：<strong style="color:var(--accent);">'+ (typeNames[type] || type) + '</strong> · 置信度：'+confidence+'% · 文件：'+escHtml(_importFilename);
    
    // 渲染预览
    let preview = '';
    let checkboxes = '';
    
    if (parsed.outline && parsed.outline.length > 0) {
        preview += '<div style="margin-bottom:12px;"><strong style="color:var(--green);">📋 大纲节点 ('+parsed.outline.length+')</strong></div>';
        function renderOutline(nodes, indent=0) {
            return nodes.map(n => {
                const kids = n.children || [];
                return '<div style="padding:2px 0 2px '+(indent*16)+'px;font-size:12px;">'+(indent>0?'├ ':'')+escHtml(n.title)+(kids.length>0?' <span style="color:var(--text-muted);">('+kids.length+'子节点)</span>':'')+'</div>' + renderOutline(kids, indent+1);
            }).join('');
        }
        preview += renderOutline(parsed.outline.slice(0, 20));
        checkboxes += '<label class="import-check"><input type="checkbox" checked onchange="updateImportSelection()" data-type="outline"> 导入大纲节点</label>';
    }
    
    if (parsed.characters && parsed.characters.length > 0) {
        preview += '<div style="margin:12px 0 8px;"><strong style="color:var(--green);">👤 角色 ('+parsed.characters.length+')</strong></div>';
        preview += parsed.characters.slice(0, 15).map(c => 
            '<div style="padding:4px 0;font-size:12px;">'+escHtml(c.name)+(c.role?' <span style="color:var(--text-muted);">('+escHtml(c.role)+')</span>':'')+(c.personality?' - '+escHtml(c.personality.slice(0,40)):'')+'</div>'
        ).join('');
        checkboxes += '<label class="import-check"><input type="checkbox" checked onchange="updateImportSelection()" data-type="characters"> 导入角色</label>';
    }
    
    if (parsed.chapters && parsed.chapters.length > 0) {
        preview += '<div style="margin:12px 0 8px;"><strong style="color:var(--green);">📄 章节 ('+parsed.chapters.length+')</strong></div>';
        preview += parsed.chapters.slice(0, 10).map(ch => 
            '<div style="padding:2px 0;font-size:12px;">· '+escHtml(ch.title)+' <span style="color:var(--text-muted);">('+(ch.content||'').length+'字)</span></div>'
        ).join('');
        checkboxes += '<label class="import-check"><input type="checkbox" checked onchange="updateImportSelection()" data-type="chapters"> 导入章节</label>';
    }
    
    if (!preview) {
        preview = '<div style="color:var(--text-muted);text-align:center;padding:20px;">未识别到可导入的内容</div>';
    }
    
    document.getElementById('import-preview').innerHTML = preview;
    document.getElementById('import-checkboxes').innerHTML = checkboxes || '<div style="color:var(--text-muted);font-size:12px;">无可导入项</div>';
    document.getElementById('import-apply-btn').disabled = !preview;
    
    // 存储解析结果
    window._parsedImport = parsed;
}

function updateImportSelection() {
    // 选择状态由 checkbox 自行管理
}

async function applyImport() {
    if (!window._parsedImport || !currentProjectId) return;
    const parsed = window._parsedImport;
    
    const items = {};
    document.querySelectorAll('#import-checkboxes input[type=checkbox]').forEach(cb => {
        if (cb.checked) items[cb.dataset.type] = parsed[cb.dataset.type] || [];
    });
    
    if (Object.keys(items).length === 0) { showToast('请至少选择一项导入','error'); return; }
    
    const btn = document.getElementById('import-apply-btn');
    btn.disabled = true; btn.textContent = '导入中...';
    
    try {
        const resp = await fetch('/api/projects/'+currentProjectId+'/import/apply', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ items })
        });
        const data = await resp.json();
        if (data.success) {
            const r = data.imported;
            let msg = [];
            if (r.outline > 0) msg.push(r.outline+'个大纲节点');
            if (r.characters > 0) msg.push(r.characters+'个角色');
            if (r.chapters > 0) msg.push(r.chapters+'个章节');
            closeModal();
            await Promise.all([loadChapters(), loadCharacters(), loadOutline(), loadWorldItems()]);
            showToast('已导入：'+msg.join('、'), 'success');
        }
    } catch(e) {
        document.getElementById('import-error').textContent = '导入失败: '+e.message;
        document.getElementById('import-error').style.display = 'block';
    }
    btn.disabled = false; btn.textContent = '📥 确认导入';
}

// ===== Feature B: 会员系统 =====
async function loadBalanceStatus() {
    try {
        const [res, tierRes] = await Promise.all([
            apiGet('/api/license/status'),
            fetch('/api/user/tier').then(r => r.json()).catch(() => null)
        ]);
        if (!res) return;
        window._balanceStatus = res;
        window._tierInfo = tierRes;
        userTier = normalizeUserTier(tierRes);
        window._predictRetentionUsed = (tierRes && tierRes.predict_retention_used) || 0;
        window._predictRetentionLimit = tierRes && tierRes.predict_retention_limit;

        // VIP 页面状态
        const statusBadge = document.getElementById('vip-status-badge');
        if (statusBadge) {
            const tierName = tierRes ? tierRes.name : (res.has_recharged ? '已充值用户' : '免费版');
            statusBadge.textContent = tierName;
            statusBadge.style.background = res.has_recharged ? 'rgba(48,209,88,0.2)' : 'var(--bg-surface2)';
            statusBadge.style.color = res.has_recharged ? 'var(--green)' : 'var(--text-secondary)';
        }

        const balEl = document.getElementById('vip-balance');
        if (balEl) balEl.textContent = '¥' + (res.balance || 0).toFixed(2);
        const rechargedEl = document.getElementById('vip-total-recharged');
        if (rechargedEl) rechargedEl.textContent = '¥' + (tierRes ? tierRes.total_recharged : (res.total_recharged || 0)).toFixed(2);
        const tierNameEl = document.getElementById('vip-tier-name');
        if (tierNameEl && tierRes) tierNameEl.textContent = tierRes.name;

        // 更新套餐卡片高亮
        if (tierRes) {
            document.querySelectorAll('.pricing-card').forEach(card => {
                card.classList.remove('activated');
                const btn = card.querySelector('.pc-buy-btn');
                if (btn) { btn.disabled = false; btn.textContent = btn.getAttribute('data-original-text') || btn.textContent; }
            });
            const tierMap = { free: 0, basic: 1, pro: 2, premium: 3 };
            const idx = tierMap[tierRes.id] || 0;
            const cards = document.querySelectorAll('#tier-pricing-grid .pricing-card');
            if (cards[idx]) {
                cards[idx].classList.add('activated');
                const btn = cards[idx].querySelector('.pc-buy-btn');
                if (btn) {
                    if (!btn.getAttribute('data-original-text')) btn.setAttribute('data-original-text', btn.textContent);
                    btn.textContent = '当前方案';
                    btn.disabled = true;
                }
            }
        }
    } catch(e) { /* ignore */ }
}

async function loadBalance() {
    try {
        const res = await apiGet('/api/balance');
        if (!res) return;
        // Balance state stored in window for other components
        window._balance = res;
        if (res.balance < 5 && res.free_daily_remaining <= 0 && res.has_recharged) {
            showToast('余额不足，请及时充值', 'warning');
        }
    } catch(e) { /* ignore */ }
}

async function loadTransactionHistory() {
    const list = document.getElementById('transaction-list');
    if (!list) return;
    try {
        const res = await apiGet('/api/transactions?limit=30');
        if (!res || !res.transactions || res.transactions.length === 0) {
            list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;">暂无交易记录</div>';
            return;
        }
        list.innerHTML = '<div class="txn-header"><span>时间</span><span>模型</span><span>Tokens</span><span>消耗</span></div>' +
            res.transactions.map(t => {
                const time = (t.created_at || '').slice(5, 16).replace('T', ' ');
                const modelName = {deepseek:'DeepSeek',gemini:'Gemini',claude:'Claude'}[t.model] || t.model;
                return '<div class="txn-row"><span>' + time + '</span><span>' + modelName + '</span><span>' + (t.total_tokens || 0) + '</span><span style="color:#ff453a;">-¥' + (t.cost || 0).toFixed(4) + '</span></div>';
            }).join('');
    } catch(e) {
        list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">加载失败</div>';
    }
}

// ===== 充值流程 =====
window._purchaseOrderId = null;

async function startRecharge(packageId) {
    try {
        const res = await fetch('/api/purchase/create', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ package: packageId })
        });
        const data = await res.json();

        window._purchaseOrderId = data.order_id;
        document.getElementById('purchase-tier-name').textContent = data.label || '充值';
        document.getElementById('purchase-amount').textContent = data.amount;
        document.getElementById('purchase-amount2').textContent = data.amount;
        document.getElementById('purchase-order-id').textContent = data.order_id;

        await loadPaymentInfo();
        document.getElementById('purchase-step-pay').style.display = 'block';
        document.getElementById('purchase-step-done').style.display = 'none';
        openModal('purchase-modal');
    } catch(e) {
        showToast('创建订单失败: '+e.message, 'error');
    }
}

function startCustomRecharge() {
    const amount = prompt('输入充值金额（元）：', '50');
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return;
    startRechargeCustom(parseFloat(amount));
}

async function startRechargeCustom(amount) {
    try {
        const res = await fetch('/api/purchase/create', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ package: 'custom', amount: amount })
        });
        const data = await res.json();
        window._purchaseOrderId = data.order_id;
        document.getElementById('purchase-tier-name').textContent = data.label || '充值';
        document.getElementById('purchase-amount').textContent = data.amount;
        document.getElementById('purchase-amount2').textContent = data.amount;
        document.getElementById('purchase-order-id').textContent = data.order_id;
        await loadPaymentInfo();
        document.getElementById('purchase-step-pay').style.display = 'block';
        document.getElementById('purchase-step-done').style.display = 'none';
        openModal('purchase-modal');
    } catch(e) {
        showToast('创建订单失败: '+e.message, 'error');
    }
}

async function loadPaymentInfo() {
    try {
        const pi = await (await fetch('/api/payment-info')).json();
        let hasPayment = false;
        if (pi.wechat_qr) {
            document.getElementById('purchase-wechat-qr').src = pi.wechat_qr;
            document.getElementById('purchase-wechat-qr-wrap').style.display = 'block';
            hasPayment = true;
        } else { document.getElementById('purchase-wechat-qr-wrap').style.display = 'none'; }
        if (pi.alipay_qr) {
            document.getElementById('purchase-alipay-qr').src = pi.alipay_qr;
            document.getElementById('purchase-alipay-qr-wrap').style.display = 'block';
            hasPayment = true;
        } else { document.getElementById('purchase-alipay-qr-wrap').style.display = 'none'; }
        if (pi.bank_account) {
            document.getElementById('purchase-bank-name').textContent = pi.bank_name;
            document.getElementById('purchase-bank-account').textContent = pi.bank_account;
            document.getElementById('purchase-bank-holder').textContent = pi.bank_holder;
            document.getElementById('purchase-bank-info').style.display = 'block';
            hasPayment = true;
        } else { document.getElementById('purchase-bank-info').style.display = 'none'; }
        if (!hasPayment) {
            document.getElementById('purchase-no-payment').style.display = 'block';
            const contact = [];
            if (pi.contact_wechat) contact.push('微信: '+pi.contact_wechat);
            if (pi.contact_email) contact.push('邮箱: '+pi.contact_email);
            document.getElementById('purchase-contact-info').textContent = contact.join(' | ') || '暂无联系方式';
        } else { document.getElementById('purchase-no-payment').style.display = 'none'; }
    } catch(e) { /* ignore */ }
}

async function confirmPayment() {
    if (!window._purchaseOrderId) return;
    document.querySelector('#purchase-step-pay button.btn-primary').textContent = '⏳ 处理中...';
    document.querySelector('#purchase-step-pay button.btn-primary').disabled = true;
    await new Promise(r => setTimeout(r, 800));
    try {
        const res = await fetch('/api/purchase/confirm', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ order_id: window._purchaseOrderId })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('purchase-step-pay').style.display = 'none';
            document.getElementById('purchase-step-done').style.display = 'block';
            document.getElementById('done-tier-name').textContent = '¥' + (data.amount || 0);
            document.getElementById('done-key').textContent = '当前余额: ¥' + (data.new_balance || 0).toFixed(2);
            document.getElementById('done-info').textContent = data.message || '';
            await loadBalanceStatus();
            await loadBalance();
        } else {
            showToast('支付失败: '+(data.error||'未知错误'), 'error');
        }
    } catch(e) {
        showToast('支付确认失败: '+e.message, 'error');
    } finally {
        const btn = document.querySelector('#purchase-step-pay button.btn-primary');
        if (btn) { btn.textContent = '我已完成付款'; btn.disabled = false; }
    }
}

// Backward compat
function copyLicenseKey() { showToast('充值模式无需密钥，余额已自动到账', 'info'); }
async function startPurchase(tier) {
    const mapping = {day:'10',week:'20',month:'50',year:'200'};
    await startRecharge(mapping[tier] || '50');
}

// ===== 原创性检查 =====
async function checkOriginality() {
    if (!currentChapterId) { showToast('请先选择章节','error'); return; }
    const content = getEditorContent();
    if (!content.trim()) { showToast('当前章节无内容','error'); return; }

    const container = document.getElementById('ai-messages-continue');
    if (!container) return;

    const lel = document.getElementById('ai-loading-continue');
    if (lel) lel.style.display = 'flex';

    try {
        const res = await fetch('/api/projects/'+currentProjectId+'/ai/originality-check', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ content, model: getCurrentModel() })
        });
        const data = await res.json();
        if (lel) lel.style.display = 'none';
        
        // Parse JSON
        let parsed;
        try {
            const cleaned = (data.content||'').replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
            parsed = JSON.parse(cleaned);
        } catch(e) {
            const aiDiv = document.createElement('div');
            aiDiv.className = 'ai-msg assistant';
            aiDiv.innerHTML = '<div class="msg-role">🔍 原创性检查</div><div><pre style="font-size:11px;white-space:pre-wrap;">'+escHtml(data.content||'')+'</pre></div>';
            container.appendChild(aiDiv);
            return;
        }
        
        const score = parsed.originality_score || 50;
        let color, label;
        if (score >= 80) { color = 'var(--green)'; label = '原创度高 ✨'; }
        else if (score >= 50) { color = 'var(--yellow)'; label = '需关注 ⚡'; }
        else { color = 'var(--red)'; label = '原创性不足 ⚠️'; }
        
        let html = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">';
        html += '<div style="width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;background:rgba('+(score>=80?'16,185,129':score>=50?'245,158,11':'239,68,68')+',0.12);color:'+color+';">'+score+'%</div>';
        html += '<div><div style="font-size:12px;font-weight:600;">'+label+'</div><div style="font-size:11.5px;color:var(--text-secondary);">'+escHtml(parsed.verdict||'')+'</div></div></div>';
        
        if (parsed.template_patterns && parsed.template_patterns.length > 0) {
            html += '<div style="font-size:11.5px;margin-top:8px;"><strong>⚠️ 发现的套路：</strong>';
            parsed.template_patterns.forEach(p => { html += '<div style="padding:2px 0 2px 12px;color:var(--text-secondary);">• '+escHtml(p)+'</div>'; });
            html += '</div>';
        }
        if (parsed.unique_elements && parsed.unique_elements.length > 0) {
            html += '<div style="font-size:11.5px;margin-top:8px;"><strong style="color:var(--green);">✨ 独特之处：</strong>';
            parsed.unique_elements.forEach(u => { html += '<div style="padding:2px 0 2px 12px;color:var(--text-secondary);">• '+escHtml(u)+'</div>'; });
            html += '</div>';
        }
        if (parsed.improvement_tips && parsed.improvement_tips.length > 0) {
            html += '<div style="font-size:11.5px;margin-top:8px;"><strong style="color:var(--accent-hover);">💡 提升建议：</strong>';
            parsed.improvement_tips.forEach(t => { html += '<div style="padding:2px 0 2px 12px;color:var(--text-secondary);">• '+escHtml(t)+'</div>'; });
            html += '</div>';
        }
        
        const aiDiv = document.createElement('div');
        aiDiv.className = 'ai-msg assistant';
        aiDiv.innerHTML = '<div class="msg-role">🔍 原创性检查</div><div>'+html+'</div>';
        container.appendChild(aiDiv);
        container.scrollTop = container.scrollHeight;
    } catch(e) {
        if (lel) lel.style.display = 'none';
        showToast('原创性检查失败: '+e.message, 'error');
    }
}

// ===== AI 客服组件 =====
window._supportHistory = [];

function toggleSupport() {
    const panel = document.getElementById('support-panel');
    const badge = document.getElementById('support-badge');
    if (panel.style.display === 'none') {
        panel.style.display = 'flex';
        badge.style.display = 'none';
    } else {
        panel.style.display = 'none';
    }
}

function sendSupportMsg() { sendSupportMessage(); }

async function sendSupportMessage() {
    const input = document.getElementById('support-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';

    const container = document.getElementById('support-messages');
    // 添加用户消息
    const uDiv = document.createElement('div');
    uDiv.className = 'sup-msg user';
    uDiv.innerHTML = '<div class="sup-bubble">'+escHtml(msg)+'</div>';
    container.appendChild(uDiv);
    window._supportHistory.push({role:'user', content:msg});

    // 显示输入中
    const typing = document.getElementById('support-typing') || (() => {
        const t = document.createElement('div');
        t.id = 'support-typing';
        t.className = 'sup-typing';
        t.innerHTML = '<div class="dots"><span></span><span></span><span></span></div>';
        container.appendChild(t);
        return t;
    })();
    typing.style.display = 'block';
    container.scrollTop = container.scrollHeight;

    try {
        const res = await fetch('/api/support/chat', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ message: msg, history: window._supportHistory.slice(0,-1) })
        });
        const data = await res.json();
        typing.style.display = 'none';

        const aDiv = document.createElement('div');
        aDiv.className = 'sup-msg assistant';
        aDiv.innerHTML = '<div class="sup-bubble">'+escHtml(data.reply||'抱歉，我暂时无法回复，请稍后再试。')+'</div>';
        container.appendChild(aDiv);
        window._supportHistory.push({role:'assistant', content:data.reply||''});
    } catch(e) {
        typing.style.display = 'none';
        const aDiv = document.createElement('div');
        aDiv.className = 'sup-msg assistant';
        aDiv.innerHTML = '<div class="sup-bubble">网络错误，请稍后再试 😥</div>';
        container.appendChild(aDiv);
    }
    container.scrollTop = container.scrollHeight;
}

function sendQuickSupport(question) {
    document.getElementById('support-input').value = question;
    sendSupportMessage();
}

// ===== Feature: 章节列表中删除按钮 =====
async function deleteChapterById(cid) {
    if (!currentProjectId) return;
    showConfirm('确定要删除此章节吗？此操作不可撤销。', async function(ok) {
        if (!ok) return;
        const wasCurrent = currentChapterId === cid;
        const res = await apiDelete('/api/projects/' + currentProjectId + '/chapters/' + cid);
        if (res && res.success) {
            if (wasCurrent) {
                currentChapterId = null;
                var titleEl = document.getElementById('editor-title');
                if (titleEl) titleEl.value = '';
                setEditorContent('');
                var statusCh = document.getElementById('status-chapter');
                if (statusCh) statusCh.textContent = '';
            }
            // 清除 IndexedDB 中对应草稿
            if (typeof NovelDB !== 'undefined') {
                NovelDB.clearDraft(currentProjectId, cid);
            }
            await loadChapters();
            showToast('章节已删除', 'info');
        }
    });
}

// ===== Feature: 创作流程进度追踪 =====
async function renderPlotChart() {
    const canvas = document.getElementById('plot-canvas');
    if (!canvas || !currentProjectId) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);

    const W = rect.width - 60;
    const H = rect.height - 80;
    const ox = 50, oy = 30;

    // Background
    ctx.fillStyle = '#0d0d15';
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (!chapters || chapters.length < 2) {
        ctx.fillStyle = '#666';
        ctx.font = '14px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('需要至少2个章节来生成轨迹图', rect.width / 2, rect.height / 2);
        return;
    }

    // Axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ox, oy); ctx.lineTo(ox, oy + H); ctx.lineTo(ox + W, oy + H);
    ctx.stroke();

    // Calculate tension scores per chapter
    const maxWords = Math.max(...chapters.map(c => c.word_count || 0), 1);
    const points = chapters.map((ch, i) => {
        const x = ox + (i / Math.max(chapters.length - 1, 1)) * W;
        // Heuristic tension: word_count ratio + position weight (middle chapters get bonus for climax)
        const wcScore = ((ch.word_count || 0) / maxWords) * 50;
        const posScore = 20 * Math.sin((i / Math.max(chapters.length - 1, 1)) * Math.PI);
        const y = oy + H - (wcScore + posScore + 20) * (H / 100);
        return { x, y, ch, tension: wcScore + posScore + 30 };
    });

    // Draw curve
    if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
            const cx = (points[i].x + points[i + 1].x) / 2;
            ctx.bezierCurveTo(cx, points[i].y, cx, points[i + 1].y, points[i + 1].x, points[i + 1].y);
        }
        ctx.strokeStyle = '#0A84FF';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Gradient fill
        ctx.lineTo(points[points.length - 1].x, oy + H);
        ctx.lineTo(points[0].x, oy + H);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, oy, 0, oy + H);
        grad.addColorStop(0, 'rgba(10,132,255,0.2)');
        grad.addColorStop(1, 'rgba(10,132,255,0.02)');
        ctx.fillStyle = grad;
        ctx.fill();
    }

    // Draw points
    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#0A84FF';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    });

    // Chapter labels (every Nth)
    const step = Math.max(1, Math.floor(chapters.length / 10));
    ctx.fillStyle = '#888';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    points.forEach((p, i) => {
        if (i % step === 0 || i === points.length - 1) {
            ctx.fillText((i + 1) + '', p.x, oy + H + 16);
            if (p.ch.title) ctx.fillText(p.ch.title.slice(0, 4), p.x, oy + H + 28);
        }
    });

    // Legend
    ctx.fillStyle = '#0A84FF';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('— 紧张度曲线', 10, 16);
    ctx.fillStyle = '#888';
    ctx.fillText('（基于字数变化与章节位置）', 120, 16);

    // Update stats (if elements exist)
    const peak = points.reduce((a, b) => a.tension > b.tension ? a : b);
    var peakEl = document.getElementById('plot-peak-chapter');
    if (peakEl) peakEl.textContent = peak.ch.title || '—';
    var cntEl = document.getElementById('plot-chapter-count');
    if (cntEl) cntEl.textContent = chapters.length;
    var wordsEl = document.getElementById('plot-total-words');
    if (wordsEl) wordsEl.textContent = chapters.reduce((s, c) => s + (c.word_count || 0), 0).toLocaleString();
}

// ===== Feature: 内容审阅 =====
async function runReview(reviewType) {
    if (!currentChapterId) { showToast('请先选择章节', 'error'); return; }
    const content = getEditorContent();
    if (!content.trim()) { showToast('当前章节无内容', 'error'); return; }

    const container = document.getElementById('review-result');
    const btn = document.getElementById('review-run-btn');
    if (btn) { btn.disabled = true; btn.textContent = '审阅中...'; }
    if (container) container.innerHTML = '<div style="text-align:center;padding:40px;"><div class="dot-flashing" style="margin:0 auto;"></div><p style="color:var(--text-muted);margin-top:12px;">AI 正在审阅中...</p></div>';

    try {
        const res = await fetch('/api/projects/' + currentProjectId + '/ai/review', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, review_type: reviewType, model: getCurrentModel() })
        });
        const data = await res.json();
        if (btn) { btn.disabled = false; btn.textContent = '开始审阅'; }

        if (res.status === 403 || data.error) {
            if (container) container.innerHTML = PREMIUM_UPGRADE_HTML;
            return;
        }

        let parsed;
        try {
            const cleaned = (data.content || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            parsed = JSON.parse(cleaned);
        } catch (e) {
            if (container) container.innerHTML = '<pre style="font-size:11px;color:var(--text-secondary);white-space:pre-wrap;padding:20px;">' + escHtml(data.content || '') + '</pre>';
            return;
        }

        const score = parsed.overall_score || 50;
        const scoreColor = score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--yellow)' : 'var(--red)';
        const scoreLabel = score >= 80 ? '优秀' : score >= 60 ? '良好' : score >= 40 ? '需改进' : '较差';

        let html = '';
        // Score gauge
        html += '<div style="display:flex;align-items:center;gap:16px;padding:16px;background:var(--bg-surface2);border-radius:8px;margin-bottom:16px;">';
        html += '<div style="width:64px;height:64px;border-radius:50%;border:3px solid ' + scoreColor + ';display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:' + scoreColor + ';">' + score + '</div>';
        html += '<div><div style="font-size:16px;font-weight:600;color:' + scoreColor + ';">' + scoreLabel + '</div>';
        html += '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">综合评分</div></div></div>';

        // Grammar issues
        if (parsed.grammar_issues && parsed.grammar_issues.length > 0) {
            html += '<div style="margin-bottom:16px;"><strong style="font-size:13px;">📝 语法/标点问题 (' + parsed.grammar_issues.length + ')</strong>';
            parsed.grammar_issues.slice(0, 10).forEach(issue => {
                const sevColor = issue.severity === 'high' ? '#f85149' : issue.severity === 'medium' ? '#f59e0b' : '#888';
                html += '<div style="padding:8px 12px;margin-top:6px;background:var(--bg-input);border-radius:6px;border-left:3px solid ' + sevColor + ';">';
                html += '<div style="font-size:12px;color:var(--text-primary);"><s style="color:#f85149;">' + escHtml(issue.text || '') + '</s></div>';
                html += '<div style="font-size:12px;color:var(--green);margin-top:2px;">→ ' + escHtml(issue.correction || '') + '</div>';
                if (issue.reason) html += '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">' + escHtml(issue.reason) + '</div>';
                html += '</div>';
            });
            html += '</div>';
        }

        // Plot issues
        if (parsed.plot_issues && parsed.plot_issues.length > 0) {
            html += '<div style="margin-bottom:16px;"><strong style="font-size:13px;">📖 情节问题 (' + parsed.plot_issues.length + ')</strong>';
            parsed.plot_issues.forEach(issue => {
                html += '<div style="padding:8px 12px;margin-top:4px;background:var(--bg-input);border-radius:6px;">';
                html += '<span style="font-size:11px;background:var(--bg-surface2);padding:1px 6px;border-radius:3px;color:var(--text-muted);">' + escHtml(issue.type || '') + '</span>';
                html += '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">' + escHtml(issue.description || '') + '</div>';
                if (issue.suggestion) html += '<div style="font-size:11px;color:var(--green);margin-top:2px;">💡 ' + escHtml(issue.suggestion) + '</div>';
                html += '</div>';
            });
            html += '</div>';
        }

        // Style feedback
        if (parsed.style_feedback) {
            const sf = parsed.style_feedback;
            html += '<div style="margin-bottom:16px;"><strong style="font-size:13px;">✨ 文笔评价</strong>';
            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;">';
            html += '<div style="padding:8px;background:rgba(16,185,129,0.08);border-radius:6px;"><div style="font-size:10px;color:var(--green);margin-bottom:4px;">✅ 优点</div>';
            (sf.strengths || []).forEach(s => { html += '<div style="font-size:11px;color:var(--text-secondary);">· ' + escHtml(s) + '</div>'; });
            html += '</div>';
            html += '<div style="padding:8px;background:rgba(245,158,11,0.08);border-radius:6px;"><div style="font-size:10px;color:var(--yellow);margin-bottom:4px;">⚠️ 待改进</div>';
            (sf.weaknesses || []).forEach(w => { html += '<div style="font-size:11px;color:var(--text-secondary);">· ' + escHtml(w) + '</div>'; });
            if (sf.suggestions) sf.suggestions.forEach(s => { html += '<div style="font-size:11px;color:var(--green);">💡 ' + escHtml(s) + '</div>'; });
            html += '</div></div></div>';
        }

        // Professional advice
        if (parsed.professional_advice) {
            html += '<div style="padding:14px;background:linear-gradient(135deg,rgba(10,132,255,0.08),rgba(94,92,230,0.06));border-radius:8px;margin-bottom:12px;">';
            html += '<strong style="font-size:13px;color:var(--accent-hover);">💬 编辑建议</strong>';
            html += '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:6px;line-height:1.8;">' + escHtml(parsed.professional_advice) + '</div></div>';
        }

        if (container) container.innerHTML = html;
    } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = '开始审阅'; }
        showToast('审阅失败: ' + e.message, 'error');
    }
}

// ===== Feature: AI 对话自动归类 =====
async function loadConversations() {
    if (!currentProjectId) return;
    const container = document.getElementById('conv-list');
    if (!container) return;
    try {
        const res = await fetch('/api/projects/' + currentProjectId + '/ai/conversations');
        const convs = await res.json();
        if (!convs || convs.length === 0) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">暂无对话记录</div>';
            return;
        }
        const catNames = { plot: '情节', character: '角色', worldbuilding: '世界观', writing_style: '文笔', revision: '修改', general: '通用' };
        const catIcons = { plot: '📖', character: '👤', worldbuilding: '🌍', writing_style: '✨', revision: '🔧', general: '💬' };
        container.innerHTML = convs.map(c => '<div class="conv-item" onclick="loadConversationMessages(\'' + c.id + '\')"><span class="conv-cat">' + (catIcons[c.category] || '💬') + '</span><div class="conv-info"><div class="conv-topic">' + escHtml(c.topic || '未命名对话') + '</div><div class="conv-meta">' + (catNames[c.category] || c.category) + ' · ' + c.message_count + '条消息 · ' + formatDate(c.last_message_at) + '</div></div></div>').join('');
    } catch (e) { /* silent */ }
}

async function loadConversationMessages(convId) {
    if (!currentProjectId) return;
    const container = document.getElementById('ai-messages-chat');
    if (!container) return;
    try {
        const res = await fetch('/api/projects/' + currentProjectId + '/ai/conversations/' + convId + '/messages');
        const msgs = await res.json();
        if (!msgs || msgs.length === 0) { container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">暂无消息</div>'; return; }
        container.innerHTML = msgs.map(m => '<div class="conv-msg ' + m.role + '"><span class="conv-role">' + (m.role === 'user' ? '我' : 'AI') + '</span><div>' + escHtml(m.content).replace(/\n/g, '<br>').slice(0, 500) + '</div></div>').join('');
    } catch (e) { /* silent */ }
}

// 后台自动归类对话（fire-and-forget，静默失败）
let _currentConvId = null;
async function trackConversation(userMsg, aiReply) {
    if (!currentProjectId) return;
    try {
        if (!_currentConvId) {
            const createResp = await fetch('/api/projects/' + currentProjectId + '/ai/conversations', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: userMsg.slice(0, 50), source_tab: 'chat' })
            });
            const conv = await createResp.json();
            _currentConvId = conv.id;
        }
        if (_currentConvId) {
            // 先记录用户消息（触发后端自动归类）
            await fetch('/api/projects/' + currentProjectId + '/ai/conversations/' + _currentConvId + '/messages', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: 'user', content: userMsg })
            });
            // 再记录 AI 回复
            await fetch('/api/projects/' + currentProjectId + '/ai/conversations/' + _currentConvId + '/messages', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: 'assistant', content: aiReply })
            });
        }
    } catch (e) { /* 后台任务，静默失败 */ }
}

// ===== Feature: 上下文仪表盘 =====
async function loadContextDashboard() {
    if (!currentProjectId) return;
    try {
        const res = await fetch('/api/projects/' + currentProjectId + '/context');
        if (res.status === 403) {
            var ctxTab = document.getElementById('tab-context');
            if (ctxTab) ctxTab.innerHTML = PREMIUM_UPGRADE_HTML;
            return;
        }
        const data = await res.json();

        const summariesEl = document.getElementById('ctx-summaries');
        if (summariesEl) {
            summariesEl.innerHTML = (data.summaries || []).slice(-5).map(s =>
                '<div class="ctx-card"><div class="ctx-card-title">' + escHtml(s.chapter_title || '') + '</div><div class="ctx-card-text">' + escHtml((s.summary || '').slice(0, 200)) + '</div></div>'
            ).join('') || '<div style="color:var(--text-muted);text-align:center;padding:20px;">暂无摘要，写作后自动生成</div>';
        }

        const threadsEl = document.getElementById('ctx-threads');
        if (threadsEl) {
            threadsEl.innerHTML = (data.plot_threads || []).map(t =>
                '<div class="ctx-thread ' + t.status + '"><span class="ctx-thread-status ' + t.status + '"></span><span>' + escHtml(t.title) + '</span><span style="margin-left:auto;font-size:10px;color:var(--text-muted);">' + escHtml(t.thread_type || '') + '</span></div>'
            ).join('') || '<div style="color:var(--text-muted);text-align:center;padding:20px;">暂无情节线程</div>';
        }

        const eventsEl = document.getElementById('ctx-events');
        if (eventsEl) {
            eventsEl.innerHTML = (data.key_events || []).slice(-8).map(e =>
                '<div class="ctx-event"><span class="ctx-event-type ' + (e.event_type || 'event') + '">' + (e.event_type || '事件') + '</span><span>' + escHtml(e.title) + '</span><span style="margin-left:auto;font-size:10px;color:var(--text-muted);">' + escHtml(e.chapter_title || '') + '</span></div>'
            ).join('') || '<div style="color:var(--text-muted);text-align:center;padding:20px;">暂无关键事件</div>';
        }
    } catch (e) { /* silent */ }
}

// ===== Feature: 自动章节摘要 =====
let _lastSummarizedWordCount = {};
async function autoSummarizeChapter(chapterId) {
    if (!chapterId || !currentProjectId) return;
    const ch = chapters.find(c => c.id === chapterId);
    if (!ch || !ch.content || ch.content.length < 200) return;
    const wc = ch.word_count || 0;
    const last = _lastSummarizedWordCount[chapterId] || 0;
    if (Math.abs(wc - last) < 500) return;
    _lastSummarizedWordCount[chapterId] = wc;
    try {
        await fetch('/api/projects/' + currentProjectId + '/chapters/' + chapterId + '/summarize', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: getCurrentModel() })
        });
    } catch (e) { /* 后台任务，静默失败 */ }
}

// Override saveCurrentChapter to trigger auto-summarize
const _origSaveCurrentChapter = saveCurrentChapter;
saveCurrentChapter = async function() {
    await _origSaveCurrentChapter();
    if (currentChapterId) {
        // Fire-and-forget: autoSummarizeChapter debounces internally and handles errors
        autoSummarizeChapter(currentChapterId);
    }
};

// ===== 阅读模式 =====
let _readerChapterIdx = 0;
let _readerFontSize = 18;

function openReader() {
    if (!currentProjectId || chapters.length === 0) {
        showToast('请先打开项目并创建章节', 'info'); return;
    }
    // 从当前选中章节开始
    const idx = chapters.findIndex(c => c.id === currentChapterId);
    _readerChapterIdx = idx >= 0 ? idx : 0;

    document.getElementById('reader-overlay').style.display = 'flex';
    document.getElementById('reader-nav').style.display = 'none';
    document.querySelector('.app-container').style.display = 'none';
    renderReaderContent();
    renderReaderNav();
}

function closeReader() {
    document.getElementById('reader-overlay').style.display = 'none';
    document.querySelector('.app-container').style.display = '';
}

function renderReaderContent() {
    const ch = chapters[_readerChapterIdx];
    if (!ch) return;
    document.getElementById('reader-title').textContent = ch.title || '阅读模式';
    const content = (ch.content || '').replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
    document.getElementById('reader-text').innerHTML = '<p>' + content + '</p>';
    document.getElementById('reader-text').style.fontSize = _readerFontSize + 'px';
    document.getElementById('reader-progress').textContent = (_readerChapterIdx+1) + ' / ' + chapters.length;
    document.getElementById('reader-prev-btn').disabled = _readerChapterIdx <= 0;
    document.getElementById('reader-next-btn').disabled = _readerChapterIdx >= chapters.length - 1;
}

function renderReaderNav() {
    document.getElementById('reader-chapter-links').innerHTML = chapters.map((ch, i) =>
        '<div style="padding:6px 8px;cursor:pointer;border-radius:4px;'+(i===_readerChapterIdx?'background:var(--accent);color:#fff;':'')+'" onclick="_readerChapterIdx='+i+';renderReaderContent()">'+(i+1)+'. '+escHtml(ch.title||'无标题')+'</div>'
    ).join('');
}

function readerPrevChapter() { if (_readerChapterIdx > 0) { _readerChapterIdx--; renderReaderContent(); } }
function readerNextChapter() { if (_readerChapterIdx < chapters.length - 1) { _readerChapterIdx++; renderReaderContent(); } }

function adjustReaderFont(delta) {
    _readerFontSize = Math.max(12, Math.min(28, _readerFontSize + delta));
    document.getElementById('reader-text').style.fontSize = _readerFontSize + 'px';
    document.getElementById('reader-font-size').textContent = _readerFontSize;
}

function toggleReaderNav() {
    const nav = document.getElementById('reader-nav');
    nav.style.display = nav.style.display === 'none' ? 'block' : 'none';
    if (nav.style.display === 'block') renderReaderNav();
}

function changeReaderTheme(theme) {
    const overlay = document.getElementById('reader-overlay');
    const themes = {
        dark: { bg: '#0a0a0f', text: '#e5e5e7', surface: '#12121a', border: '#2a2a35' },
        sepia: { bg: '#f4ecd8', text: '#5b4636', surface: '#e8dcc8', border: '#d4c5a0' },
        light: { bg: '#ffffff', text: '#1a1a1a', surface: '#f5f5f5', border: '#e0e0e0' }
    };
    const t = themes[theme] || themes.dark;
    overlay.style.background = t.bg;
    document.getElementById('reader-text').style.color = t.text;
    document.getElementById('reader-toolbar').style.background = t.surface;
    document.getElementById('reader-toolbar').style.borderColor = t.border;
    document.getElementById('reader-footer').style.background = t.surface;
    document.getElementById('reader-footer').style.borderColor = t.border;
    document.getElementById('reader-nav').style.background = t.surface;
    document.getElementById('reader-nav').style.borderColor = t.border;
}

// ===== 版本历史 =====
let _selectedVersionId = null;

async function showVersionHistory() {
    if (!currentProjectId || !currentChapterId) {
        showToast('请先选择章节', 'info'); return;
    }
    openModal('version-history-modal');
    document.getElementById('version-preview').style.display = 'none';
    document.getElementById('version-revert-btn').disabled = true;
    _selectedVersionId = null;

    const list = document.getElementById('version-list');
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">加载中...</div>';

    try {
        const res = await apiGet('/api/projects/'+currentProjectId+'/chapters/'+currentChapterId+'/snapshots');
        if (!res || res.length === 0) {
            list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">暂无版本快照<br><span style="font-size:11px;">修改超过50字后自动保存</span></div>';
            return;
        }
        list.innerHTML = res.map((s, i) => {
            const time = formatDate(s.snapshot_at);
            return '<div class="version-item" style="padding:10px 12px;cursor:pointer;border-radius:6px;margin-bottom:4px;'+(i===0?'background:rgba(10,132,255,0.08);border:1px solid rgba(10,132,255,0.2);':'')+'" onclick="previewVersion(\''+s.id+'\', this)" data-sid="'+s.id+'">'+
                '<div style="display:flex;justify-content:space-between;align-items:center;">'+
                '<span style="font-weight:600;font-size:13px;">v'+s.version+' · '+escHtml(s.title||'无标题')+'</span>'+
                '<span style="font-size:10px;color:var(--text-muted);">'+time+'</span></div>'+
                '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">'+(s.word_count||0)+' 字</div></div>';
        }).join('');
    } catch(e) {
        list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">加载失败</div>';
    }
}

async function previewVersion(sid, el) {
    document.querySelectorAll('.version-item').forEach(v => v.style.background = '');
    el.style.background = 'rgba(10,132,255,0.08)';
    el.style.border = '1px solid rgba(10,132,255,0.2)';
    _selectedVersionId = sid;
    document.getElementById('version-revert-btn').disabled = false;

    try {
        const snap = await apiGet('/api/projects/'+currentProjectId+'/chapters/'+currentChapterId+'/snapshots/'+sid);
        if (snap && snap.content) {
            document.getElementById('version-preview').style.display = 'block';
            document.getElementById('version-preview-content').textContent = snap.content.slice(0, 500);
        }
    } catch(e) { /* preview load failed, ignore */ }
}

async function revertToVersion() {
    if (!_selectedVersionId) return;
    showConfirm('确定回退到此版本吗？当前内容将自动保存为一个新快照。', async function(ok) {
        if (!ok) return;
        try {
            const res = await apiPost('/api/projects/'+currentProjectId+'/chapters/'+currentChapterId+'/snapshots/'+_selectedVersionId+'/revert');
            if (res && res.success) {
                closeModal();
                // 重载章节内容
                const ch = chapters.find(c => c.id === currentChapterId);
                if (ch) {
                    await selectChapter(currentChapterId);
                    await loadChapters();
                }
                showToast('已回退到 v' + res.version, 'success');
            }
        } catch(e) {
            showToast('回退失败: '+e.message, 'error');
        }
    });
}

// Keyboard shortcuts for reader
document.addEventListener('keydown', function(e) {
    const reader = document.getElementById('reader-overlay');
    if (reader && reader.style.display === 'flex') {
        if (e.key === 'Escape') closeReader();
        if (e.key === 'ArrowLeft') readerPrevChapter();
        if (e.key === 'ArrowRight') readerNextChapter();
    }
});

// ===== 世界观构建器 =====
let _worldItems = [];
let _worldFilterCat = '';

async function loadWorldItems() {
    if (!currentProjectId) return;
    try {
        const res = await apiGet('/api/projects/' + currentProjectId + '/worldbuilding');
        if (!res) return;
        _worldItems = res.items || [];
        window._worldItems = _worldItems;
        renderWorldItemList();
        renderWorldRules();
    } catch(e) { /* silent */ }
}

function renderWorldItemList() {
    const list = document.getElementById('wb-item-list');
    if (!list) return;
    const filtered = _worldFilterCat
        ? _worldItems.filter(item => item.category === _worldFilterCat)
        : _worldItems;
    if (filtered.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px;">暂无条目</div>';
        return;
    }
    list.innerHTML = filtered.map(item => {
        const catLabel = (item.category || 'other');
        return '<div style="padding:6px 8px;cursor:pointer;border-radius:4px;margin-bottom:2px;font-size:12px;' +
            (item.id === (window._selectedWorldId || '') ? 'background:rgba(10,132,255,0.12);color:var(--accent);' : '') +
            '" onclick="selectWorldItem(\'' + item.id + '\')">' +
            escHtml(item.name || '未命名') +
            '<span style="float:right;color:var(--text-muted);font-size:10px;">' + escHtml(catLabel) + '</span></div>';
    }).join('');
}

function filterWorldCategory(cat) {
    _worldFilterCat = cat || '';
    // Update category sidebar active state
    document.querySelectorAll('#wb-category-list [data-cat]').forEach(el => {
        if ((el.dataset.cat || '') === _worldFilterCat) {
            el.style.background = 'rgba(10,132,255,0.1)';
            el.style.color = 'var(--accent)';
            el.style.fontWeight = '600';
        } else {
            el.style.background = '';
            el.style.color = '';
            el.style.fontWeight = '';
        }
    });
    renderWorldItemList();
}

function addWorldItem() {
    window._selectedWorldId = null;
    document.getElementById('wb-edit-id').value = '';
    document.getElementById('wb-edit-cat').value = 'geography';
    document.getElementById('wb-edit-name').value = '';
    document.getElementById('wb-edit-desc').value = '';
    document.getElementById('wb-edit-details').value = '';
    document.getElementById('wb-delete-btn').style.display = 'none';
    document.getElementById('wb-save-msg').textContent = '';
    document.getElementById('wb-editor').style.display = 'block';
    document.getElementById('wb-empty').style.display = 'none';
}

function selectWorldItem(id) {
    const item = _worldItems.find(i => i.id === id);
    if (!item) return;
    window._selectedWorldId = id;
    document.getElementById('wb-edit-id').value = item.id;
    document.getElementById('wb-edit-cat').value = item.category || 'other';
    document.getElementById('wb-edit-name').value = item.name || '';
    document.getElementById('wb-edit-desc').value = item.description || '';
    let detailsStr = '';
    if (item.details) {
        try {
            detailsStr = typeof item.details === 'string' ? JSON.stringify(JSON.parse(item.details), null, 2) : JSON.stringify(item.details, null, 2);
        } catch(e) { detailsStr = item.details || ''; }
    }
    document.getElementById('wb-edit-details').value = detailsStr;
    document.getElementById('wb-delete-btn').style.display = 'inline-block';
    document.getElementById('wb-save-msg').textContent = '';
    document.getElementById('wb-editor').style.display = 'block';
    document.getElementById('wb-empty').style.display = 'none';
    renderWorldItemList();
}

async function saveWorldItem() {
    if (!currentProjectId) return;
    const id = document.getElementById('wb-edit-id').value;
    const name = document.getElementById('wb-edit-name').value.trim();
    if (!name) { showToast('请输入条目名称', 'error'); return; }
    const category = document.getElementById('wb-edit-cat').value;
    const description = document.getElementById('wb-edit-desc').value.trim();
    const detailsStr = document.getElementById('wb-edit-details').value.trim();

    let details = {};
    if (detailsStr) {
        try { details = JSON.parse(detailsStr); }
        catch(e) { showToast('扩展属性 JSON 格式错误', 'error'); return; }
    }

    const payload = { name, category, description, details };
    const msgEl = document.getElementById('wb-save-msg');

    try {
        let res;
        if (id) {
            res = await apiPut('/api/projects/' + currentProjectId + '/worldbuilding/' + id, payload);
        } else {
            res = await apiPost('/api/projects/' + currentProjectId + '/worldbuilding', payload);
        }
        if (res && (res.id || res.success)) {
            if (msgEl) { msgEl.textContent = '✅ 已保存'; msgEl.style.color = 'var(--green)'; }
            if (!id && res.id) {
                document.getElementById('wb-edit-id').value = res.id;
                document.getElementById('wb-delete-btn').style.display = 'inline-block';
                window._selectedWorldId = res.id;
            }
            await loadWorldItems();
            setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 2000);
        }
    } catch(e) {
        if (msgEl) { msgEl.textContent = '❌ 保存失败'; msgEl.style.color = '#f85149'; }
    }
}

async function deleteWorldItem() {
    const id = document.getElementById('wb-edit-id').value;
    if (!id || !currentProjectId) return;
    showConfirm('确定删除此世界观条目吗？', async function(ok) {
        if (!ok) return;
        try {
            const res = await apiDelete('/api/projects/' + currentProjectId + '/worldbuilding/' + id);
            if (res && res.success) {
                cancelWorldEdit();
                await loadWorldItems();
                showToast('已删除', 'info');
            }
        } catch(e) { showToast('删除失败: ' + e.message, 'error'); }
    });
}

async function generateWorldItems() {
    if (!currentProjectId) { showToast('请先打开项目','error'); return; }
    const premiseEl = document.getElementById('outline-premise');
    const premise = premiseEl ? premiseEl.value.trim() : '';
    if (!premise) { showToast('请先在「情节大纲」面板填写故事梗概','error'); openSlideout('outline'); return; }
    const genre = document.getElementById('outline-genre')?.value || '';
    const style = document.getElementById('outline-style')?.value || '';
    const model = getCurrentModel();

    showToast('AI 正在生成世界观设定...', 'info');
    try {
        const res = await fetch('/api/projects/'+currentProjectId+'/ai/generate-worldbuilding', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ premise, genre, style, model })
        });
        const data = await res.json();
        if (data.error) { showToast(data.error, 'error'); return; }
        if (data.imported > 0) {
            await loadWorldItems();
            showToast('已生成 ' + data.imported + ' 条世界观设定', 'success');
        } else {
            showToast('AI 未生成有效条目，请重试', 'error');
        }
    } catch(e) {
        showToast('生成失败，请重试', 'error');
    }
}

function cancelWorldEdit() {
    window._selectedWorldId = null;
    document.getElementById('wb-edit-id').value = '';
    document.getElementById('wb-edit-name').value = '';
    document.getElementById('wb-edit-desc').value = '';
    document.getElementById('wb-edit-details').value = '';
    document.getElementById('wb-delete-btn').style.display = 'none';
    document.getElementById('wb-save-msg').textContent = '';
    document.getElementById('wb-editor').style.display = 'none';
    document.getElementById('wb-empty').style.display = 'flex';
}

// ===== Prompt 模板库 =====
const PROMPT_TEMPLATES = {
    '黄金三章': {
        genre: ['xuanhuan', 'dushi', 'kehuan', 'xuanyi', 'wuxia'],
        prompt: '请为本小说的开篇第一章创作一个强力开局：\n1. 首句要抓人眼球，抛出一个悬念或冲突\n2. 在300字内建立核心矛盾或独特设定\n3. 主角第一次出场就要展现鲜明的性格特征\n4. 埋下至少一个让读者想继续追的钩子\n5. 节奏紧凑，避免大段背景介绍',
        hint: '网文开局定生死，快速建立悬念和期待'
    },
    '打脸爽文': {
        genre: ['xuanhuan', 'dushi', 'wuxia'],
        prompt: '请创作一个"扮猪吃虎/打脸"桥段：\n1. 先铺垫对手的嚣张和轻视，让读者积累情绪\n2. 主角用实力碾压，但方式要有创意，不要简单暴力\n3. 旁观者的震惊反应要各有特色\n4. 打脸之后的余波要有故事推进\n5. 避免常见套路如"全场倒吸一口凉气"',
        hint: '情绪递进是关键：铺垫→挤压→释放'
    },
    '情感冲突': {
        genre: ['yanqing', 'dushi', 'xuanhuan'],
        prompt: '请创作一段情感冲突场景：\n1. 两个角色之间存在真实的分歧，不是误会\n2. 对白要有各自的口语习惯和情绪节奏\n3. 用动作和细节暗示未说出口的心理活动\n4. 冲突的解决方式应该推动角色关系的变化\n5. 避免"你听我解释""我不听"等肥皂剧桥段',
        hint: '真实的冲突源于价值观差异，而非信息不对称'
    },
    '伏笔埋设': {
        genre: ['xuanyi', 'kehuan', 'xuanhuan'],
        prompt: '请在当前场景中埋设一个伏笔：\n1. 信息要自然融入场景，不要突兀\n2. 读者当下不会注意到，但回头看会觉得"原来如此"\n3. 伏笔可以是一个细节、一句对话、一个意象\n4. 给出伏笔的"揭晓方式"建议（在后续章节中如何回收）\n5. 一个场景最多埋一个伏笔，不要太多',
        hint: '好伏笔像种子，不是在读者眼前挥舞旗帜'
    },
    '战斗场景': {
        genre: ['xuanhuan', 'wuxia', 'kehuan'],
        prompt: '请创作一个精彩的战斗/对决场景：\n1. 战斗要有策略和智慧，不是单纯的力量比拼\n2. 环境要素参与战斗（利用地形、天气、道具）\n3. 主角在战斗中展现性格（冷静/狂暴/机智）\n4. 节奏要有张有弛，不要全程绷紧\n5. 战斗结果改变局势或揭示新信息\n6. 避免"底牌尽出""燃烧精血"等通用套路',
        hint: '好的战斗是性格的延伸，不仅是力量的碰撞'
    },
    '角色出场': {
        genre: ['all'],
        prompt: '请为重要角色的首次出场创作一个令人印象深刻的场景：\n1. 第一印象要强烈且准确（外貌/动作/语言的三位一体）\n2. 通过角色的行为而非描述来展现性格\n3. 出场场景要与后续剧情产生联系\n4. 给出一个独特的标志性动作/口癖/习惯\n5. 避免"白衣胜雪""绝美面容"等空洞形容',
        hint: '角色出场的第一印象决定了读者能否记住他/她'
    },
    '世界观展开': {
        genre: ['xuanhuan', 'kehuan', 'xuanyi'],
        prompt: '请通过剧情自然展示世界观的某个层面：\n1. 不要用"在这个世界上..."开头，用剧情带出设定\n2. 通过角色的日常行为展现世界规则\n3. 每次只展示冰山一角，保留神秘感\n4. 设定之间要有逻辑关联，自洽\n5. 即使奇幻设定也要有内在的"物理规则"',
        hint: 'Show, don\'t tell — 让读者自己拼出世界观'
    },
    '悬念营造': {
        genre: ['xuanyi', 'kehuan'],
        prompt: '请营造一个扣人心弦的悬念：\n1. 信息要逐步释放，每次只给一点\n2. 让读者产生"必须翻到下一页"的冲动\n3. 不要用非自然的隐瞒（角色明明知道但不告诉读者）\n4. 悬念的答案要在本章内给出部分线索\n5. 结尾处再埋下新的悬念',
        hint: '悬念的本质是信息的不对称释放'
    },
    '日常过渡': {
        genre: ['all'],
        prompt: '请创作一段日常/过渡场景：\n1. 即使是"日常"，也要推动人物关系或埋下信息\n2. 通过日常细节展现角色的生活状态和性格\n3. 节奏舒缓但不要啰嗦\n4. 为下一个情节高潮做情绪铺垫\n5. 可以在日常中穿插幽默或温馨时刻',
        hint: '日常章节是为高潮蓄力，不是注水'
    },
    '反转剧情': {
        genre: ['xuanyi', 'kehuan', 'xuanhuan'],
        prompt: '请创作一个情节反转：\n1. 反转要有充分的伏笔铺垫（前面章节已埋下的线索）\n2. 反转要出乎意料但合情合理\n3. 不要为了反转而反转，应该服务于故事主题\n4. 反转之后重新定义读者对之前情节的理解\n5. 一个反转就够了，不要连环套娃',
        hint: '最好的反转是让读者拍腿说"原来如此"，而不是"这什么鬼"'
    }
};

// 获取指定题材的模板列表
function getPromptTemplates(genre) {
    const result = [];
    for (const [name, tmpl] of Object.entries(PROMPT_TEMPLATES)) {
        if (tmpl.genre.includes('all') || tmpl.genre.includes(genre)) {
            result.push({name, ...tmpl});
        }
    }
    return result;
}

// 应用 prompt 模板到输入框
function applyPromptTemplate(inputId, templateName) {
    const tmpl = PROMPT_TEMPLATES[templateName];
    if (!tmpl) return;
    const input = document.getElementById(inputId);
    if (input) {
        input.value = tmpl.prompt;
        input.focus();
        // 显示提示
        const hint = document.getElementById('prompt-template-hint');
        if (hint && tmpl.hint) {
            hint.textContent = '💡 ' + tmpl.hint;
            hint.style.display = 'block';
            setTimeout(() => { hint.style.display = 'none'; }, 8000);
        }
        showToast('模板：' + templateName, 'info');
    }
}
