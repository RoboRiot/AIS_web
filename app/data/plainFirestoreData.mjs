const isObject = (value) => value !== null && typeof value === "object";

const serializeValue = (value, seen) => {
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (["function", "symbol", "undefined"].includes(typeof value)) return undefined;
  if (value instanceof Date) return value.toISOString();

  if (!isObject(value)) return String(value);
  if (seen.has(value)) return null;
  seen.add(value);

  try {
    if (typeof value.toDate === "function") {
      const date = value.toDate();
      if (date instanceof Date) return date.toISOString();
    }

    if (
      typeof value.path === "string" &&
      value.constructor?.name?.toLowerCase().includes("reference")
    ) {
      return value.path;
    }

    if (Number.isFinite(value.latitude) && Number.isFinite(value.longitude)) {
      return { latitude: value.latitude, longitude: value.longitude };
    }

    if (typeof value.toBase64 === "function") return value.toBase64();

    if (Array.isArray(value)) {
      return value.map((entry) => {
        const serialized = serializeValue(entry, seen);
        return serialized === undefined ? null : serialized;
      });
    }

    if (typeof value.toJSON === "function") {
      const jsonValue = value.toJSON();
      if (jsonValue !== value) return serializeValue(jsonValue, seen);
    }

    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      const serialized = serializeValue(entry, seen);
      if (serialized !== undefined) output[key] = serialized;
    }
    return output;
  } finally {
    seen.delete(value);
  }
};

export const toPlainFirestoreData = (value) => serializeValue(value, new WeakSet());
