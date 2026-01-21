// src/utils/crypto/sha256.js

export async function sha256File(fileOrBlob) {
  const buf = await fileOrBlob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return bufferToHex(hash);
}

function bufferToHex(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}
