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
export const dynamic = "force-dynamic";
export const runtime = "nodejs";


const PAGE_SIZE = 12;

const querySignature = (values) =>
  JSON.stringify([
    values.name,
    values.partNumber,
    values.oem,
    values.modality,
    values.model,
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
    const values = {
      name: normalizeCatalogSearchText(cleanText(params.get("q"), 120)),
      partNumber: normalizeCatalogPartNumber(cleanText(params.get("pn"), 120)),
      oem: cleanText(params.get("oem"), 80),
      modality: cleanText(params.get("modality"), 40),
      model: cleanText(params.get("model"), 120),
      direction: params.get("sort") === "desc" ? "desc" : "asc",
    };
    const signature = querySignature(values);
    let query = db.collection("Parts");

    if (values.oem) query = query.where("OEM", "==", values.oem);
    if (values.modality) query = query.where("Modality", "==", values.modality);
    if (values.model) query = query.where("Machine", "==", values.model);

    query = query
      .orderBy("NameNormalized", values.direction)
      .orderBy(FieldPath.documentId(), values.direction);

    const cursor = verifyCursor(params.get("cursor"));
    const hasSearch = Boolean(values.name || values.partNumber);
    let products;
    let hasNextPage;
    let nextCursor;
    let totalMatches = null;

    if (hasSearch) {
      const snapshot = await query.get();
      const direction = values.direction === "desc" ? -1 : 1;
      const ranked = snapshot.docs
        .map((document) => {
          const product = { id: document.id, ...document.data() };
          return { product, score: getCatalogSearchScore(product, values) };
        })
        .filter((result) => result.score > 0)
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
    } else {
      if (cursor?.id && cursor.signature === signature) {
        const cursorSnapshot = await db.collection("Parts").doc(cursor.id).get();
        if (cursorSnapshot.exists) query = query.startAfter(cursorSnapshot);
      }

      const snapshot = await query.limit(PAGE_SIZE + 1).get();
      const visible = snapshot.docs.slice(0, PAGE_SIZE);
      products = visible.map((document) => ({ id: document.id, ...document.data() }));
      hasNextPage = snapshot.docs.length > PAGE_SIZE;
      nextCursor = hasNextPage && visible.length
        ? signCursor({ id: visible[visible.length - 1].id, signature })
        : null;
    }

    return NextResponse.json(
      { products, nextCursor, hasNextPage, pageSize: PAGE_SIZE, totalMatches },
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
