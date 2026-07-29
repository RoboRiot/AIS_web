import { NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { getAdminDb } from "@/app/data/firebaseAdmin";
import {
  cleanText,
  consumeRateLimit,
  isLikelyAutomation,
  signCursor,
  verifyCursor,
} from "@/app/data/requestSecurity";
import {
  getCatalogSearchScore,
  normalizeCatalogPartNumber,
  normalizeCatalogSearchText,
} from "@/app/data/partCatalogSearch.mjs";
import {
  getCatalogPartNumberLookupTerm,
  getCatalogSearchLookupTerm,
} from "@/app/data/partCatalogIndex.mjs";
import {
  isCampaignReadyProduct,
  normalizePublicCatalogProduct,
} from "@/app/data/catalogProductQuality.mjs";
import { fetchRelevantCatalogPage } from "@/app/data/serverFirestoreProducts";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";


const PAGE_SIZE = 12;
const MAX_SEARCH_CANDIDATES = 750;

const querySignature = (values) =>
  JSON.stringify([
    values.name,
    values.partNumber,
    values.oem,
    values.modality,
    values.model,
    values.sortMode,
    values.direction,
  ]);

export async function GET(request) {
  try {
    if (isLikelyAutomation(request)) {
      return NextResponse.json({ error: "Automated catalog access is not allowed." }, { status: 403 });
    }

    const db = getAdminDb();
    const allowed = await consumeRateLimit({
      db,
      request,
      namespace: "parts-search",
      limit: 80,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many catalog searches. Please wait a moment." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const params = request.nextUrl.searchParams;
    const requestedSort = cleanText(params.get("sort"), 20);
    const values = {
      name: normalizeCatalogSearchText(cleanText(params.get("q"), 120)),
      partNumber: normalizeCatalogPartNumber(cleanText(params.get("pn"), 120)),
      oem: cleanText(params.get("oem"), 80),
      modality: cleanText(params.get("modality"), 40),
      model: cleanText(params.get("model"), 120),
      sortMode:
        requestedSort === "asc"
          ? "a-z"
          : requestedSort === "desc"
            ? "z-a"
            : "relevant",
      direction: requestedSort === "desc" ? "desc" : "asc",
    };
    const signature = querySignature(values);
    let query = db.collection("Parts");

    if (values.oem) query = query.where("OEM", "==", values.oem);
    if (values.modality) query = query.where("Modality", "==", values.modality);
    if (values.model) query = query.where("Machine", "==", values.model);

    const cursor = verifyCursor(params.get("cursor"));
    const hasSearch = Boolean(values.name || values.partNumber);
    let products;
    let hasNextPage;
    let nextCursor;
    let totalMatches = null;

    if (hasSearch) {
      const lookupField = values.partNumber ? "PNPrefixes" : "SearchTerms";
      const lookupValue = values.partNumber
        ? getCatalogPartNumberLookupTerm(values.partNumber)
        : getCatalogSearchLookupTerm(values.name);

      if (!lookupValue || lookupValue.length < 2) {
        return NextResponse.json(
          {
            products: [],
            nextCursor: null,
            hasNextPage: false,
            pageSize: PAGE_SIZE,
            totalMatches: 0,
          },
          { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } }
        );
      }

      let snapshot;
      try {
        snapshot = await query
          .where(lookupField, "array-contains", lookupValue)
          .limit(MAX_SEARCH_CANDIDATES)
          .get();
      } catch (error) {
        if (error?.code !== 9 && error?.code !== "failed-precondition") throw error;
        snapshot = await query.limit(MAX_SEARCH_CANDIDATES).get();
      }
      if (snapshot.empty) {
        // Keep searches working during the one-time metadata backfill without
        // allowing an unbounded collection scan.
        snapshot = await query.limit(MAX_SEARCH_CANDIDATES).get();
      }
      const direction = values.direction === "desc" ? -1 : 1;
      const ranked = snapshot.docs
        .map((document) => {
          const product = normalizePublicCatalogProduct({
            id: document.id,
            ...document.data(),
          });
          return { product, score: getCatalogSearchScore(product, values) };
        })
        .filter((result) => result.score > 0 && isCampaignReadyProduct(result.product))
        .sort((left, right) => {
          if (left.score !== right.score) return right.score - left.score;
          const leftName = normalizeCatalogSearchText(left.product.Name);
          const rightName = normalizeCatalogSearchText(right.product.Name);
          const nameComparison = leftName.localeCompare(rightName);
          if (nameComparison !== 0) return nameComparison * direction;
          return String(left.product.id).localeCompare(String(right.product.id)) * direction;
        });

      const offset = cursor?.signature === signature && Number.isSafeInteger(cursor.offset)
        ? Math.max(0, cursor.offset)
        : 0;
      const visible = ranked.slice(offset, offset + PAGE_SIZE);
      products = visible.map((result) => result.product);
      totalMatches = ranked.length;
      hasNextPage = offset + PAGE_SIZE < ranked.length;
      nextCursor = hasNextPage
        ? signCursor({ offset: offset + PAGE_SIZE, signature })
        : null;
    } else if (
      values.sortMode === "relevant" &&
      !values.oem &&
      !values.modality &&
      !values.model
    ) {
      const relevantCatalog = await fetchRelevantCatalogPage(PAGE_SIZE);
      products = relevantCatalog.products;
      totalMatches = relevantCatalog.totalMatches;
      hasNextPage = false;
      nextCursor = null;
    } else {
      query = query
        .orderBy("NameNormalized", values.direction)
        .orderBy(FieldPath.documentId(), values.direction);

      if (cursor?.id && cursor.signature === signature) {
        const cursorSnapshot = await db.collection("Parts").doc(cursor.id).get();
        if (cursorSnapshot.exists) query = query.startAfter(cursorSnapshot);
      }

      const fetchLimit = PAGE_SIZE * 4 + 1;
      const snapshot = await query.limit(fetchLimit).get();
      const readyDocuments = snapshot.docs.filter((document) =>
        isCampaignReadyProduct({ id: document.id, ...document.data() })
      );
      const visible = readyDocuments.slice(0, PAGE_SIZE);
      products = visible.map((document) =>
        normalizePublicCatalogProduct({ id: document.id, ...document.data() })
      );
      hasNextPage =
        visible.length > 0 &&
        (readyDocuments.length > PAGE_SIZE || snapshot.docs.length === fetchLimit);
      nextCursor = hasNextPage && visible.length
        ? signCursor({ id: visible[visible.length - 1].id, signature })
        : null;
    }

    return NextResponse.json(
      {
        products,
        nextCursor,
        hasNextPage,
        pageSize: PAGE_SIZE,
        totalMatches,
        sort: values.sortMode,
      },
      { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } }
    );
  } catch (error) {
    console.error("Parts search failed:", error);
    return NextResponse.json(
      { error: "Unable to load this catalog view right now." },
      { status: 500 }
    );
  }
}
