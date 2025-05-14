"use client"
import { usePathname,useRouter } from 'next/navigation'
import Link from "next/link"
import styles from "./header.module.scss"
import Image from "next/image"
import logoImage from "@/public/assets/images/logo.svg"
import searchIcon from "@/public/assets/images/search.svg"
import { useState } from 'react'
import OutsideClickHandler from 'react-outside-click-handler';
import productsData from "./partCardList.json";

export default function Navigation() {
    const [showSearch, setShowSearch] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const pathname = usePathname();
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);

    const router = useRouter();

    const handleSearch = (e) => {
        e.preventDefault();
        const searchTerm = e.target.elements.searchInput.value;

        if (searchTerm.trim() !== '') {
            const path = `/parts?q=${encodeURIComponent(searchTerm)}`; // Manually construct the path
            router.push(path);
        } else {
            console.error("Search term is empty");
            // Handle the case when the search term is empty
        }
    };

    const searchFun =()=> {
        setShowSearch(!showSearch);
    }

    const openMenu = () => {
        setShowMenu(!showMenu);
    }

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

    return(
        <>
            <div className={styles.navigation_wrap}>
                <div className="container flex items-center">
                    <Link href="/" className={styles.logo}><Image src={logoImage} alt="logo" /></Link>
                    <button onClick={openMenu} className={`${styles.menu_btn} ${showMenu ? styles.active: ''}`}>
                        <span></span>
                    </button>
                    <div className={`ml-auto ${showMenu ? styles.active : ""} ${styles.navigation_list}`}>
                        <ul className="list-none flex items-center">
                            <li><Link onClick={()=> setShowMenu(false)} className={pathname === '/' ? styles.active : ''} href="/">Home</Link></li>
                            <li><Link onClick={()=> setShowMenu(false)} className={pathname === '/about' ? styles.active : ''} href="/about">Our Story</Link></li>
                            <li><Link onClick={()=> setShowMenu(false)} className={pathname === '/services' ? styles.active : ''} href="/services">Our Services</Link></li>
                            <li><Link onClick={()=> setShowMenu(false)} className={pathname === '/parts' ? styles.active : ''} href="/parts">Parts</Link></li>
                            <li><Link onClick={()=> setShowMenu(false)} className={pathname === '/contact' ? styles.active : ''} href="/contact">Contact Us</Link></li>
                            <li className={`${pathname === '/parts' ? styles.hidebtn : ""}`}><button onClick={searchFun}><Image src={searchIcon} alt="search"/></button></li>
                        </ul>
                        <OutsideClickHandler
                            onOutsideClick={() => {
                                setShowSearch(false)
                            }}
                            >
                            <form onSubmit={handleSearch} className={`${pathname === '/parts' ? styles.hidebtn : ""} ${styles.search_wrap} ${showSearch ? styles.active : ""}`}>
                                <input placeholder='Search' name="searchInput" type='text' value={searchQuery} onChange={handleInputChange} />
                                <button type="submit" onClick={()=> setShowSearch(false)}><Image src={searchIcon} alt="search" /></button>
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
                        </OutsideClickHandler>
                    </div>
                </div>
            </div>
        </>
    )
}