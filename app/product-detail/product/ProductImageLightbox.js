"use client";

import { useEffect, useId, useRef, useState } from 'react';
import styles from './product.module.scss';

export default function ProductImageLightbox({ image, onClose }) {
    const dialogRef = useRef(null);
    const closeRef = useRef(null);
    const titleId = useId();
    const [zoomed, setZoomed] = useState(false);
    const [naturalWidth, setNaturalWidth] = useState(0);

    useEffect(() => {
        const dialog = dialogRef.current;
        const opener = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        dialog.showModal();
        closeRef.current.focus();
        document.body.style.overflow = 'hidden';

        return () => {
            dialog.close();
            document.body.style.overflow = previousOverflow;
            if (opener?.isConnected) opener.focus();
        };
    }, []);

    const close = () => dialogRef.current.close();
    const closeOnBackdrop = (event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    };

    return (
        <dialog ref={dialogRef} className={styles.imageDialog} aria-labelledby={titleId}
            onClose={(event) => { if (!event.currentTarget.open) onClose(); }} onClick={closeOnBackdrop}>
            <div className={styles.imageDialogHeader}>
                <h2 id={titleId}>Product image</h2>
                <button ref={closeRef} type="button" onClick={close} aria-label="Close product image">Close</button>
            </div>
            <div className={styles.imageDialogActions}>
                <button type="button" disabled={!naturalWidth} aria-pressed={zoomed}
                    onClick={() => setZoomed((value) => !value)}>
                    {zoomed ? 'Fit image' : 'Zoom in'}
                </button>
                <a href={image.src} target="_blank" rel="noopener noreferrer">Open original image (new tab)</a>
            </div>
            <div className={`${styles.imageDialogViewport} ${zoomed ? styles.imageDialogZoomed : ''}`}
                tabIndex={0} aria-label="Product image; use arrow keys to scroll when zoomed">
                {/* Use the original file so zoom is not limited to a thumbnail rendition. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.src} alt={image.alt}
                    onLoad={(event) => setNaturalWidth(event.currentTarget.naturalWidth)}
                    style={zoomed ? { width: naturalWidth * 2 } : undefined} />
            </div>
        </dialog>
    );
}
