/* Novel Studio — Workspace (editor) (stub, to be built in Task 10) */
window.Workspace = window.Workspace || {
    currentChapterId: null,
    currentProjectId: null,
    async openProject(id) { console.log('[Workspace] openProject', id); },
    async loadChapter(id) { console.log('[Workspace] loadChapter', id); },
    async saveChapter() { console.log('[Workspace] saveChapter'); },
    async deleteChapter() { console.log('[Workspace] deleteChapter'); },
    onInput() { console.log('[Workspace] onInput'); },
    navChapter(dir) { console.log('[Workspace] navChapter', dir); },
    toggleFullscreen() { console.log('[Workspace] toggleFullscreen'); },
};
