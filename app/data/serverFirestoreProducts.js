import { FieldPath } from "firebase-admin/firestore";
import { unstable_cache } from "next/cache";
import { getAdminDb } from "@/app/data/firebaseAdmin";
import { toPlainFirestoreData } from "@/app/data/plainFirestoreData.mjs";
import {
  isCampaignReadyProduct,
  normalizePublicCatalogProduct,
} from "@/app/data/catalogProductQuality.mjs";
import {
  rankRelevantCatalogProducts,
  relevantCatalogSearchTerms,
} from "@/app/data/catalogRelevance.mjs";

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

const buildRelevantCatalog = unstable_cache(
  async () => {
    const db = getAdminDb();
    const interestScores = new Map();

    const [interestSnapshot, eventSnapshot, ...candidateSnapshots] = await Promise.all([
      db
        .collection("WebsiteProductInterestVerified")
        .orderBy("score", "desc")
        .limit(80)
        .get()
        .catch(() => null),
      db
        .collection("WebsiteAnalyticsEvents")
        .where("analyticsVersion", "==", 2)
        .limit(180)
        .get()
        .catch(() => null),
      ...relevantCatalogSearchTerms.map((term) =>
        db
          .collection("Parts")
          .where("SearchTerms", "array-contains", term)
          .limit(10)
          .get()
          .catch(() => null)
      ),
    ]);

    interestSnapshot?.docs.forEach((document) => {
      const data = document.data();
      const productId = String(data.productId || "");
      if (!productId) return;
      interestScores.set(productId, Number(data.score) || 0);
    });

    eventSnapshot?.docs.forEach((document) => {
      const data = document.data();
      if (!["product_view", "product_select"].includes(data.eventType)) return;
      const productId = String(
        data.properties?.product_id || data.properties?.item_id || ""
      );
      if (!productId) return;
      const weight = data.eventType === "product_select" ? 4 : 1;
      interestScores.set(productId, (interestScores.get(productId) || 0) + weight);
    });

    const productsById = new Map();
    candidateSnapshots.forEach((snapshot) => {
      readyProductsFromDocuments(snapshot?.docs || []).forEach((product) => {
        productsById.set(String(product.id), product);
      });
    });

    const interestIds = [...interestScores.keys()].slice(0, 100);
    if (interestIds.length) {
      const references = interestIds.map((id) => db.collection("Parts").doc(id));
      const documents = await db.getAll(...references);
      readyProductsFromDocuments(documents).forEach((product) => {
        productsById.set(String(product.id), product);
      });
    }

    return rankRelevantCatalogProducts(
      [...productsById.values()],
      interestScores,
      36
    );
  },
  ["parts-relevant-catalog-v2"],
  { revalidate: 900 }
);

export const fetchRelevantCatalogPage = async (limit = 12) => {
  const pageSize = Math.min(Math.max(Number(limit) || 12, 1), 24);
  const rankedProducts = await buildRelevantCatalog();
  const products = rankedProducts.slice(0, pageSize);

  return {
    products,
    hasNextPage: false,
    nextCursor: null,
    totalMatches: rankedProducts.length,
    sort: "relevant",
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
