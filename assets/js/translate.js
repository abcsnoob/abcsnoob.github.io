document.addEventListener("DOMContentLoaded", async () => {
    // 1. Danh sách ngôn ngữ đầy đủ
    const supportedLangs = {
        "vi": "Tiếng Việt", "en": "English", "zh": "中文 (Zhōngwén)", "ja": "日本語 (Nihongo)",
        "ko": "한국어 (Hangugeo)", "fr": "Français", "de": "Deutsch", "es": "Español",
        "pt": "Português", "it": "Italiano", "ru": "Русский", "ar": "العربية (Al-ʻarabiyyah)",
        "hi": "हिन्दी (Hindī)", "th": "ไทย (Thai)", "id": "Bahasa Indonesia", "ms": "Bahasa Melayu",
        "tr": "Türkçe", "nl": "Nederlands", "pl": "Polski", "sv": "Svenska", "da": "Dansk",
        "fi": "Suomi", "no": "Norsk", "cs": "Čeština", "el": "Ελληνικά", "he": "עברית",
        "ro": "Română", "hu": "Magyar", "uk": "Українська", "bg": "Български", "sk": "Slovenčina",
        "sl": "Slovenščina", "hr": "Hrvatski", "sr": "Српски", "fa": "فارسی", "bn": "বাংলা"
    };

    // 2. Xác định ngôn ngữ hiển thị
    const params = new URLSearchParams(window.location.search);
    let lang = params.get('lang') || localStorage.getItem('user_lang');

    if (!lang) {
        const browserLang = navigator.language.split('-')[0];
        lang = supportedLangs[browserLang] ? browserLang : 'vi';
    }

    localStorage.setItem('user_lang', lang);

    // 3. Hiển thị Dropdown
    injectLanguageDropdown(supportedLangs, lang);

    // 4. Tiến hành dịch nếu ngôn ngữ không phải Tiếng Việt
    if (lang !== 'vi') {
        // Dịch nội dung có sẵn
        translateNewNodes(document.body, lang, 'vi');

        // Theo dõi và dịch nội dung mới (Dynamic Content)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    translateNewNodes(node, lang, 'vi');
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
});

/**
 * Hàm dịch các Node (hỗ trợ đệ quy và lọc nội dung)
 */
async function translateNewNodes(rootNode, target, source) {
    if (!rootNode || rootNode.id === 'notranslate') return;
    
    const textNodes = [];
    const walk = (node) => {
        // Loại trừ các thẻ kỹ thuật và vùng cấm
        if (node.id === 'notranslate' || 
            ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(node.tagName)) return;

        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 1) {
            // Chỉ thêm vào danh sách dịch nếu chứa chữ cái (loại bỏ số/giờ hệ thống)
            if (/[a-zA-Zà-ỹÀ-Ỹ]/.test(node.textContent)) {
                textNodes.push(node);
            }
        } else {
            node.childNodes.forEach(walk);
        }
    };

    walk(rootNode);

    for (const node of textNodes) {
        const originalText = node.textContent.trim();
        if (!node._isTranslated) {
            const translatedText = await fetchTranslation(originalText, target, source);
            if (translatedText !== originalText) {
                node.textContent = translatedText;
                node._isTranslated = true; 
            }
        }
    }
}

/**
 * Gọi API dịch
 */
async function fetchTranslation(text, target, source) {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const json = await res.json();
        return json[0].map(item => item[0]).join('');
    } catch (err) {
        return text;
    }
}

/**
 * Tạo Dropdown và giữ các tham số URL khác
 */
function injectLanguageDropdown(langs, currentLang) {
    const container = document.createElement('div');
    container.id = 'notranslate';
    container.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; z-index: 99999;
        background: white; padding: 10px; border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.15); font-family: sans-serif;
    `;

    let optionsHtml = '';
    for (const [code, name] of Object.entries(langs)) {
        optionsHtml += `<option value="${code}" ${currentLang === code ? 'selected' : ''}>${name}</option>`;
    }

    container.innerHTML = `
        <label style="font-size: 11px; color: #666; display: block; margin-bottom: 5px;">Language:</label>
        <select id="lang-select" style="padding: 5px; border-radius: 5px; border: 1px solid #ccc; outline: none; cursor: pointer; max-width: 150px;">
            ${optionsHtml}
        </select>
    `;
    document.body.appendChild(container);

    document.getElementById('lang-select').addEventListener('change', function() {
        const newLang = this.value;
        localStorage.setItem('user_lang', newLang);
        
        // Cập nhật URL nhưng giữ nguyên các tham số khác như ?id=
        const newParams = new URLSearchParams(window.location.search);
        newParams.set('lang', newLang);
        window.location.search = newParams.toString();
    });
}
