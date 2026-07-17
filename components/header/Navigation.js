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
import { serviceLandingPages, serviceModalities, trailerLandingPages } from "@/app/data/serviceLandingPages";

const primaryServiceLinks = serviceLandingPages.filter((page) => !page.brand);
const oemServiceLinks = serviceLandingPages.filter((page) => page.brand);
const primaryTrailerLinks = trailerLandingPages.filter((page) => !page.brand);
const oemTrailerLinks = trailerLandingPages.filter((page) => page.brand);
const modalityKeys = Object.keys(serviceModalities);

const getGeneralPage = (pages, modality) => pages.find((page) => page.modality === modality);
const getOemPages = (pages, modality) => pages.filter((page) => page.modality === modality);

export default function Navigation() {
    const [showSearch, setShowSearch] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const pathname = usePathname();
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [openDropdown, setOpenDropdown] = useState(null);
    const [openModality, setOpenModality] = useState({
        services: null,
        trailers: null,
    });

    const router = useRouter();

    const closeNavOverlays = () => {
        setShowMenu(false);
        setOpenDropdown(null);
    };

    const toggleDropdown = (dropdown) => {
        setOpenDropdown((current) => current === dropdown ? null : dropdown);
    };

    const renderDropdownLinks = ({ type, basePath, generalPages, oemPages }) => {
        const selectedModality = openModality[type];
        const generalPage = getGeneralPage(generalPages, selectedModality);
        const brandPages = getOemPages(oemPages, selectedModality);

        return (
            <>
                <div className={styles.modality_tabs} aria-label={`${type} modality options`}>
                    {modalityKeys.map((modality) => (
                        <button
                            key={modality}
                            type="button"
                            className={selectedModality === modality ? styles.selected : ""}
                            aria-pressed={selectedModality === modality}
                            onClick={() => setOpenModality((current) => ({
                                ...current,
                                [type]: modality,
                            }))}
                        >
                            {serviceModalities[modality].label}
                        </button>
                    ))}
                </div>
                {selectedModality ? (
                    <div className={styles.dropdown_reveal}>
                        {generalPage && (
                            <Link
                                className={styles.dropdown_primary_link}
                                onClick={closeNavOverlays}
                                href={`${basePath}/${generalPage.slug}`}
                            >
                                {generalPage.shortTitle}
                            </Link>
                        )}
                        <div className={styles.oem_link_grid}>
                            {brandPages.map((page) => (
                                <Link key={page.slug} onClick={closeNavOverlays} href={`${basePath}/${page.slug}`}>
                                    {page.shortTitle}
                                </Link>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className={styles.dropdown_hint}>Select a modality</p>
                )}
            </>
        );
    };

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
        const normalizedValue = value.toLowerCase().trim();
        const filteredSuggestions = productsData.filter(product =>
            product.partTitle.toLowerCase().includes(normalizedValue)
        );
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
                    <button
                        type="button"
                        aria-label={showMenu ? "Close navigation menu" : "Open navigation menu"}
                        aria-expanded={showMenu}
                        onClick={openMenu}
                        className={`${styles.menu_btn} ${showMenu ? styles.active: ''}`}
                    >
                        <span></span>
                    </button>
                    <div className={`ml-auto ${showMenu ? styles.active : ""} ${styles.navigation_list}`}>
                        <ul className="list-none flex items-center">
                            <li><Link onClick={closeNavOverlays} className={pathname === '/' ? styles.active : ''} href="/">Home</Link></li>
                            <li><Link onClick={closeNavOverlays} className={pathname === '/about' ? styles.active : ''} href="/about">Our Story</Link></li>
                            <li
                                className={styles.has_dropdown}
                                onMouseEnter={() => setOpenDropdown("services")}
                                onMouseLeave={() => setOpenDropdown(null)}
                            >
                                <div className={styles.dropdown_trigger}>
                                    <Link onClick={closeNavOverlays} className={pathname.startsWith('/services') ? styles.active : ''} href="/services">Services</Link>
                                    <button
                                        type="button"
                                        className={`${styles.dropdown_toggle} ${openDropdown === "services" ? styles.open : ""}`}
                                        aria-label={openDropdown === "services" ? "Close services menu" : "Open services menu"}
                                        aria-expanded={openDropdown === "services"}
                                        onClick={() => toggleDropdown("services")}
                                    />
                                </div>
                                <div className={`${styles.dropdown_panel} ${openDropdown === "services" ? styles.dropdown_open : ""}`}>
                                    <div className={styles.dropdown_intro}>
                                        <Link className={styles.dropdown_main_cta} onClick={closeNavOverlays} href="/services">View Main Services Page</Link>
                                    </div>
                                    {renderDropdownLinks({
                                        type: "services",
                                        basePath: "/services",
                                        generalPages: primaryServiceLinks,
                                        oemPages: oemServiceLinks,
                                    })}
                                </div>
                            </li>
                            <li
                                className={styles.has_dropdown}
                                onMouseEnter={() => setOpenDropdown("trailers")}
                                onMouseLeave={() => setOpenDropdown(null)}
                            >
                                <div className={styles.dropdown_trigger}>
                                    <Link onClick={closeNavOverlays} className={pathname.startsWith('/trailers') ? styles.active : ''} href="/trailers">Trailer Rentals</Link>
                                    <button
                                        type="button"
                                        className={`${styles.dropdown_toggle} ${openDropdown === "trailers" ? styles.open : ""}`}
                                        aria-label={openDropdown === "trailers" ? "Close trailer rentals menu" : "Open trailer rentals menu"}
                                        aria-expanded={openDropdown === "trailers"}
                                        onClick={() => toggleDropdown("trailers")}
                                    />
                                </div>
                                <div className={`${styles.dropdown_panel} ${openDropdown === "trailers" ? styles.dropdown_open : ""}`}>
                                    <div className={styles.dropdown_intro}>
                                        <Link className={styles.dropdown_main_cta} onClick={closeNavOverlays} href="/trailers">View Main Trailer Rental Page</Link>
                                    </div>
                                    {renderDropdownLinks({
                                        type: "trailers",
                                        basePath: "/trailers",
                                        generalPages: primaryTrailerLinks,
                                        oemPages: oemTrailerLinks,
                                    })}
                                </div>
                            </li>
                            <li><Link onClick={closeNavOverlays} className={pathname === '/parts' ? styles.active : ''} href="/parts">Parts</Link></li>
                            <li><Link onClick={closeNavOverlays} className={pathname === '/contact' ? styles.active : ''} href="/contact">Contact Us</Link></li>
                            <li className={`${pathname === '/parts' ? styles.hidebtn : ""}`}>
                                <button
                                    type="button"
                                    aria-label={showSearch ? "Close site search" : "Open site search"}
                                    aria-expanded={showSearch}
                                    onClick={searchFun}
                                >
                                    <Image src={searchIcon} alt="search"/>
                                </button>
                            </li>
                        </ul>
                        <OutsideClickHandler
                            onOutsideClick={() => {
                                setShowSearch(false)
                            }}
                            >
                            <form onSubmit={handleSearch} className={`${pathname === '/parts' ? styles.hidebtn : ""} ${styles.search_wrap} ${showSearch ? styles.active : ""}`}>
                                <input placeholder='Search' name="searchInput" type='text' value={searchQuery} maxLength={120} onChange={handleInputChange} />
                                <button type="submit" aria-label="Search parts" onClick={()=> setShowSearch(false)}><Image src={searchIcon} alt="search" /></button>
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
