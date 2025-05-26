// context/CartContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const CartContext = createContext();

// Helper function to get a unique cart key based on user
function getCartKey(user) {
  if (user && user.email) {
    // For logged-in users, use their email as the unique identifier
    return `cart_${user.email}`;
  }
  
  // For guests, use a session ID stored in sessionStorage
  let guestId = sessionStorage.getItem('guest_cart_id');
  if (!guestId) {
    // Create a new random ID if none exists
    guestId = 'guest_' + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('guest_cart_id', guestId);
  }
  return `cart_${guestId}`;
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [user, setUser] = useState(null);
  const [cartTotal, setCartTotal] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  
  // Listen for auth state changes
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    
    getSession();
    
    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    
    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);
  
  // Load cart from localStorage when user changes
  useEffect(() => {
    const loadCart = () => {
      const cartKey = getCartKey(user);
      const savedCart = localStorage.getItem(cartKey);
      
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          setCartItems(parsedCart);
        } catch (error) {
          console.error('Error parsing cart from localStorage:', error);
          setCartItems([]);
        }
      } else {
        setCartItems([]);
      }
    };
    
    loadCart();
  }, [user]); // Re-load cart when user changes
  
  // Save cart to localStorage whenever it changes and update cart total and count
  useEffect(() => {
    const cartKey = getCartKey(user);
    localStorage.setItem(cartKey, JSON.stringify(cartItems));
    
    // Calculate cart total
    const total = cartItems.reduce((sum, item) => {
      return sum + (parseFloat(item.price) * item.quantity);
    }, 0);
    
    // Calculate total items count (including quantities)
    const count = cartItems.reduce((sum, item) => {
      return sum + item.quantity;
    }, 0);
    
    setCartTotal(total);
    setCartCount(count);
  }, [cartItems, user]);
  
  // Add item to cart
  const addToCart = (photo, purchaseType, price, options = {}) => {
    // Create a unique ID for this cart item
    const cartItemId = `${photo.id}_${purchaseType}_${Date.now()}`;
    
    // Create the cart item
    const newItem = {
      cartItemId,
      id: photo.id,
      image_url: photo.image_url,
      displayName: photo.displayName || photo.filename || `Photo ${photo.id}`,
      purchaseType,
      price,
      quantity: 1,
      ...options
    };
    
    setCartItems(prevItems => {
      // Check if this exact item is already in the cart
      const existingItemIndex = prevItems.findIndex(
        item => item.id === photo.id && item.purchaseType === purchaseType
      );
      
      if (existingItemIndex >= 0) {
        // If item exists, increase quantity
        const updatedItems = [...prevItems];
        updatedItems[existingItemIndex].quantity += 1;
        return updatedItems;
      } else {
        // Otherwise add new item
        return [...prevItems, newItem];
      }
    });
    
    // Removed the alert popup
  };
  
  // Remove item from cart
  const removeFromCart = (cartItemId) => {
    setCartItems(prevItems => prevItems.filter(item => item.cartItemId !== cartItemId));
  };
  
  // Update item quantity
  const updateQuantity = (cartItemId, newQuantity) => {
    if (newQuantity < 1) return;
    
    setCartItems(prevItems => 
      prevItems.map(item => 
        item.cartItemId === cartItemId 
          ? { ...item, quantity: newQuantity } 
          : item
      )
    );
  };
  
  // Clear the entire cart
  const clearCart = (showAlert = true) => {
    setCartItems([]);
    if (showAlert) {
      alert('Your cart has been cleared.');
    }
  };
  
  return (
    <CartContext.Provider value={{
      cartItems,
      cartTotal,
      cartCount,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}