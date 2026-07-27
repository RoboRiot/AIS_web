const MAX_PRODUCTS = 24;

export const fetchProducts = async ({
  oem = '',
  modality = '',
  limit = 12,
  signal,
} = {}) => {
  try {
    const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), MAX_PRODUCTS);
    const params = new URLSearchParams({ sort: 'asc' });
    if (oem) params.set('oem', oem);
    if (modality) params.set('modality', modality);

    const response = await fetch(`/api/parts/search?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to load products.');
    }

    return (Array.isArray(payload.products) ? payload.products : []).slice(0, safeLimit);
  } catch (error) {
    if (error?.name === 'AbortError') return [];
    console.error("Error fetching products:", error);
    return [];
  }
};
