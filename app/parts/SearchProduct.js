"use client"
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import styles from './search.module.scss';
import searchIcon from "@/public/assets/images/search.svg"
import Link from 'next/link';

export default function SearchProduct({ products }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showMenu, setShowMenu] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const query = params.get('q');
        setSearchQuery(query || '');
    }, []);

    useEffect(() => {
        const results = products.filter(product =>
            product.partTitle && product.partTitle.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSearchResult(results);
    }, [searchQuery, products]);

    const handleInputChange = (e) => {
        const value = e.target.value;
        setSearchQuery(value);
        if (value.trim() === '') {
            setSuggestions([]);
        } else {
            const suggestionsList = products.filter(product =>
                product.partTitle && product.partTitle.toLowerCase().includes(value.toLowerCase())
            );
            setSuggestions(suggestionsList);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        setSearchQuery(suggestion.partTitle);
        setSuggestions([]);
    };
    const openMenu = () => {
        setShowMenu(!showMenu);
    }

    return (
        <div className={styles.search_wrapper}>
            <div className='container'>
                <div className={styles.sorting}>
                    <p><span>Parts</span> Showing 1–{Math.min(16, searchResult.length)} of {searchResult.length} results</p>
                    <section>
                        <button onClick={openMenu} className={`${styles.menu_btn} ${showMenu ? styles.active: ''}`}>
                            <span></span>
                        </button>
                        <select>
                            <option value="">SORT BY</option>
                            <option>Sort by Popularity</option>
                            <option>Sort by Newness</option>
                        </select>
                    </section>
                </div>
            </div>
            <div className='flex container'>
                <div className={`${styles.search_sidebar} ${showMenu ? styles.active: ''}`}>
                    <div className={styles.search_product}>
                        <form>
                            <Image src={searchIcon} alt="search"/>
                            <input 
                                type="text" 
                                placeholder='SEARCH'
                                value={searchQuery} 
                                onChange={handleInputChange} 
                            />
                        </form>
                        {suggestions.length > 0 && (
                            <div className={styles.suggestion_wrap}>
                                <ul className='list-none flex direction-column'>
                                    {suggestions.map((suggestion, index) => (
                                        <li key={index} onClick={() => handleSuggestionClick(suggestion)}>
                                            {suggestion.partTitle}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                    <div className={styles.filter_wrap}>
                        <section>
                            <h3>Brand</h3>
                            <ul className='list-none'>
                                <li><label className={styles.checkbox} id="ge"><input type='checkbox' value="ge" /> <span>GE</span></label></li>
                                <li><label className={styles.checkbox} id="siemens"><input type='checkbox' value="siemens" /> <span>Siemens</span></label></li>
                                <li><label className={styles.checkbox} id="philips"><input type='checkbox' value="philips" /> <span>Philips</span></label></li>
                                <li><label className={styles.checkbox} id="toshiba"><input type='checkbox' value="toshiba" /> <span>Toshiba</span></label></li>
                            </ul>
                        </section>
                        <section>
                            <h3>Type</h3>
                            <ul className='list-none'>
                                <li><label className={styles.checkbox} id="ct"><input type='checkbox' value="ct" /> <span>CT</span></label></li>
                                <li><label className={styles.checkbox} id="mri"><input type='checkbox' value="mri" /> <span>MRI</span></label></li>
                            </ul>
                        </section>
                        <section>
                            <h3>MOdel</h3>
                            <ul className='list-none'>
                                <li><label className={styles.checkbox} id="HDxt"><input type='checkbox' value="HDxt" /> <span>Signa HDxt</span></label></li>
                                <li><label className={styles.checkbox} id="Infinity"><input type='checkbox' value="Infinity" /> <span>Signa Infinity</span></label></li>
                                <li><label className={styles.checkbox} id="Premier"><input type='checkbox' value="Premier" /> <span>Signa Premier</span></label></li>
                                <li><label className={styles.checkbox} id="Optima"><input type='checkbox' value="Optima" /> <span>Optima</span></label></li>
                                <li><label className={styles.checkbox} id="Excite"><input type='checkbox' value="Excite" /> <span>Excite</span></label></li>
                            </ul>
                        </section>
                    </div>
                </div>
                <div className={styles.content_wrapper}>
                    {searchQuery.length > 0 && <p className={styles.searched_r}>Searched for: {searchQuery}</p>}
                    <ul className='list-none flex flex-wrap'>
                        {searchResult.length > 0 ? (
                            searchResult.map((product, index) => (
                                <li key={`part-${index}`} className="flex items-center">
                                    <Link href="/product-detail">
                                    <figure>
                                        <Image src={product.partImage} width={380} height={200} alt="image" />
                                        <h3>{product.partTitle}</h3>
                                    </figure>
                                    </Link>
                                </li>
                            ))
                        ) : (
                            <li className={styles.no_product}>No product found</li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
}
