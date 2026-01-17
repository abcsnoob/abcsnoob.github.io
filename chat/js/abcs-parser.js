/**
 * Tiện ích mã hóa sử dụng Web Crypto API
 */
const CryptoUtil = {
    async deriveKey(password, salt) {
        const enc = new TextEncoder();
        const baseKey = await crypto.subtle.importKey(
            "raw",
            enc.encode(password),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        return crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt,
                iterations: 100000,
                hash: "SHA-256"
            },
            baseKey,
            {
                name: "AES-GCM",
                length: 256
            },
            false,
            ["encrypt", "decrypt"]
        );
    }
};

/**
 * Bộ nén và mã hóa lịch sử trò chuyện (.abcsaihistory)
 */
const ABCSParser = {
    MAGIC: "ABCSNOOBDEEPMIND",
    VERSION: 0x03,

    ROLE_MAP: { user: 0x01, model: 0x02, assistant: 0x03, system: 0x04 },
    ROLE_MAP_REV: { 0x01: "user", 0x02: "model", 0x03: "assistant", 0x04: "system" },

    async serialize(history, password) {
        const enc = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const key = await CryptoUtil.deriveKey(password, salt);

        const blocks = [];
        for (const msg of history) {
            const roleByte = this.ROLE_MAP[msg.role] || 0x01;
            const text = msg.parts[0].text;
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const cipher = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv },
                key,
                enc.encode(text)
            );
            
            const block = new Uint8Array(1 + 12 + 4 + cipher.byteLength);
            block[0] = roleByte;
            block.set(iv, 1);
            new DataView(block.buffer).setUint32(13, cipher.byteLength);
            block.set(new Uint8Array(cipher), 17);
            blocks.push(block);
        }

        const totalLen = 16 + 1 + 1 + 16 + 4 + 2 + blocks.reduce((a, b) => a + b.length, 0);
        const final = new Uint8Array(totalLen);
        const view = new DataView(final.buffer);
        let off = 0;

        enc.encode(this.MAGIC).forEach(b => final[off++] = b);
        final[off++] = this.VERSION;
        final[off++] = 0; // Flags
        final.set(salt, off); off += 16;
        view.setUint32(off, Math.floor(Date.now() / 1000)); off += 4;
        view.setUint16(off, blocks.length); off += 2;
        
        blocks.forEach(b => {
            final.set(b, off);
            off += b.length;
        });

        return final;
    },

    async deserialize(buffer, password) {
        const dec = new TextDecoder();
        const view = new DataView(buffer);
        let off = 0;

        const magic = dec.decode(buffer.slice(0, 16));
        if (magic !== this.MAGIC) throw new Error("FILE_INVALID");
        off = 16;

        const version = view.getUint8(off++);
        if (version !== this.VERSION) throw new Error("VERSION_MISMATCH");

        off++; // skip flags
        const salt = new Uint8Array(buffer.slice(off, off + 16)); off += 16;
        off += 4; // skip timestamp
        const count = view.getUint16(off); off += 2;

        const key = await CryptoUtil.deriveKey(password, salt);
        const history = [];

        for (let i = 0; i < count; i++) {
            const roleByte = view.getUint8(off++);
            const iv = new Uint8Array(buffer.slice(off, off + 12)); off += 12;
            const len = view.getUint32(off); off += 4;
            const cipher = buffer.slice(off, off + len); off += len;

            const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
            history.push({
                role: this.ROLE_MAP_REV[roleByte] || "user",
                parts: [{ text: dec.decode(plain) }]
            });
        }
        return history;
    }
};
