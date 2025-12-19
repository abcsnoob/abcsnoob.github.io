document.addEventListener("DOMContentLoaded", async () => {
    // 1. Tự động thêm bộ chọn ngôn ngữ vào giao diện
    addLanguagePicker();

    // 2. Kiểm tra ngôn ngữ từ URL
    const urlParams = new URLSearchParams(window.location.search);
    const lang = urlParams.get('lang');

    if (lang === 'en') {
        const rootElement = document.body;
        await translatePage(rootElement, 'en', 'vi');
    }
});

/**
 * Tạo bộ chọn ngôn ngữ (Language Picker) tự động
 */
function addLanguagePicker() {
    const picker = document.createElement('div');
    picker.id = 'notranslate'; // Quan trọng: Bộ chọn này không được bị dịch
    picker.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #fff;
        border: 1px solid #ccc;
        padding: 10px;
        border-radius: 8px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        z-index: 9999;
        display: flex;
        gap: 10px;
        font-family: Arial, sans-serif;
    `;

    picker.innerHTML = `
        <a href="?lang=vi" style="text-decoration:none; color:${getCurrentLang() === 'vi' ? 'blue' : '#333'}; font-weight:bold;">Tiếng Việt</a>
        <span style="color:#ccc">|</span>
        <a href="?lang=en" style="text-decoration:none; color:${getCurrentLang() === 'en' ? 'blue' : '#333'}; font-weight:bold;">English</a>
    `;
    document.body.appendChild(picker);
}

function getCurrentLang() {
    return new URLSearchParams(window.location.search).get('lang') || 'vi';
}

/**
 * Xử lý dịch toàn bộ trang một cách thông minh
 */
async function translatePage(rootNode, targetLang, sourceLang) {
    let textNodes = [];

    // Bước 1: Thu thập tất cả các Text Node cần dịch (loại trừ notranslate)
    function collectTextNodes(node) {
        if (node.id === 'notranslate') return; // Bỏ qua vùng cấm

        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 2) {
            textNodes.push(node);
        } else {
            for (let child of node.childNodes) {
                collectTextNodes(child);
            }
        }
    }

    collectTextNodes(rootNode);

    // Bước 2: Dịch từng node (có thể cải tiến bằng cách gom mảng nếu trang quá dài)
    for (let node of textNodes) {
        const originalText = node.textContent.trim();
        const translated = await callGoogleAPI(originalText, targetLang, sourceLang);
        node.textContent = node.textContent.replace(originalText, translated);
    }
}

/**
 * API Gọi Google Translate
 */
async function callGoogleAPI(text, targetLang, sourceLang) {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        const data = await response.json();
        return data[0].map(item => item[0]).join('');
    } catch (e) {
        return text;
    }
}
