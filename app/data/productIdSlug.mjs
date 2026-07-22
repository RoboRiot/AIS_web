const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const encodeProductId = (value) => {
  const id = String(value ?? "");
  if (!id) return "";
  return [...textEncoder.encode(id)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const decodeProductId = (value) => {
  const encoded = String(value ?? "");
  if (!encoded || encoded.length % 2 !== 0 || !/^[a-f0-9]+$/i.test(encoded)) return null;

  try {
    const bytes = new Uint8Array(encoded.length / 2);
    for (let index = 0; index < encoded.length; index += 2) {
      bytes[index / 2] = Number.parseInt(encoded.slice(index, index + 2), 16);
    }
    return textDecoder.decode(bytes) || null;
  } catch {
    return null;
  }
};

export const buildProductIdSuffix = (id) => {
  const encoded = encodeProductId(id);
  return encoded ? `--id-${encoded}` : "";
};

export const parseProductIdSuffix = (slug) => {
  const match = String(slug ?? "").match(/--id-([a-f0-9]+)$/i);
  return match ? decodeProductId(match[1]) : null;
};
