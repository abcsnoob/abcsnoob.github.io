/**
 * ABCS Binary Format Parser - DeepMind Edition
 * Chuyên dụng cho Abc's Noob AI
 */
const ABCSParser = {
    MAGIC: "ABCSNOOBDEEPMIND", // 16 bytes
    VERSION: 0x01,
    XOR_KEY: [0x41, 0x62, 0x63, 0x53, 0x41, 0x49, 0x44, 0x45, 0x45, 0x50], // Key: AbcSAIDEEP

    _applyXor: function(uint8Array) {
        for (let i = 0; i < uint8Array.length; i++) {
            uint8Array[i] = uint8Array[i] ^ this.XOR_KEY[i % this.XOR_KEY.length];
        }
        return uint8Array;
    },

    // Chuyển lịch sử chat sang ArrayBuffer (Binary)
    serialize: function(history) {
        const encoder = new TextEncoder();
        let headerSize = 24; 
        let totalSize = headerSize;
        
        const prepared = history.map(msg => {
            const roleMap = { 'user': 0x01, 'model': 0x02, 'assistant': 0x02, 'system': 0x03 };
            const roleByte = roleMap[msg.role] || 0x01;
            // Gom tất cả text trong parts
            const text = msg.parts.map(p => p.text || "").join("");
            
            let bytes = encoder.encode(text);
            bytes = this._applyXor(new Uint8Array(bytes)); 

            totalSize += 1 + 4 + bytes.length;
            return { roleByte, bytes };
        });

        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);
        let offset = 0;

        // Header: Magic (16) + Ver (1) + Flags (1) + Time (4) + Count (2)
        for (let i = 0; i < this.MAGIC.length; i++) view.setUint8(offset++, this.MAGIC.charCodeAt(i));
        view.setUint8(offset++, this.VERSION);
        view.setUint8(offset++, 0x01); // Flag 0x01 = XOR Active
        view.setUint32(offset, Math.floor(Date.now() / 1000)); offset += 4;
        view.setUint16(offset, prepared.length); offset += 2;

        // Data Blocks: [Role:1][Len:4][Data:N]
        prepared.forEach(m => {
            view.setUint8(offset++, m.roleByte);
            view.setUint32(offset, m.bytes.length); offset += 4;
            new Uint8Array(buffer, offset, m.bytes.length).set(m.bytes);
            offset += m.bytes.length;
        });

        return buffer;
    },

    // Giải mã ArrayBuffer về mảng JSON
    deserialize: function(buffer) {
        const view = new DataView(buffer);
        const decoder = new TextDecoder();
        let offset = 0;

        let checkMagic = "";
        for(let i=0; i<16; i++) checkMagic += String.fromCharCode(view.getUint8(offset++));
        if (checkMagic !== this.MAGIC) throw new Error("Sai định dạng ABCS!");

        const version = view.getUint8(offset++);
        const flags = view.getUint8(offset++);
        const timestamp = view.getUint32(offset); offset += 4;
        const msgCount = view.getUint16(offset); offset += 2;

        const history = [];
        for (let i = 0; i < msgCount; i++) {
            const roleByte = view.getUint8(offset++);
            const len = view.getUint32(offset); offset += 4;
            
            let contentBytes = new Uint8Array(buffer.slice(offset, offset + len));
            if (flags === 0x01) contentBytes = this._applyXor(contentBytes);

            const text = decoder.decode(contentBytes);
            offset += len;

            history.push({
                role: roleByte === 0x01 ? 'user' : (roleByte === 0x02 ? 'model' : 'system'),
                parts: [{ text: text }],
                time: new Date(timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            });
        }
        return history;
    }
};
