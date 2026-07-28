import { FieldPath } from "firebase-admin/firestore";
import { getAdminDb } from "@/app/data/firebaseAdmin";
import { toPlainFirestoreData } from "@/app/data/plainFirestoreData.mjs";
import {
  isCampaignReadyProduct,
  normalizePublicCatalogProduct,
} from "@/app/data/catalogProductQuality.mjs";
import { signCursor } from "@/app/data/requestSecurity";

const productFromDocument = (document) =>
  document?.exists
    ? normalizePublicCatalogProduct(
        toPlainFirestoreData({ id: document.id, ...document.data() })
      )
    : null;

const readyProductsFromDocuments = (documents) =>
  documents
    .map(productFromDocument)
    .filter((product) => product && isCampaignReadyProduct(product));

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
      .select(
        "Name",
        "PN",
        "Description",
        "OEM",
        "Modality",
        "Machine",
        "Slug",
        "PrimaryImage",
        "Images",
        "ImagePaths",
        "Hidden",
        "WebsiteHidden",
        "WebsiteVisible",
        "Published",
        "Status",
        "UpdatedAt"
      )
      .orderBy(FieldPath.documentId())
      .limit(500);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    products.push(...readyProductsFromDocuments(snapshot.docs));
    cursor = snapshot.docs.length === 500 ? snapshot.docs[snapshot.docs.length - 1] : null;
  } while (cursor);

  return products;
};

const defaultQuerySignature = JSON.stringify(["", "", "", "", "", "asc"]);

export const fetchInitialCatalogPage = async (limit = 12) => {
  const pageSize = Math.min(Math.max(Number(limit) || 12, 1), 24);
  const fetchLimit = pageSize * 4 + 1;
  const snapshot = await getAdminDb()
    .collection("Parts")
    .orderBy("NameNormalized", "asc")
    .orderBy(FieldPath.documentId(), "asc")
    .limit(fetchLimit)
    .get();
  const readyDocuments = snapshot.docs.filter((document) =>
    isCampaignReadyProduct({ id: document.id, ...document.data() })
  );
  const visibleDocuments = readyDocuments.slice(0, pageSize);
  const products = readyProductsFromDocuments(visibleDocuments);
  const lastDocument = visibleDocuments[visibleDocuments.length - 1];
  const hasNextPage =
    Boolean(lastDocument) &&
    (readyDocuments.length > pageSize || snapshot.docs.length === fetchLimit);

  return {
    products,
    hasNextPage,
    nextCursor:
      hasNextPage && lastDocument
        ? signCursor({ id: lastDocument.id, signature: defaultQuerySignature })
        : null,
  };
};

export const fetchCatalogProductsByCategory = async ({
  oem,
  modality,
  limit = 24,
}) => {
  const pageSize = Math.min(Math.max(Number(limit) || 24, 1), 48);
  const snapshot = await getAdminDb()
    .collection("Parts")
    .where("OEM", "==", oem)
    .where("Modality", "==", modality)
    .orderBy("NameNormalized", "asc")
    .orderBy(FieldPath.documentId(), "asc")
    .limit(pageSize * 3)
    .get();

  return readyProductsFromDocuments(snapshot.docs).slice(0, pageSize);
};
