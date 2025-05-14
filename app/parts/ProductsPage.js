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

export default function ProductsPage() {
    const [sortQuery, setSortQuery] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [skuQuery, setSkuQuery] = useState('');
    const [searchResult, setSearchResult] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showMenu, setShowMenu] = useState(false);
    const [products, setProducts] = useState([]);
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
        const fetchData = async () => {
            try {
                const snapshot = await db.collection('Parts').get();
                const datam = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setProducts(datam);
            } catch (error) {
                console.error(error);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        let results = products.filter(product =>
            product.Name && product.Name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (skuQuery.trim() !== '') {
            results = results.filter(product =>
                product.id && product.id.toLowerCase().includes(skuQuery.toLowerCase())
            );
        }

        if (sortOrder === 'a-z') {
            results.sort((a, b) => a.Name.localeCompare(b.Name));
        } else if (sortOrder === 'z-a') {
            results.sort((a, b) => b.Name.localeCompare(a.Name));
        }

        setSearchResult(results);
    }, [searchQuery, skuQuery, products, sortOrder]);

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
        setTypes(Object.keys(brandsModels[brand] || {}));
        setModels([]);
        brand === '' ? setSearchResult(products) : setSearchResult(products.filter(x => x.OEM === brand));
    };

    const handleTypeChange = (event) => {
        const type = event.target.value;
        setSelectedType(type);
        selectedBrand !== '' ? setModels(brandsModels[selectedBrand][type] || []) : setModels(brandsModels[type] || []);
        type === '' ? setSearchResult(products.filter(x => x.OEM === selectedBrand)) : 
                     (selectedBrand === '' ? setSearchResult(products.filter(x => x.Modality === type)) :
                     setSearchResult(products.filter(x => x.OEM === selectedBrand && x.Modality === type)));
    };

    const handleModelChange = (event) => {
        const model = event.target.value;
        setSelectedModel(event.target.value);
        model === '' ? setSearchResult(products.filter(x => x.OEM === selectedBrand && x.Modality === selectedType)) : 
                       setSearchResult(products.filter(x => x.OEM === selectedBrand && x.Machine === model && x.Modality === selectedType));
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

        let recentProducts = JSON.parse(localStorage.getItem('recentProducts')) || [];

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
        setSortOrder('');
        setSearchResult(products);
    };

    const totalPages = Math.ceil(searchResult.length / itemsPerPage);
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
                    <p><span>{searchQuery}Parts</span> Showing {Math.min((currentPage - 1) * itemsPerPage + 1, searchResult.length)}–{Math.min(currentPage * itemsPerPage, searchResult.length)} of {searchResult.length} results</p>
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
                        <form>
                            <ul className='list-none'>
                                <li>
                                    <Image src={searchIcon} alt="search" />
                                    <input
                                        type="text"
                                        placeholder='SEARCH BY NAME'
                                        value={searchQuery}
                                        onChange={handleInputChange}
                                    />
                                </li>
                                <li>
                                    <Image src={searchIcon} alt="search" />
                                    <input
                                        type="text"
                                        placeholder='SEARCH BY SKU NUMBER'
                                        value={skuQuery}
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
                        {(products.length > 0) && searchResult.length > 0 ? (
                            currentProducts.map((product, index) => (
                                <li key={`part-${index}`} className="flex">
                                    <div onClick={() => { handleClick(product) }}>
                                        <Link href={`/product-detail?${product.Name}`}>
                                            <figure>
                                                <ImageComponent imagePath={`Parts/${product.id}/${product.id}`} />
                                                <h3>{product.Name}</h3>
                                            </figure>
                                        </Link>
                                    </div>
                                </li>
                            ))
                        ) : (
                            <li className={styles.no_product}>No product found</li>
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
