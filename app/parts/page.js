"use client"

import Subheader from '@/components/subheader/Subheader';
import React, { useState, useEffect } from 'react';
import ProductsPage from './ProductsPage';

export default function Search() {

  return (
    <>

      <Subheader
        title="Search"
        extraClass="services_bg"
      />
      <ProductsPage />
    </>
  );
};
