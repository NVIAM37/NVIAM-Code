export function generatePreviewHtml(currentFile, fileTree) {
    if (!currentFile || !currentFile.endsWith('.html')) {
        return null; // Used to trigger alert in UI
    }

    const htmlContent = fileTree[currentFile]?.file.contents || '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    // Helper to resolve path (Naive implementation assuming flat fileTree keys like "folder/file.ext")
    const resolvePath = (path) => {

        const currentParts = currentFile.split('/');
        currentParts.pop(); // remove filename
        const currentDir = currentParts.join('/');

        // Simple naive join
        let target = path.startsWith('/') ? path.slice(1) : (currentDir ? `${currentDir}/${path}` : path);

        // Strip ./
        if (target.startsWith('./')) target = target.slice(2);

        return target;
    }

    // 1. Inject CSS
    const links = doc.querySelectorAll('link[rel="stylesheet"]');
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href) {
            const targetPath = resolvePath(href);
            const cssFile = fileTree[targetPath];
            if (cssFile) {
                const style = doc.createElement('style');
                style.textContent = cssFile.file.contents;
                link.replaceWith(style);
            }
        }
    });

    // 2. Inject JS
    const scripts = doc.querySelectorAll('script[src]');
    scripts.forEach(script => {
        const src = script.getAttribute('src');
        if (src) {
            const targetPath = resolvePath(src);
            const jsFile = fileTree[targetPath];
            if (jsFile) {
                const inlineScript = doc.createElement('script');
                inlineScript.textContent = jsFile.file.contents;
                script.replaceWith(inlineScript);
            }
        }
    });

    return doc.documentElement.outerHTML;
}
