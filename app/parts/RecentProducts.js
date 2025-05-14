"use client";
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import styles from './search.module.scss';
import Link from 'next/link';
import slide1 from "@/public/assets/images/slide1.png";
import { ImageComponent } from '@/components/fetchImages/Image';

export default function RecentProducts() {
    const [recentProducts, setRecentProducts] = useState([]);

    // Fetch recent products from local storage on component mount
    useEffect(() => {
        const storedProducts = JSON.parse(localStorage.getItem('recentProducts')) || [];
        setRecentProducts(storedProducts);
    }, []);

    // Update localStorage with the selected product
    const handleClick = (product) => {
        localStorage.setItem('product', JSON.stringify(product));
        // console.log(product); // Optional: For debugging
    };

    return (
        <div className={styles.recent_products}>
            {recentProducts.length > 0 && <h2>Recently Viewed Products</h2>}
            <ul className='list-none'>
                {/* Reverse the array when displaying */}
                {[...recentProducts].reverse().map((product, index) => (
                    <li key={index}>
                        <Link href={`/product-detail?${product.Name}`} onClick={() => handleClick(product)}>
                            {/* Replace with dynamic product image if available */}
                            <ImageComponent imagePath={`Parts/${product.id}/${product.id}`} />
                            <h6>{product.Name}</h6>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
