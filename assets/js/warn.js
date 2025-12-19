/**
 * warn.js
 * Luồng hiển thị cảnh báo bảo mật độc lập
 */
(async function() {
    const params = new URLSearchParams(window.location.search);
    const targetLang = params.get('lang') || localStorage.getItem('user_lang') || navigator.language.split('-')[0];

    const messages = {
        header: "Ê KHOAN ĐÃ!",
        body: "Nếu bạn định dán code vào đây từ chỗ nào đó, thì bạn có thể mất luôn 1 cái gì đó mà đến cả tôi cũng không biết.",
        contact: "Nếu bạn biết chính xác mình đang làm gì, hãy ping Discord của mình để chúng ta trò chuyện bảo mật nhé! :)"
    };

    const styles = {
        header: "color: #ff4757; font-size: 40px; font-weight: bold; text-shadow: 2px 2px 0px black; font-family: sans-serif;",
        body: "color: #ffa502; font-size: 18px; font-weight: bold; line-height: 1.5;",
        contact: "color: #2ed573; font-size: 14px; font-style: italic;"
    };

    const render = (h, b, c) => {
        console.log(`%c${h}`, styles.header);
        console.log(`%c${b}`, styles.body);
        console.log(`%c${c}`, styles.contact);
    };

    if (targetLang === 'vi' || !targetLang) {
        render(messages.header, messages.body, messages.contact);
    } else {
        try {
            // Luồng dịch riêng biệt cho Log
            const translate = async (text) => {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
                const res = await fetch(url);
                const json = await res.json();
                return json[0].map(item => item[0]).join('');
            };

            const [h, b, c] = await Promise.all([
                translate(messages.header),
                translate(messages.body),
                translate(messages.contact)
            ]);
            render(h, b, c);
        } catch (e) {
            // Fail-safe: Nếu lỗi API, hiện tiếng Việt còn hơn không hiện gì
            render(messages.header, messages.body, messages.contact);
        }
    }
})();
