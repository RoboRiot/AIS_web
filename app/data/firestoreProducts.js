const FIREBASE_API_KEY = "AIzaSyCxC-a8b5Vhhey8GF47LpXZ1aMKYmiIhwE";
const FIREBASE_PROJECT_ID = "magmo-ac10c";
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

const parseFirestoreValue = (value) => {
  if (value == null) return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.arrayValue !== undefined) {
    const values = value.arrayValue.values || [];
    return values.map(parseFirestoreValue);
  }
  if (value.mapValue !== undefined) {
    const fields = value.mapValue.fields || {};
    return Object.fromEntries(
      Object.entries(fields).map(([key, val]) => [key, parseFirestoreValue(val)])
    );
  }
  return null;
};

const parseFirestoreDoc = (doc) => {
  if (!doc) return null;
  const id = doc.name?.split("/").pop() || null;
  const fields = doc.fields || {};
  const data = Object.fromEntries(
    Object.entries(fields).map(([key, val]) => [key, parseFirestoreValue(val)])
  );
  return { id, ...data };
};

export const fetchProductById = async (id) => {
  if (!id) return null;
  const url = `${FIRESTORE_BASE_URL}/Parts/${encodeURIComponent(id)}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const doc = await res.json();
  return parseFirestoreDoc(doc);
};

export const fetchAllProducts = async () => {
  const products = [];
  let pageToken = "";

  while (true) {
    const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const url = `${FIRESTORE_BASE_URL}/Parts?pageSize=500${tokenParam}&key=${FIREBASE_API_KEY}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) break;

    const data = await res.json();
    const docs = data.documents || [];
    for (const doc of docs) {
      const parsed = parseFirestoreDoc(doc);
      if (parsed) products.push(parsed);
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return products;
};
