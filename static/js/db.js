// Novel Studio — IndexedDB 稿件安全生命线
// 50ms 本地写入 + 2s 空闲增量同步 + 页面恢复
var NovelDB = (function() {
    var DB_NAME = 'novel-studio-drafts';
    var DB_VERSION = 1;
    var STORE = 'drafts';
    var _db = null;

    function open() {
        return new Promise(function(resolve, reject) {
            if (_db) return resolve(_db);
            var req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    var store = db.createObjectStore(STORE, { keyPath: 'key' });
                    store.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
            };
            req.onsuccess = function(e) { _db = e.target.result; resolve(_db); };
            req.onerror = function(e) { reject(e.target.error); };
        });
    }

    // 50ms 级本地写入：每次按键后调用
    function saveDraft(projectId, chapterId, content, wordCount) {
        return open().then(function(db) {
            return new Promise(function(resolve, reject) {
                var tx = db.transaction(STORE, 'readwrite');
                var store = tx.objectStore(STORE);
                var key = projectId + ':' + (chapterId || '__empty__');
                var record = {
                    key: key,
                    projectId: projectId,
                    chapterId: chapterId || '',
                    content: content,
                    wordCount: wordCount || 0,
                    updatedAt: Date.now(),
                    synced: false,
                    syncedContent: null  // 上次成功同步的内容
                };
                var req = store.put(record);
                req.onsuccess = function() { resolve(true); };
                req.onerror = function(e) {
                    // 存储满时静默降级
                    console.warn('IndexedDB 写入失败:', e.target.error);
                    resolve(false);
                };
            });
        });
    }

    // 读取本地草稿
    function loadDraft(projectId, chapterId) {
        return open().then(function(db) {
            return new Promise(function(resolve, reject) {
                var tx = db.transaction(STORE, 'readonly');
                var store = tx.objectStore(STORE);
                var key = projectId + ':' + (chapterId || '__empty__');
                var req = store.get(key);
                req.onsuccess = function() { resolve(req.result || null); };
                req.onerror = function(e) { reject(e.target.error); };
            });
        });
    }

    // 标记为已同步（服务器保存成功后调用）
    function markSynced(projectId, chapterId, content) {
        return open().then(function(db) {
            return new Promise(function(resolve, reject) {
                var tx = db.transaction(STORE, 'readwrite');
                var store = tx.objectStore(STORE);
                var key = projectId + ':' + (chapterId || '__empty__');
                var req = store.get(key);
                req.onsuccess = function() {
                    var record = req.result;
                    if (record) {
                        record.synced = true;
                        record.syncedContent = content || record.content;
                        record.syncedAt = Date.now();
                        store.put(record);
                    }
                    resolve(true);
                };
                req.onerror = function() { resolve(false); };
            });
        });
    }

    // 清除单个草稿（删除章节时调用）
    function clearDraft(projectId, chapterId) {
        return open().then(function(db) {
            return new Promise(function(resolve, reject) {
                var tx = db.transaction(STORE, 'readwrite');
                var store = tx.objectStore(STORE);
                var key = projectId + ':' + (chapterId || '__empty__');
                store.delete(key);
                tx.oncomplete = function() { resolve(true); };
                tx.onerror = function() { resolve(false); };
            });
        });
    }

    // 清除项目的所有草稿
    function clearProjectDrafts(projectId) {
        return open().then(function(db) {
            return new Promise(function(resolve, reject) {
                var tx = db.transaction(STORE, 'readwrite');
                var store = tx.objectStore(STORE);
                var index = store.index('updatedAt');
                var range = IDBKeyRange.lowerBound(0);
                var req = index.openCursor(range);
                req.onsuccess = function(e) {
                    var cursor = e.target.result;
                    if (cursor) {
                        if (cursor.value.projectId === projectId) {
                            cursor.delete();
                        }
                        cursor.continue();
                    } else {
                        resolve(true);
                    }
                };
                req.onerror = function() { resolve(false); };
            });
        });
    }

    // 获取所有未同步的草稿（用于恢复检查）
    function getUnsynchronizedDrafts(projectId) {
        return open().then(function(db) {
            return new Promise(function(resolve, reject) {
                var tx = db.transaction(STORE, 'readonly');
                var store = tx.objectStore(STORE);
                var results = [];
                var req = store.openCursor();
                req.onsuccess = function(e) {
                    var cursor = e.target.result;
                    if (cursor) {
                        var record = cursor.value;
                        if (record.projectId === projectId && !record.synced) {
                            results.push(record);
                        }
                        cursor.continue();
                    } else {
                        resolve(results);
                    }
                };
                req.onerror = function() { resolve([]); };
            });
        });
    }

    // 计算段落级差异（用于增量同步统计）
    function computeParagraphDiff(currentContent, syncedContent) {
        if (!syncedContent || syncedContent === currentContent) {
            return { changed: syncedContent !== currentContent, added: 0, removed: 0, totalParagraphs: 0 };
        }
        var curParas = (currentContent || '').split(/\n\n+/);
        var synParas = (syncedContent || '').split(/\n\n+/);
        var added = 0, removed = 0;
        // 简单比较：字数差异 = 近似变化量
        var curLen = currentContent.replace(/\s/g, '').length;
        var synLen = syncedContent.replace(/\s/g, '').length;
        if (curLen > synLen) added = curLen - synLen;
        else removed = synLen - curLen;
        return {
            changed: true,
            added: added,
            removed: removed,
            totalParagraphs: curParas.length,
            paraDelta: curParas.length - synParas.length
        };
    }

    // 检查是否需要恢复
    function checkForRecovery(projectId, chapterId) {
        return loadDraft(projectId, chapterId).then(function(draft) {
            if (!draft || draft.synced) return null;
            // 有未同步的本地草稿，需要恢复
            return draft;
        });
    }

    return {
        saveDraft: saveDraft,
        loadDraft: loadDraft,
        markSynced: markSynced,
        clearDraft: clearDraft,
        clearProjectDrafts: clearProjectDrafts,
        getUnsynchronizedDrafts: getUnsynchronizedDrafts,
        computeParagraphDiff: computeParagraphDiff,
        checkForRecovery: checkForRecovery
    };
})();
