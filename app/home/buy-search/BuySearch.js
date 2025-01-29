"use client"
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from "./buySearch.module.scss";
import productsData from "../part-card/partCardList.json";
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function BuySearch() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);

    const handleSearch = (e) => {
        e.preventDefault();
        const searchTerm = e.target.elements.searchInput.value;

        if (searchTerm.trim() !== '') {
            const path = `/parts?q=${encodeURIComponent(searchTerm)}`;
            router.push(path);
        } else {
            console.error("Search term is empty");
            // Handle the case when the search term is empty
        }
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        setSearchQuery(value);
        if (value.trim() === '') {
            setSuggestions([]);
        } else {
            generateSuggestions(value);
        }
    };

    const generateSuggestions = (value) => {
        const regex = new RegExp(`${value}`, 'i');
        const filteredSuggestions = productsData.filter(product => regex.test(product.partTitle));
        setSuggestions(filteredSuggestions);
    };

    const handleSuggestionClick = (suggestion) => {
        setSearchQuery(suggestion.partTitle);
        setSuggestions([]);
    };
    useEffect(() => {
        AOS.init();
    },[]);

    return(
        <div className={styles.search_form_wrap} data-aos="fade-up" data-aos-duration="1000" id="search">
            <div className="container">
                <h2>Buy With <span>Confidence</span></h2>
                <p>SEARCH & FIND PARTS</p>
                <form onSubmit={handleSearch} className={`flex items-center ${styles.search_form}`}>
                    <input 
                        placeholder="Search" 
                        name="searchInput" 
                        value={searchQuery} 
                        onChange={handleInputChange}
                    />
                    <button type="submit" className="simple-btn">Find Now</button>
                    {suggestions.length > 0 && (
                        <div className={styles.suggestions}>
                            <ul className='list-none flex direction-column'>
                                {suggestions.map((suggestion, index) => (
                                    <li key={index} onClick={() => handleSuggestionClick(suggestion)}>
                                        {suggestion.partTitle}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </form>
            </div>
        </div>
    )
}