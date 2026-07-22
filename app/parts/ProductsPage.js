"use client";

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './search.module.scss';
import searchIcon from "@/public/assets/images/search.svg";
import sortArrowIcon from "@/public/assets/images/sort_arrow.svg";
import brandsModels from "@/firebase/models.json";
import { getPrimaryImagePath, ImageComponent } from '@/components/fetchImages/Image';
import SidebarFoundYourPart from '../product-detail/found-your-part/SidebarFoundYourPart';
import RecentProducts from './RecentProducts';
import { buildProductHref, slugify } from '@/app/data/seoProducts';
import { trackWebsiteEvent } from '@/components/utils/analytics';

const ITEMS_PER_PAGE = 12;

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

export default function ProductsPage() {
    const brands = Object.keys(brandsModels);
    const allTypes = [...new Set(
        Object.values(brandsModels).flatMap((typesByBrand) => Object.keys(typesByBrand))
    )];

    const [searchQuery, setSearchQuery] = useState('');
    const [skuQuery, setSkuQuery] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const [products, setProducts] = useState([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [productsError, setProductsError] = useState('');
    const [sortOrder, setSortOrder] = useState('a-z');
    const [pageIndex, setPageIndex] = useState(0);
    const [pageCursors, setPageCursors] = useState([null]);
    const [nextCursor, setNextCursor] = useState(null);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [totalMatches, setTotalMatches] = useState(null);
    const [selectedBrand, setSelectedBrand] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [types, setTypes] = useState(allTypes);
    const [models, setModels] = useState([]);
    const requestId = useRef(0);

    const debouncedSearch = useDebouncedValue(searchQuery);
    const debouncedSku = useDebouncedValue(skuQuery);


    useEffect(() => {
        if (!debouncedSearch && !debouncedSku && !selectedBrand && !selectedType && !selectedModel) return;
        trackWebsiteEvent('search', {
            search_term: (debouncedSku || debouncedSearch).slice(0, 100),
            search_location: 'parts_catalog',
            oem: selectedBrand,
            modality: selectedType,
            model: selectedModel,
        });
    }, [debouncedSearch, debouncedSku, selectedBrand, selectedType, selectedModel]);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setSearchQuery(params.get('q') || '');
        setSkuQuery(params.get('pn') || '');
        setSelectedBrand(params.get('OEM') || params.get('clickedOEM') || '');
    }, []);

    useEffect(() => {
        setPageIndex(0);
        setPageCursors([null]);
    }, [debouncedSearch, debouncedSku, selectedBrand, selectedType, selectedModel, sortOrder]);

    useEffect(() => {
        let active = true;
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
                searchParams.set('sort', sortOrder === 'z-a' ? 'desc' : 'asc');
                const cursor = pageCursors[pageIndex];
                if (cursor) searchParams.set('cursor', cursor);

                const response = await fetch(`/api/parts/search?${searchParams.toString()}`, {
                    headers: { Accept: 'application/json' },
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || 'Unable to load products.');
                }
                if (!active || currentRequest !== requestId.current) return;

                setProducts(Array.isArray(data.products) ? data.products : []);
                setHasNextPage(Boolean(data.hasNextPage));
                setNextCursor(data.nextCursor || null);
                setTotalMatches(Number.isInteger(data.totalMatches) ? data.totalMatches : null);
            } catch (error) {
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
    ]);

    const handleBrandChange = (event) => {
        const brand = event.target.value;
        setSelectedBrand(brand);
        setSelectedType('');
        setSelectedModel('');
        setTypes(brand ? Object.keys(brandsModels[brand] || {}) : allTypes);
        setModels([]);
    };

    const handleTypeChange = (event) => {
        const type = event.target.value;
        setSelectedType(type);
        setSelectedModel('');
        setModels(getModelsForType(selectedBrand, type));
    };

    const handleClick = (product) => {
        trackWebsiteEvent('product_select', {
            item_id: product.id || '',
            item_name: product.Name || '',
            part_number: product.PN || '',
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
        setTypes(allTypes);
        setModels([]);
        setSortOrder('a-z');
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

    return (
        <div className={styles.search_wrapper}>
            <div className='container'>
                <div className={styles.sorting}>
                    <p>
                        <span>Parts</span>
                        {isLoadingProducts
                            ? 'Loading products...'
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
                            <option value="a-z">Name: A to Z</option>
                            <option value="z-a">Name: Z to A</option>
                        </select>
                        <button
                            type="button"
                            aria-label="Reverse sort order"
                            className={`sorting_button ${sortOrder === 'a-z' ? 'active' : ''}`}
                            onClick={() => setSortOrder((current) => current === 'a-z' ? 'z-a' : 'a-z')}
                        >
                            <Image src={sortArrowIcon} alt="" />
                        </button>
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
                                        onChange={(event) => setSearchQuery(event.target.value)}
                                    />
                                </li>
                                <li>
                                    <Image src={searchIcon} alt="" />
                                    <input
                                        type="search"
                                        placeholder='SEARCH BY PART NUMBER'
                                        value={skuQuery}
                                        maxLength={120}
                                        onChange={(event) => setSkuQuery(event.target.value)}
                                    />
                                </li>
                            </ul>
                        </form>
                        <select value={selectedBrand} onChange={handleBrandChange}>
                            <option value="">Select Brand</option>
                            {brands.map((brand) => (
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
                            onChange={(event) => setSelectedModel(event.target.value)}
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
