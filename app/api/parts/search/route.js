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
export const dynamic = "force-dynamic";
export const runtime = "nodejs";


const PAGE_SIZE = 12;

const normalizeName = (value) =>
  cleanText(value, 120)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const normalizePartNumber = (value) =>
  cleanText(value, 120).toUpperCase().replace(/[^A-Z0-9]/g, "");

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
      name: normalizeName(params.get("q")),
      partNumber: normalizePartNumber(params.get("pn")),
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

    const orderField = values.partNumber ? "PNNormalized" : "NameNormalized";
    const prefix = values.partNumber || values.name;
    if (prefix) {
      query = query
        .where(orderField, ">=", prefix)
        .where(orderField, "<=", `${prefix}\uf8ff`);
    }

    query = query
      .orderBy(orderField, values.direction)
      .orderBy(FieldPath.documentId(), values.direction);

    const cursor = verifyCursor(params.get("cursor"));
    if (cursor?.id && cursor.signature === signature) {
      const cursorSnapshot = await db.collection("Parts").doc(cursor.id).get();
      if (cursorSnapshot.exists) query = query.startAfter(cursorSnapshot);
    }

    const snapshot = await query.limit(PAGE_SIZE + 1).get();
    const visible = snapshot.docs.slice(0, PAGE_SIZE);
    const products = visible.map((document) => ({ id: document.id, ...document.data() }));
    const hasNextPage = snapshot.docs.length > PAGE_SIZE;
    const nextCursor = hasNextPage && visible.length
      ? signCursor({ id: visible[visible.length - 1].id, signature })
      : null;

    return NextResponse.json(
      { products, nextCursor, hasNextPage, pageSize: PAGE_SIZE },
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
