"use client";
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import styles from './search.module.scss';
import searchIcon from "@/public/assets/images/search.svg";
import sortArrowIcon from "@/public/assets/images/sort_arrow.svg";
import Link from 'next/link';
import brandsModels from "@/firebase/models.json";
import { ImageComponent } from '@/components/fetchImages/Image';
import { db } from '@/firebase/Firebase';
import SidebarFoundYourPart from '../product-detail/found-your-part/SidebarFoundYourPart';
import RecentProducts from './RecentProducts';
import { buildProductHref, slugify } from '@/app/data/seoProducts';

const normalize = (value) => (value ?? '').toString().toLowerCase().trim();

const includesText = (value, query) => normalize(value).includes(normalize(query));

const getProductSearchText = (product) => [
    product?.Name,
    product?.id,
    product?.PN,
    product?.OEM,
    product?.Modality,
    product?.Machine,
    product?.Description,
].filter(Boolean).join(' ');

const getPartNumberSearchText = (product) => [
    product?.id,
    product?.PN,
    product?.Name,
    product?.Description,
].filter(Boolean).join(' ');

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
    const [sortQuery, setSortQuery] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [skuQuery, setSkuQuery] = useState('');
    const [searchResult, setSearchResult] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showMenu, setShowMenu] = useState(false);
    const [products, setProducts] = useState([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [productsError, setProductsError] = useState('');
    const [sortOrder, setSortOrder] = useState('a-z'); // Added state for sorting order

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    const [selectedBrand, setSelectedBrand] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [selectedModel, setSelectedModel] = useState('');

    const brands = Object.keys(brandsModels);
    const allKeys = Object.keys(brandsModels).flatMap(brand => Object.keys(brandsModels[brand]));
    const uniqueKeys = [...new Set(allKeys)];

    const [types, setTypes] = useState(uniqueKeys);
    const [models, setModels] = useState([]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const query = params.get('q') || '';
        setSearchQuery(query);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingProducts(true);
            setProductsError('');
            try {
                const snapshot = await db.collection('Parts').get();
                const datam = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setProducts(datam);
            } catch (error) {
                console.error(error);
                setProductsError('Unable to load products right now. Please refresh the page or contact us for help finding a part.');
            } finally {
                setIsLoadingProducts(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        const nameQuery = normalize(searchQuery);
        const partQuery = normalize(skuQuery);
        const brandQuery = normalize(selectedBrand);
        const typeQuery = normalize(selectedType);
        const modelQuery = normalize(selectedModel);

        let results = products.filter((product) => {
            const matchesName = !nameQuery || includesText(getProductSearchText(product), nameQuery);
            const matchesPart = !partQuery || includesText(getPartNumberSearchText(product), partQuery);
            const matchesBrand = !brandQuery || normalize(product.OEM) === brandQuery;
            const matchesType = !typeQuery || normalize(product.Modality) === typeQuery;
            const matchesModel = !modelQuery || normalize(product.Machine) === modelQuery;

            return matchesName && matchesPart && matchesBrand && matchesType && matchesModel;
        });

        if (sortOrder === 'a-z') {
            results.sort((a, b) => normalize(a.Name).localeCompare(normalize(b.Name)));
        } else if (sortOrder === 'z-a') {
            results.sort((a, b) => normalize(b.Name).localeCompare(normalize(a.Name)));
        }

        setSearchResult(results);
    }, [searchQuery, skuQuery, selectedBrand, selectedType, selectedModel, products, sortOrder]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, skuQuery, selectedBrand, selectedType, selectedModel, sortOrder]);

    const handleSortArrowClick = () => {
        setSortOrder((prevOrder) => (prevOrder === 'a-z' ? 'z-a' : 'a-z'));
        setSortQuery(!sortQuery)
    };

    const handleInputChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleBrandChange = (event) => {
        const brand = event.target.value;
        setSelectedBrand(brand);
        setSelectedType("");
        setSelectedModel("");
        setTypes(brand ? Object.keys(brandsModels[brand] || {}) : uniqueKeys);
        setModels([]);
    };

    const handleTypeChange = (event) => {
        const type = event.target.value;
        setSelectedType(type);
        setSelectedModel("");
        setModels(getModelsForType(selectedBrand, type));
    };

    const handleModelChange = (event) => {
        setSelectedModel(event.target.value);
    };

    const handleSuggestionClick = (suggestion) => {
        setSearchQuery(suggestion.name);
        setSuggestions([]);
    };

    const openMenu = () => {
        setShowMenu(!showMenu);
    };

    const handleClick = (product) => {
        localStorage.setItem('product', JSON.stringify(product));

        let recentProducts = [];
        try {
            const storedRecentProducts = JSON.parse(localStorage.getItem('recentProducts')) || [];
            recentProducts = Array.isArray(storedRecentProducts) ? storedRecentProducts : [];
        } catch {
            recentProducts = [];
        }

        recentProducts.push(product);

        if (recentProducts.length > 4) {
            recentProducts.shift();
        }

        localStorage.setItem('recentProducts', JSON.stringify(recentProducts));
    };

    const handleSkuChange = (e) => {
        setSkuQuery(e.target.value);
    };

    const handleClear = () => {
        setSelectedBrand('');
        setSelectedType('');
        setSelectedModel('');
        setSearchQuery('');
        setSkuQuery('');
        setTypes(uniqueKeys);
        setModels([]);
        setSortOrder('a-z');
    };

    const totalPages = Math.ceil(searchResult.length / itemsPerPage);
    const firstVisibleResult = searchResult.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
    const lastVisibleResult = Math.min(currentPage * itemsPerPage, searchResult.length);
    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const currentProducts = searchResult.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className={styles.search_wrapper}>
            <div className='container'>
                <div className={styles.sorting}>
                    <p>
                        <span>{searchQuery}Parts</span>
                        {isLoadingProducts
                            ? 'Loading products...'
                            : `Showing ${firstVisibleResult}-${lastVisibleResult} of ${searchResult.length} results`}
                    </p>
                    <section>
                        <button onClick={openMenu} className={`${styles.menu_btn} ${showMenu ? styles.active : ''}`}>
                            <span></span>
                        </button>
                        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                            {/* <option value="">SORT BY</option> */}
                            <option value="a-z">Sort by Alphabetically</option>
                            {/* <option value="z-a">Sort Z-A</option> */}
                            <option>Sort by Popularity</option>
                            <option>Sort by Newness</option>
                        </select>
                        <button 
                            className={`sorting_button ${sortQuery ? "active" : ""}`} 
                            onClick={handleSortArrowClick}>
                            <Image src={sortArrowIcon} alt="sortArrowIcon" />
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
                                    <Image src={searchIcon} alt="search" />
                                    <input
                                        type="text"
                                        placeholder='SEARCH BY NAME'
                                        value={searchQuery}
                                        maxLength={120}
                                        onChange={handleInputChange}
                                    />
                                </li>
                                <li>
                                    <Image src={searchIcon} alt="search" />
                                    <input
                                        type="text"
                                        placeholder='SEARCH BY SKU NUMBER'
                                        value={skuQuery}
                                        maxLength={120}
                                        onChange={handleSkuChange}
                                    />
                                </li>
                            </ul>
                        </form>
                        {suggestions.length > 0 && (
                            <div className={styles.suggestion_wrap}>
                                <ul className='list-none flex direction-column'>
                                    {suggestions.map((suggestion, index) => (
                                        <li key={index} onClick={() => handleSuggestionClick(suggestion)}>
                                            {suggestion.name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <select value={selectedBrand} onChange={handleBrandChange}>
                            <option value="">Select Brand</option>
                            {brands.map(brand => (
                                <option key={brand} value={brand}>{brand}</option>
                            ))}
                        </select>
                        <select value={selectedType} onChange={handleTypeChange}>
                            <option value="">Select Type</option>
                            {types.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                        <select disabled={!selectedType} value={selectedModel} onChange={handleModelChange}>
                            <option value="">Select Model</option>
                            {models.map(model => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                        <button className="simple-btn white-btn" onClick={handleClear}>Clear</button>
                    </div>
                    <RecentProducts/>
                    <SidebarFoundYourPart/>
                </div>
                <div className={styles.content_wrapper}>
                    <ul className='list-none flex flex-wrap'>
                        {isLoadingProducts ? (
                            <li className={styles.no_product}>Loading products...</li>
                        ) : productsError ? (
                            <li className={styles.no_product}>{productsError}</li>
                        ) : (products.length > 0) && searchResult.length > 0 ? (
                            currentProducts.map((product, index) => (
                                <li key={`part-${index}`} className="flex">
                                    <div onClick={() => { handleClick(product) }}>
                                        <Link
                                            href={
                                                buildProductHref(product) ||
                                                (product?.Name ? `/products/${slugify(product.Name)}` : "/parts")
                                            }
                                        >
                                            <figure>
                                                <ImageComponent imagePath={`Parts/${product.id}/${product.id}`} alt={`${product.Name || "Medical imaging part"} ${product.id || ""}`} />
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
                    {(products.length > 0 && searchResult.length > 0) &&
                        <div className={styles.pagination}>
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </button>
                        {currentPage > 3 && (
                            <>
                                <button onClick={() => handlePageChange(1)} className={currentPage === 1 ? styles.active : ''}>1</button>
                                {currentPage > 4 && <span>...</span>}
                            </>
                        )}
                        {Array.from(
                            { length: 5 }, 
                            (_, i) => currentPage - 2 + i
                        ).map(page => (
                            page > 0 && page <= totalPages && (
                                <button
                                    key={page}
                                    onClick={() => handlePageChange(page)}
                                    className={currentPage === page ? styles.active : ''}
                                >
                                    {page}
                                </button>
                            )
                        ))}
                        {currentPage < totalPages - 2 && (
                            <>
                                {currentPage < totalPages - 3 && <span>...</span>}
                                <button onClick={() => handlePageChange(totalPages)} className={currentPage === totalPages ? styles.active : ''}>
                                    {totalPages}
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            Next
                        </button>
                    </div>
                    
                    }
                </div>
            </div>
        </div>
    );
}
