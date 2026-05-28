/* Novel Studio — Volume/Chapter tree (stub, to be built in Task 11) */
window.Tree = window.Tree || {
    volumes: [],
    async load() { console.log('[Tree] load'); },
    render() { console.log('[Tree] render'); },
    async addVolume() { console.log('[Tree] addVolume'); },
    async addChapter() { console.log('[Tree] addChapter'); },
    async selectChapter(id) { console.log('[Tree] selectChapter', id); },
    async deleteVolume(id) { console.log('[Tree] deleteVolume', id); },
    toggleVolume(id) { console.log('[Tree] toggleVolume', id); },
};
