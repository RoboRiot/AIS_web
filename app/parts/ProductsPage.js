"use client";

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './search.module.scss';
import searchIcon from "@/public/assets/images/search.svg";
import brandsModels from "@/firebase/models.json";
import { getPrimaryImagePath, ImageComponent } from '@/components/fetchImages/Image';
import SidebarFoundYourPart from '../product-detail/found-your-part/SidebarFoundYourPart';
import RecentProducts from './RecentProducts';
import { buildProductHref, slugify } from '@/app/data/seoProducts';
import { trackWebsiteEvent } from '@/components/utils/analytics';

const ITEMS_PER_PAGE = 12;
const BRANDS = Object.keys(brandsModels);
const ALL_TYPES = [...new Set(
    Object.values(brandsModels).flatMap((typesByBrand) => Object.keys(typesByBrand))
)];

const normalizeSearchValue = (value) => (value ?? '')
    .toString()
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const normalizePartNumber = (value) => (value ?? '')
    .toString()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const useDebouncedValue = (value, delay = 350) => {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timeout = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(timeout);
    }, [value, delay]);

    return debounced;
};

const getModelsForType = (brand, type) => {
    if (!type) return [];
    if (brand) return brandsModels[brand]?.[type] || [];

    return [
        ...new Set(
            Object.values(brandsModels)
                .flatMap((typesByBrand) => typesByBrand[type] || [])
        ),
    ];
};

export default function ProductsPage({ initialCatalog = {} }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [skuQuery, setSkuQuery] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const initialProducts = Array.isArray(initialCatalog.products) ? initialCatalog.products : [];
    const [products, setProducts] = useState(initialProducts);
    const [isLoadingProducts, setIsLoadingProducts] = useState(initialProducts.length === 0);
    const [productsError, setProductsError] = useState('');
    const [sortOrder, setSortOrder] = useState(initialCatalog.sort || 'relevant');
    const [pageIndex, setPageIndex] = useState(0);
    const [pageCursors, setPageCursors] = useState([null]);
    const [nextCursor, setNextCursor] = useState(initialCatalog.nextCursor || null);
    const [hasNextPage, setHasNextPage] = useState(Boolean(initialCatalog.hasNextPage));
    const [totalMatches, setTotalMatches] = useState(
        Number.isInteger(initialCatalog.totalMatches) ? initialCatalog.totalMatches : null
    );
    const [selectedBrand, setSelectedBrand] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [types, setTypes] = useState(ALL_TYPES);
    const [models, setModels] = useState([]);
    const requestId = useRef(0);
    const lastTrackedSearch = useRef('');
    const skipInitialRequest = useRef(initialProducts.length > 0);
    const [urlStateReady, setUrlStateReady] = useState(false);

    const debouncedSearch = useDebouncedValue(searchQuery);
    const debouncedSku = useDebouncedValue(skuQuery);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const brand = params.get('OEM') || params.get('clickedOEM') || '';
        const type = params.get('modality') || params.get('clickedModality') || '';
        const model = params.get('model') || '';
        const requestedSort = params.get('sort');
        const hasCatalogFilter = Boolean(brand || type || model);
        setSearchQuery(params.get('q') || '');
        setSkuQuery(params.get('pn') || '');
        setSelectedBrand(brand);
        setSelectedType(type);
        setSelectedModel(model);
        setSortOrder(
            requestedSort === 'z-a' || requestedSort === 'desc'
                ? 'z-a'
                : requestedSort === 'a-z' || requestedSort === 'asc'
                    ? 'a-z'
                    : hasCatalogFilter
                        ? 'a-z'
                        : 'relevant'
        );
        setTypes(brand ? Object.keys(brandsModels[brand] || {}) : ALL_TYPES);
        setModels(getModelsForType(brand, type));
        setUrlStateReady(true);
    }, []);

    useEffect(() => {
        if (!urlStateReady) return;
        const params = new URLSearchParams();
        if (debouncedSearch) params.set('q', debouncedSearch);
        if (debouncedSku) params.set('pn', debouncedSku);
        if (selectedBrand) params.set('OEM', selectedBrand);
        if (selectedType) params.set('modality', selectedType);
        if (selectedModel) params.set('model', selectedModel);
        if (sortOrder !== 'relevant') params.set('sort', sortOrder);
        const query = params.toString();
        window.history.replaceState(null, '', query ? `/parts?${query}` : '/parts');
    }, [
        urlStateReady,
        debouncedSearch,
        debouncedSku,
        selectedBrand,
        selectedType,
        selectedModel,
        sortOrder,
    ]);

    useEffect(() => {
        setPageIndex(0);
        setPageCursors([null]);
    }, [debouncedSearch, debouncedSku, selectedBrand, selectedType, selectedModel, sortOrder]);

    useEffect(() => {
        if (!urlStateReady) return undefined;
        const isDefaultInitialView =
            !debouncedSearch &&
            !debouncedSku &&
            !selectedBrand &&
            !selectedType &&
            !selectedModel &&
            sortOrder === 'relevant' &&
            pageIndex === 0;
        if (skipInitialRequest.current && isDefaultInitialView) {
            skipInitialRequest.current = false;
            return undefined;
        }
        skipInitialRequest.current = false;

        let active = true;
        const controller = new AbortController();
        const currentRequest = ++requestId.current;

        const fetchPage = async () => {
            setIsLoadingProducts(true);
            setProductsError('');

            try {
                const searchParams = new URLSearchParams();
                if (debouncedSearch) searchParams.set('q', debouncedSearch);
                if (debouncedSku) searchParams.set('pn', debouncedSku);
                if (selectedBrand) searchParams.set('oem', selectedBrand);
                if (selectedType) searchParams.set('modality', selectedType);
                if (selectedModel) searchParams.set('model', selectedModel);
                searchParams.set(
                    'sort',
                    sortOrder === 'z-a' ? 'desc' : sortOrder === 'a-z' ? 'asc' : 'relevant'
                );
                const cursor = pageCursors[pageIndex];
                if (cursor) searchParams.set('cursor', cursor);

                const response = await fetch(`/api/parts/search?${searchParams.toString()}`, {
                    headers: { Accept: 'application/json' },
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || 'Unable to load products.');
                }
                if (!active || currentRequest !== requestId.current) return;

                setProducts(Array.isArray(data.products) ? data.products : []);
                setHasNextPage(Boolean(data.hasNextPage));
                setNextCursor(data.nextCursor || null);
                const resultCount = Number.isInteger(data.totalMatches)
                    ? data.totalMatches
                    : (Array.isArray(data.products) ? data.products.length : 0);
                setTotalMatches(Number.isInteger(data.totalMatches) ? data.totalMatches : null);

                const searchTerm = debouncedSku || debouncedSearch;
                if (searchTerm) {
                    const trackingKey = JSON.stringify([
                        normalizeSearchValue(debouncedSearch),
                        normalizePartNumber(debouncedSku),
                        selectedBrand,
                        selectedType,
                        selectedModel,
                    ]);
                    if (lastTrackedSearch.current !== trackingKey) {
                        lastTrackedSearch.current = trackingKey;
                        trackWebsiteEvent('search', {
                            search_term: searchTerm.slice(0, 100),
                            search_kind: debouncedSku ? 'part_number' : 'keyword',
                            search_location: 'parts_catalog',
                            result_count: resultCount,
                            oem: selectedBrand,
                            modality: selectedType,
                            model: selectedModel,
                        });
                    }
                } else {
                    lastTrackedSearch.current = '';
                }
            } catch (error) {
                if (error?.name === 'AbortError') return;
                console.error(error);
                if (!active || currentRequest !== requestId.current) return;
                setProducts([]);
                setHasNextPage(false);
                setNextCursor(null);
                setTotalMatches(null);
                setProductsError(
                    'Unable to load this catalog view right now. Please refresh the page or contact us for help finding a part.'
                );
            } finally {
                if (active && currentRequest === requestId.current) {
                    setIsLoadingProducts(false);
                }
            }
        };

        fetchPage();

        return () => {
            active = false;
            controller.abort();
        };
    }, [
        debouncedSearch,
        debouncedSku,
        selectedBrand,
        selectedType,
        selectedModel,
        sortOrder,
        pageIndex,
        pageCursors,
        urlStateReady,
    ]);

    const handleBrandChange = (event) => {
        const brand = event.target.value;
        setSelectedBrand(brand);
        setSelectedType('');
        setSelectedModel('');
        setTypes(brand ? Object.keys(brandsModels[brand] || {}) : ALL_TYPES);
        setModels([]);
        setSortOrder(searchQuery || skuQuery ? 'relevant' : brand ? 'a-z' : 'relevant');
    };

    const handleTypeChange = (event) => {
        const type = event.target.value;
        setSelectedType(type);
        setSelectedModel('');
        setModels(getModelsForType(selectedBrand, type));
        setSortOrder(searchQuery || skuQuery ? 'relevant' : type ? 'a-z' : selectedBrand ? 'a-z' : 'relevant');
    };

    const handleModelChange = (event) => {
        const model = event.target.value;
        setSelectedModel(model);
        setSortOrder(searchQuery || skuQuery ? 'relevant' : model ? 'a-z' : selectedType ? 'a-z' : 'relevant');
    };

    const handleNameSearchChange = (event) => {
        const value = event.target.value;
        setSearchQuery(value);
        setSortOrder(value || skuQuery ? 'relevant' : selectedBrand || selectedType || selectedModel ? 'a-z' : 'relevant');
    };

    const handlePartNumberSearchChange = (event) => {
        const value = event.target.value;
        setSkuQuery(value);
        setSortOrder(value || searchQuery ? 'relevant' : selectedBrand || selectedType || selectedModel ? 'a-z' : 'relevant');
    };

    const handleClick = (product) => {
        trackWebsiteEvent('product_select', {
            item_id: product.id || '',
            item_name: product.Name || '',
            part_number: product.PN || '',
            oem: product.OEM || '',
            modality: product.Modality || '',
        });

        localStorage.setItem('product', JSON.stringify(product));

        let recentProducts = [];
        try {
            const stored = JSON.parse(localStorage.getItem('recentProducts')) || [];
            recentProducts = Array.isArray(stored) ? stored : [];
        } catch {
            recentProducts = [];
        }

        const deduplicated = recentProducts.filter((item) => item?.id !== product.id);
        localStorage.setItem('recentProducts', JSON.stringify([...deduplicated, product].slice(-4)));
    };

    const handleClear = () => {
        setSelectedBrand('');
        setSelectedType('');
        setSelectedModel('');
        setSearchQuery('');
        setSkuQuery('');
        setTypes(ALL_TYPES);
        setModels([]);
        setSortOrder('relevant');
    };

    const handleNextPage = () => {
        if (!hasNextPage || !nextCursor) return;
        setPageCursors((current) => {
            const updated = current.slice(0, pageIndex + 1);
            updated[pageIndex + 1] = nextCursor;
            return updated;
        });
        setPageIndex((current) => current + 1);
    };

    const firstVisibleResult = products.length > 0 ? pageIndex * ITEMS_PER_PAGE + 1 : 0;
    const lastVisibleResult = pageIndex * ITEMS_PER_PAGE + products.length;
    const isPopularView =
        sortOrder === 'relevant' &&
        !debouncedSearch &&
        !debouncedSku &&
        !selectedBrand &&
        !selectedType &&
        !selectedModel;

    return (
        <div className={styles.search_wrapper}>
            <div className='container'>
                <div className={styles.sorting}>
                    <p>
                        <span>{isPopularView ? 'Popular parts' : 'Parts'}</span>
                        {isLoadingProducts
                            ? 'Loading products...'
                            : isPopularView
                                ? 'Most viewed and high-interest items'
                            : products.length > 0
                                ? `Showing ${firstVisibleResult}-${lastVisibleResult}${totalMatches != null ? ` of ${totalMatches}` : ''} results`
                                : 'No matching results'}
                    </p>
                    <section>
                        <button
                            type="button"
                            aria-label="Toggle filters"
                            onClick={() => setShowMenu((current) => !current)}
                            className={`${styles.menu_btn} ${showMenu ? styles.active : ''}`}
                        >
                            <span></span>
                        </button>
                        <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                            <option
                                value="relevant"
                                disabled={!debouncedSearch && !debouncedSku && Boolean(selectedBrand || selectedType || selectedModel)}
                            >
                                Relevant
                            </option>
                            <option value="a-z">Name: A to Z</option>
                            <option value="z-a">Name: Z to A</option>
                        </select>
                    </section>
                </div>
            </div>
            <div className='flex items-start container'>
                <div className={`${styles.search_sidebar} ${showMenu ? styles.active : ''}`}>
                    <div className={styles.search_product}>
                        <form onSubmit={(event) => event.preventDefault()}>
                            <ul className='list-none'>
                                <li>
                                    <Image src={searchIcon} alt="" />
                                    <input
                                        type="search"
                                        placeholder='SEARCH BY NAME OR KEYWORD'
                                        value={searchQuery}
                                        maxLength={120}
                                        onChange={handleNameSearchChange}
                                    />
                                </li>
                                <li>
                                    <Image src={searchIcon} alt="" />
                                    <input
                                        type="search"
                                        placeholder='SEARCH BY PART NUMBER'
                                        value={skuQuery}
                                        maxLength={120}
                                        onChange={handlePartNumberSearchChange}
                                    />
                                </li>
                            </ul>
                        </form>
                        <select value={selectedBrand} onChange={handleBrandChange}>
                            <option value="">Select Brand</option>
                            {BRANDS.map((brand) => (
                                <option key={brand} value={brand}>{brand}</option>
                            ))}
                        </select>
                        <select value={selectedType} onChange={handleTypeChange}>
                            <option value="">Select Type</option>
                            {types.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                        <select
                            disabled={!selectedType}
                            value={selectedModel}
                            onChange={handleModelChange}
                        >
                            <option value="">Select Model</option>
                            {models.map((model) => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                        <button className="simple-btn white-btn" type="button" onClick={handleClear}>Clear</button>
                    </div>
                    <RecentProducts />
                    <SidebarFoundYourPart />
                </div>
                <div className={styles.content_wrapper}>
                    <ul className='list-none flex flex-wrap'>
                        {isLoadingProducts ? (
                            <li className={styles.no_product}>Loading products...</li>
                        ) : productsError ? (
                            <li className={styles.no_product}>{productsError}</li>
                        ) : products.length > 0 ? (
                            products.map((product) => (
                                <li key={product.id} className="flex">
                                    <div onClick={() => handleClick(product)}>
                                        <Link
                                            href={buildProductHref(product) ||
                                                (product?.Name ? `/products/${slugify(product.Name)}` : '/parts')}
                                        >
                                            <figure>
                                                <ImageComponent
                                                    imagePath={getPrimaryImagePath(product)}
                                                    alt={`${product.Name || 'Medical imaging part'} ${product.PN || product.id || ''}`}
                                                />
                                                <h3>{product.Name}</h3>
                                                <p className={styles.product_meta}>
                                                    {[product.OEM, product.Modality].filter(Boolean).join(' / ')}
                                                </p>
                                                {product.PN && (
                                                    <span className={styles.product_part_number}>
                                                        Part {product.PN}
                                                    </span>
                                                )}
                                            </figure>
                                        </Link>
                                    </div>
                                </li>
                            ))
                        ) : (
                            <li className={styles.no_product}>No products match your current search or filters.</li>
                        )}
                    </ul>
                    {!isLoadingProducts && !productsError && (pageIndex > 0 || hasNextPage) && (
                        <div className={styles.pagination}>
                            <button
                                type="button"
                                onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                                disabled={pageIndex === 0}
                            >
                                Previous
                            </button>
                            <span className={styles.page_status}>Page {pageIndex + 1}</span>
                            <button type="button" onClick={handleNextPage} disabled={!hasNextPage}>
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
