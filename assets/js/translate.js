(function() {
    const supportedLangs = {
        "vi": "Tiếng Việt", "en": "English", "zh": "中文 (Zhōngwén)", "ja": "日本語 (Nihongo)",
        "ko": "한국어 (Hangugeo)", "fr": "Français", "de": "Deutsch", "es": "Español",
        "pt": "Português", "it": "Italiano", "ru": "Русский", "ar": "العربية",
        "hi": "हिन्दी", "th": "ไทย", "id": "Bahasa Indonesia", "ms": "Bahasa Melayu",
        "tr": "Türkçe", "nl": "Nederlands", "pl": "Polski", "sv": "Svenska", "da": "Dansk",
        "fi": "Suomi", "no": "Norsk", "cs": "Čeština", "el": "Ελληνικά", "he": "עบริת",
        "ro": "Română", "hu": "Magyar", "uk": "Українська", "bg": "Български", "sk": "Slovenčina",
        "sl": "Slovenščina", "hr": "Hrvatski", "sr": "Српски", "fa": "فارسی", "bn": "বাংলা"
    };

    let targetLang = 'vi';

    const init = async () => {
        const params = new URLSearchParams(window.location.search);
        targetLang = params.get('lang') || localStorage.getItem('user_lang');

        if (!targetLang) {
            const browserLang = navigator.language.split('-')[0];
            targetLang = supportedLangs[browserLang] ? browserLang : 'vi';
        }
        localStorage.setItem('user_lang', targetLang);

        injectProfessionalDropdown(supportedLangs, targetLang);

        // Chỉ bắt đầu dịch nếu ngôn ngữ đích khác Tiếng Việt (sl=vi)
        if (targetLang !== 'vi') {
            startMasterProcess();
        }
    };

    const startMasterProcess = async () => {
        showTranslateToast(true);
        
        await translateNewNodes(document.body);
        
        let count = 0;
        const retryTimer = setInterval(() => {
            translateNewNodes(document.body);
            count++;
            if (count > 3) {
                clearInterval(retryTimer);
                showTranslateToast(false);
            }
        }, 1500);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 || node.nodeType === 3) {
                            const target = node.nodeType === 3 ? node.parentElement : node;
                            if (target) translateNewNodes(target);
                        }
                    });
                }
                if (mutation.type === 'characterData') {
                    translateNewNodes(mutation.target.parentElement);
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    };

    async function translateNewNodes(rootNode) {
        // Kiểm tra nếu node hiện tại hoặc cha của nó có đánh dấu không dịch
        if (!rootNode || rootNode.closest?.('#notranslate') || rootNode.closest?.('.notranslate')) return;
        
        const textNodes = [];
        const walk = (node) => {
            // Loại bỏ các thẻ kỹ thuật và vùng cấm dịch
            if (node.id === 'notranslate' || 
                node.classList?.contains('notranslate') || 
                ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT'].includes(node.tagName)) return;

            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 1) {
                // Kiểm tra nếu có chứa ký tự chữ cái
                if (/[a-zA-Zà-ỹÀ-Ỹ]/.test(node.textContent) && !node._isTranslated) {
                    textNodes.push(node);
                }
            } else {
                node.childNodes.forEach(walk);
            }
        };

        walk(rootNode);

        // Xử lý dịch tuần tự để tránh spam quá tải API cùng lúc
        for (const node of textNodes) {
            const originalText = node.textContent.trim();
            const translated = await fetchWithRetry(originalText, targetLang);
            if (translated && translated !== originalText) {
                node.textContent = translated;
                node._isTranslated = true;
            }
        }
    }

    async function fetchWithRetry(text, target, retries = 2) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error();
                const json = await res.json();
                return json[0].map(item => item[0]).join('');
            } catch (err) {
                if (i === retries - 1) return text;
                await new Promise(r => setTimeout(r, 800));
            }
        }
    }

    function injectProfessionalDropdown(langs, current) {
        if (document.getElementById('notranslate')) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'notranslate';
        // Thêm class notranslate để các trình duyệt (Chrome/Google) không tự dịch đè lên
        wrapper.className = 'notranslate'; 
        wrapper.style.cssText = "position:fixed; bottom:20px; right:20px; z-index:2147483647;";

        const select = document.createElement('select');
        // Thêm thuộc tính chặn dịch trực tiếp cho thẻ select
        select.setAttribute('translate', 'no');
        select.style.cssText = "appearance:none; background:#fff; border:1px solid #e0e0e0; padding:8px 30px 8px 12px; border-radius:8px; font-size:13px; box-shadow:0 2px 10px rgba(0,0,0,0.1); outline:none; cursor:pointer; background-image:url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%23333\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 9l6 6 6-6\"/></svg>'); background-repeat:no-repeat; background-position:right 8px center; font-family:system-ui, -apple-system, sans-serif; color:#333;";

        for (const [code, name] of Object.entries(langs)) {
            const opt = new Option(name, code);
            if (code === current) opt.selected = true;
            select.add(opt);
        }

        select.addEventListener('change', function() {
            localStorage.setItem('user_lang', this.value);
            const url = new URL(window.location.href);
            url.searchParams.set('lang', this.value);
            window.location.href = url.toString();
        });

        wrapper.appendChild(select);
        document.body.appendChild(wrapper);
    }

    function showTranslateToast(show) {
        let toast = document.getElementById('translate-status');
        if (show) {
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'translate-status';
                toast.className = 'notranslate';
                toast.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.75); color:#fff; padding:8px 16px; border-radius:20px; font-size:12px; z-index:2147483647; backdrop-filter:blur(4px); transition:opacity 0.3s; display:flex; align-items:center; gap:8px; pointer-events:none;";
                toast.innerHTML = `<div class="tr-loader"></div> Translating...`;
                
                const style = document.createElement('style');
                style.innerHTML = ".tr-loader{width:12px; height:12px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; animation:tr-spin 0.6s linear infinite;} @keyframes tr-spin{to{transform:rotate(360deg)}}";
                document.head.appendChild(style);
                document.body.appendChild(toast);
            }
            toast.style.opacity = "1";
        } else if (toast) {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 300);
        }
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
        init();
    } else {
        window.addEventListener("DOMContentLoaded", init);
    }
})();
