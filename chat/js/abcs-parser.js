const ABCSParser = {
    MAGIC: "ABCSNOOBDEEPMIND",
    VERSION: 0x03,

    ROLE_MAP: {
        user: 0x01,
        model: 0x02,
        assistant: 0x03,
        system: 0x04
    },

    ROLE_MAP_REV: {
        0x01: "user",
        0x02: "model",
        0x03: "assistant",
        0x04: "system"
    },

    /* ================= SERIALIZE ================= */

    async serialize(history, password) {
        const enc = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const key = await CryptoUtil.deriveKey(password, salt);

        const blocks = [];

        for (const msg of history) {
            const role = this.ROLE_MAP[msg.role] ?? 0x01;
            const text = msg.parts?.map(p => p.text ?? "").join("") ?? "";

            const iv = crypto.getRandomValues(new Uint8Array(12));
            const cipher = new Uint8Array(
                await crypto.subtle.encrypt(
                    { name: "AES-GCM", iv },
                    key,
                    enc.encode(text)
                )
            );

            blocks.push({ role, iv, cipher });
        }

        const headerSize =
            this.MAGIC.length +
            1 + // version
            1 + // flags
            16 + // salt
            4 + // timestamp
            2; // count

        let total = headerSize;
        for (const b of blocks)
            total += 1 + 12 + 4 + b.cipher.length;

        const buf = new ArrayBuffer(total);
        const view = new DataView(buf);
        let off = 0;

        // MAGIC
        for (const c of this.MAGIC) view.setUint8(off++, c.charCodeAt(0));
        view.setUint8(off++, this.VERSION);
        view.setUint8(off++, 0x01); // AES-GCM flag

        new Uint8Array(buf, off, 16).set(salt);
        off += 16;

        view.setUint32(off, Math.floor(Date.now() / 1000));
        off += 4;

        view.setUint16(off, blocks.length);
        off += 2;

        // Blocks
        for (const b of blocks) {
            view.setUint8(off++, b.role);
            new Uint8Array(buf, off, 12).set(b.iv);
            off += 12;

            view.setUint32(off, b.cipher.length);
            off += 4;

            new Uint8Array(buf, off, b.cipher.length).set(b.cipher);
            off += b.cipher.length;
        }

        return buf;
    },

    /* ================= DESERIALIZE ================= */

    async deserialize(buffer, password) {
        const view = new DataView(buffer);
        const dec = new TextDecoder();
        let off = 0;

        let magic = "";
        for (let i = 0; i < this.MAGIC.length; i++) {
            magic += String.fromCharCode(view.getUint8(off++));
        }
        if (magic !== this.MAGIC) throw new Error("ABCS_BAD_MAGIC");

        const version = view.getUint8(off++);
        if (version !== this.VERSION) throw new Error("ABCS_BAD_VERSION");

        off++; // flags (reserved)

        const salt = new Uint8Array(buffer.slice(off, off + 16));
        off += 16;

        const timestamp = view.getUint32(off);
        off += 4;

        const count = view.getUint16(off);
        off += 2;

        const key = await CryptoUtil.deriveKey(password, salt);
        const history = [];

        for (let i = 0; i < count; i++) {
            if (off + 17 > buffer.byteLength)
                throw new Error("ABCS_TRUNCATED");

            const roleByte = view.getUint8(off++);
            const iv = new Uint8Array(buffer.slice(off, off + 12));
            off += 12;

            const len = view.getUint32(off);
            off += 4;

            if (off + len > buffer.byteLength)
                throw new Error("ABCS_BAD_LENGTH");

            const cipher = buffer.slice(off, off + len);
            off += len;

            let plain;
            try {
                plain = await crypto.subtle.decrypt(
                    { name: "AES-GCM", iv },
                    key,
                    cipher
                );
            } catch {
                throw new Error("ABCS_DECRYPT_FAILED");
            }

            history.push({
                role: this.ROLE_MAP_REV[roleByte] ?? "user",
                parts: [{ text: dec.decode(plain) }],
                time: new Date(timestamp * 1000)
            });
        }

        return history;
    }
};
