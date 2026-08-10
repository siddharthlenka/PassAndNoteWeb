"use strict";
const PassNoteCrypto = (() => {
  const encoder = new TextEncoder(),
    decoder = new TextDecoder(),
    iterations = 600000;
  const iosDate = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  function toBase64(bytes) {
    let value = "";
    for (let i = 0; i < bytes.length; i += 32768)
      value += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(value);
  }
  function fromBase64(value) {
    const raw = atob(value),
      bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }
  async function key(password, salt, rounds = iterations) {
    if (!password) throw Error("Password is required.");
    const material = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }
  async function encrypt(payload, contentType, password) {
    const salt = crypto.getRandomValues(new Uint8Array(32)),
      nonce = crypto.getRandomValues(new Uint8Array(12)),
      secret = await key(password, salt),
      cipher = new Uint8Array(
        await crypto.subtle.encrypt(
          { name: "AES-GCM", iv: nonce, tagLength: 128 },
          secret,
          encoder.encode(JSON.stringify(payload)),
        ),
      ),
      combined = new Uint8Array(nonce.length + cipher.length);
    combined.set(nonce);
    combined.set(cipher, nonce.length);
    return {
      magic: "PASSNOTE",
      formatVersion: 1,
      contentType,
      itemCount: count(contentType, payload),
      createdAt: iosDate(),
      encryption: { algorithm: "AES-256-GCM", version: 1 },
      kdf: {
        algorithm: "PBKDF2-HMAC-SHA256",
        version: 1,
        iterations,
        keyLength: 32,
      },
      salt: toBase64(salt),
      sealedPayload: toBase64(combined),
    };
  }
  async function decrypt(input, password, expected) {
    const box = typeof input === "string" ? JSON.parse(input) : input;
    if (box.magic !== "PASSNOTE" || box.formatVersion !== 1)
      throw Error("This is not a valid Pass & Note backup.");
    if (expected && box.contentType !== expected)
      throw Error("This backup type cannot be imported here.");
    if (!["passwords", "notes", "fullVault"].includes(box.contentType))
      throw Error("Unsupported backup type.");
    if (
      box.encryption?.algorithm !== "AES-256-GCM" ||
      box.encryption?.version !== 1 ||
      box.kdf?.algorithm !== "PBKDF2-HMAC-SHA256" ||
      box.kdf?.version !== 1 ||
      box.kdf?.keyLength !== 32
    )
      throw Error("Unsupported encryption settings.");
    const combined = fromBase64(box.sealedPayload),
      nonce = combined.slice(0, 12),
      cipher = combined.slice(12),
      secret = await key(password, fromBase64(box.salt), box.kdf.iterations);
    try {
      return {
        container: box,
        payload: JSON.parse(
          decoder.decode(
            await crypto.subtle.decrypt(
              { name: "AES-GCM", iv: nonce, tagLength: 128 },
              secret,
              cipher,
            ),
          ),
        ),
      };
    } catch {
      throw Error("Unable to decrypt. Check the backup password.");
    }
  }
  function count(type, p) {
    return type === "passwords"
      ? (p.passwords || []).length
      : type === "notes"
        ? (p.notes || []).length
        : (p.passwords || []).length + (p.notes || []).length;
  }
  return { encrypt, decrypt, iosDate, count };
})();
