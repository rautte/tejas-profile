// src/utils/profileVariant/sha256.js


function bytesToHex(
  bytes
) {
  return Array.from(
    bytes
  )
    .map(
      (byte) =>
        byte
          .toString(16)
          .padStart(
            2,
            "0"
          )
    )
    .join("");
}


function requireSubtle(
  subtle
) {
  if (
    !subtle ||
    typeof subtle.digest !==
      "function"
  ) {
    throw new Error(
      "SHA-256 requires Web Crypto subtle.digest."
    );
  }
}


function getDefaultSubtle() {
  if (
    typeof window ===
    "undefined"
  ) {
    return undefined;
  }


  return window
    .crypto
    ?.subtle;
}


function getDefaultTextEncoder() {
  if (
    typeof window ===
    "undefined"
  ) {
    return undefined;
  }


  return window
    .TextEncoder;
}


/**
 * SHA-256 for raw binary data.
 *
 * Accepts ArrayBuffer or any ArrayBuffer view, including:
 * - Uint8Array
 * - Buffer in Node tests
 * - browser File/Blob ArrayBuffer views later
 */
export async function sha256BytesHex(
  input,
  {
    subtle =
      getDefaultSubtle(),
  } = {}
) {
  requireSubtle(
    subtle
  );


  let bytes;


  if (
    input instanceof
      ArrayBuffer
  ) {
    bytes =
      new Uint8Array(
        input
      );
  } else if (
    ArrayBuffer.isView(
      input
    )
  ) {
    bytes =
      new Uint8Array(
        input.buffer,
        input.byteOffset,
        input.byteLength
      );
  } else {
    throw new Error(
      "SHA-256 binary input must be an ArrayBuffer or ArrayBuffer view."
    );
  }


  const digest =
    await subtle.digest(
      "SHA-256",
      bytes
    );


  return bytesToHex(
    new Uint8Array(
      digest
    )
  );
}


/**
 * SHA-256 for UTF-8 text.
 */
export async function sha256Hex(
  input,
  {
    subtle =
      getDefaultSubtle(),

    TextEncoderImpl =
      getDefaultTextEncoder(),
  } = {}
) {
  requireSubtle(
    subtle
  );


  if (
    typeof TextEncoderImpl !==
      "function"
  ) {
    throw new Error(
      "SHA-256 requires TextEncoder."
    );
  }


  const bytes =
    new TextEncoderImpl()
      .encode(
        String(
          input ?? ""
        )
      );


  return sha256BytesHex(
    bytes,
    {
      subtle,
    }
  );
}