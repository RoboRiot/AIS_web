const normalizeImagePath = (imagePath) =>
  typeof imagePath === "string" ? imagePath.trim() : "";

const storageBucket =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "magmo-ac10c.appspot.com";

const directImagePattern = /^(?:https?:|data:|blob:)/i;
const imageExtensionPattern = /\.(?:avif|gif|jpe?g|png|webp)(?:\?.*)?$/i;

// The legacy temp-204 record points to a missing Storage object. Use the matching
// OEM D3887T reference image already identified in our GE catalog, without
// changing inventory data. Source and checksum accompany the bundled image.
const catalogImageReplacements = new Map([
  ["Parts/temp-204/temp-204", "/assets/images/catalog/ge-d3887t-reference.png"],
  ["Parts/temp-204/temp-204.jpg", "/assets/images/catalog/ge-d3887t-reference.png"],
]);

export const getImageUrl = async (imagePath) => {
  const normalizedPath = normalizeImagePath(imagePath);
  if (!normalizedPath) return null;
  if (catalogImageReplacements.has(normalizedPath)) {
    return catalogImageReplacements.get(normalizedPath);
  }

  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(storageBucket)}/o/${encodeURIComponent(normalizedPath)}?alt=media`;
};

export const resolveImageUrl = async (imagePath) => {
  const normalizedPath = normalizeImagePath(imagePath);
  if (!normalizedPath) return null;
  if (directImagePattern.test(normalizedPath) || normalizedPath.startsWith("/")) {
    return normalizedPath;
  }

  if (imageExtensionPattern.test(normalizedPath)) {
    return getImageUrl(normalizedPath);
  }

  return getImageUrl(`${normalizedPath}.jpg`);
};

export const getPrimaryImagePath = (product) => {
  const images = Array.isArray(product?.Images)
    ? product.Images.map(normalizeImagePath).filter(Boolean)
    : [];
  const imagePaths = Array.isArray(product?.ImagePaths)
    ? product.ImagePaths.map(normalizeImagePath).filter(Boolean)
    : [];
  const primaryImage = normalizeImagePath(product?.PrimaryImage);
  const productId = normalizeImagePath(product?.id);

  return primaryImage || images[0] || imagePaths[0] ||
    (productId ? `Parts/${productId}/${productId}` : "");
};
