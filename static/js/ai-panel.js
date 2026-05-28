var AIPanel = (function() {
    function aiContinue() {
        var editor = document.getElementById('ws-editor-body');
        if (!editor) return;
        var text = (editor.textContent || '').trim();
        if (!text) { NS.toast('请先写一些内容', 'info'); return; }
        NS.toast('AI 续写中...', 'info');
        // Call existing AI endpoint
        var pid = NS.getState('projectId');
        fetch('/api/projects/' + pid + '/ai/continue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, chapter_id: NS.getState('chapterId') })
        }).then(function(r) { return r.json(); })
          .then(function(data) {
              if (data.text) {
                  editor.innerHTML += '<p>' + data.text + '</p>';
                  Workspace.onInput();
                  NS.toast('AI 续写完成', 'success');
              }
          }).catch(function(e) { NS.toast('续写失败: ' + e.message, 'error'); });
    }

    function polish() {
        var editor = document.getElementById('ws-editor-body');
        if (!editor) return;
        var text = (editor.textContent || '').trim();
        if (!text) { NS.toast('请先写一些内容', 'info'); return; }
        NS.toast('AI 润色中...', 'info');
        var pid = NS.getState('projectId');
        fetch('/api/projects/' + pid + '/ai/polish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        }).then(function(r) { return r.json(); })
          .then(function(data) {
              if (data.text) {
                  editor.innerHTML = '<p>' + data.text.replace(/\n/g, '</p><p>') + '</p>';
                  Workspace.onInput();
                  NS.toast('润色完成', 'success');
              }
          }).catch(function(e) { NS.toast('润色失败: ' + e.message, 'error'); });
    }

    function writeChapter() {
        NS.toast('AI 写本章中...', 'info');
        var pid = NS.getState('projectId');
        fetch('/api/projects/' + pid + '/ai/write-chapter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapter_id: NS.getState('chapterId') })
        }).then(function(r) { return r.json(); })
          .then(function(data) {
              if (data.text) {
                  var editor = document.getElementById('ws-editor-body');
                  if (editor) { editor.innerHTML = '<p>' + data.text.replace(/\n/g, '</p><p>') + '</p>'; }
                  Workspace.onInput();
                  NS.toast('本章写作完成', 'success');
              }
          }).catch(function(e) { NS.toast('写作失败: ' + e.message, 'error'); });
    }

    function expand() {
        var selection = window.getSelection();
        var text = selection.toString().trim();
        if (!text) { NS.toast('请先选中要扩写的内容', 'info'); return; }
        NS.toast('AI 扩写中...', 'info');
        var pid = NS.getState('projectId');
        fetch('/api/projects/' + pid + '/ai/expand', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        }).then(function(r) { return r.json(); })
          .then(function(data) {
              if (data.text && selection.rangeCount > 0) {
                  var range = selection.getRangeAt(0);
                  range.deleteContents();
                  var node = document.createTextNode(data.text);
                  range.insertNode(node);
                  Workspace.onInput();
                  NS.toast('扩写完成', 'success');
              }
          }).catch(function(e) { NS.toast('扩写失败: ' + e.message, 'error'); });
    }

    function lockPOV(charId) {
        NS.setState('povCharacterId', charId || null);
        NS.toast(charId ? 'POV 已锁定' : 'POV 已解除', 'info');
    }

    return {
        aiContinue: aiContinue, continue: aiContinue,
        polish: polish, writeChapter: writeChapter, expand: expand,
        lockPOV: lockPOV
    };
})();
