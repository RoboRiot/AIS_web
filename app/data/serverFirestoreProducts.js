import { FieldPath } from "firebase-admin/firestore";
import { getAdminDb } from "@/app/data/firebaseAdmin";

const productFromDocument = (document) =>
  document?.exists ? { id: document.id, ...document.data() } : null;

export const fetchProductById = async (id) => {
  if (!id) return null;
  const document = await getAdminDb().collection("Parts").doc(id).get();
  return productFromDocument(document);
};

export const fetchProductBySlug = async (slug) => {
  if (!slug) return null;
  const snapshot = await getAdminDb()
    .collection("Parts")
    .where("Slug", "==", slug)
    .limit(1)
    .get();
  return snapshot.empty ? null : productFromDocument(snapshot.docs[0]);
};

export const fetchAllProducts = async () => {
  const db = getAdminDb();
  const products = [];
  let cursor = null;

  do {
    let query = db
      .collection("Parts")
      .select("Name", "PN", "Description", "OEM", "Modality", "Machine", "UpdatedAt")
      .orderBy(FieldPath.documentId())
      .limit(500);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    products.push(...snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
    cursor = snapshot.docs.length === 500 ? snapshot.docs[snapshot.docs.length - 1] : null;
  } while (cursor);

  return products;
};
