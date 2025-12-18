/**
 * warn.js
 * Hiển thị cảnh báo bảo mật trong Browser Console
 */

(function() {
    // Định dạng CSS cho dòng tiêu đề
    const headerStyle = `
        color: #ff4757; 
        font-size: 40px; 
        font-weight: bold; 
        text-shadow: 2px 2px 0px black;
        font-family: sans-serif;
    `;

    // Định dạng CSS cho nội dung cảnh báo
    const bodyStyle = `
        color: #ffa502; 
        font-size: 18px; 
        font-weight: bold;
        line-height: 1.5;
    `;

    // Định dạng CSS cho dòng thông tin liên hệ
    const contactStyle = `
        color: #2ed573; 
        font-size: 14px;
        font-style: italic;
    `;

    // In các thông điệp ra Console
    console.log("%cÊ KHOAN ĐÃ!", headerStyle);
    
    console.log(
        "%cNếu bạn định dán code vào đây từ chỗ nào đó, thì bạn có thể mất luôn 1 cái gì đó mà đến cả tôi cũng không biết.", 
        bodyStyle
    );

    console.log(
        "%cNếu bạn biết chính xác mình đang làm gì, hãy ping Discord của mình để chúng ta trò chuyện bảo mật nhé! :)", 
        contactStyle
    );
})();