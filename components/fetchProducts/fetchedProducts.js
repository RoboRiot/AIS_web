import { db } from '@/firebase/Firebase';
import React, { useState, useEffect } from 'react';


export const fetchProducts = async () => {
    try {
      const snapshot = await db.collection('Parts').get();
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      return data;
    } catch (error) {
      console.error("Error fetching products:", error);
      return [];
    }
  };