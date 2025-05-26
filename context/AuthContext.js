// context/CartContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';

// 1. Create the context
const CartContext = createContext();

// 2. Create a custom hook to use the context easily
export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

// 3. Create the Provider component
export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  // Load cart from localStorage on initial client-side render
  useEffect(() => {
    const storedCart = localStorage.getItem('shoppingCart');
    if (storedCart) {
      try {
        const parsedCart = JSON.parse(storedCart);
        if (Array.isArray(parsedCart)) {
          setCartItems(parsedCart);
        } else {
          console.warn("Stored cart data is not an array. Resetting cart.");
          setCartItems([]);
          localStorage.setItem('shoppingCart', JSON.stringify([])); // Clear invalid data
        }
      } catch (error) {
        console.error("Error parsing stored cart from localStorage:", error);
        setCartItems([]); // Reset to empty array on parsing error
        localStorage.setItem('shoppingCart', JSON.stringify([])); // Clear invalid data
      }
    }
  }, []); // Empty dependency array ensures this runs only once on mount (client-side)

  // Save cart to localStorage whenever cartItems changes
  useEffect(() => {
    // Only run on client-side after initial load to prevent issues with SSR/hydration
    if (typeof window !== 'undefined') { 
        localStorage.setItem('shoppingCart', JSON.stringify(cartItems));
    }
  }, [cartItems]);

  const addToCart = (photo, purchaseType, price, options = {}) => {
    setCartItems(prevItems => {
      // Create a unique ID for the cart item based on photo ID, purchaseType, and any specific options (like print size)
      const cartItemId = `${photo.id}-${purchaseType}${options.size ? '-' + options.size : ''}${options.type ? '-' + options.type : ''}`;
      
      const existingItemIndex = prevItems.findIndex(item => item.cartItemId === cartItemId);

      if (existingItemIndex > -1) {
        // If item exists, create a new array with the updated item quantity
        const updatedItems = prevItems.map((item, index) => 
          index === existingItemIndex 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
        alert(`${photo.displayName || 'Photo'} quantity updated in cart!`);
        return updatedItems;
      } else {
        // If item doesn't exist, add it to the cart with quantity 1
        alert(`${photo.displayName || 'Photo'} (${purchaseType}${options.size ? ' ' + options.size : ''}${options.type ? ' ' + options.type : ''}) added to cart!`);
        return [...prevItems, { ...photo, purchaseType, price, options, cartItemId, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (cartItemId) => {
    setCartItems(prevItems => prevItems.filter(item => item.cartItemId !== cartItemId));
    alert('Item removed from cart.');
  };

  const updateQuantity = (cartItemId, newQuantity) => {
    const quantityNum = parseInt(newQuantity, 10);

    if (isNaN(quantityNum) || quantityNum < 1) {
      // If quantity is invalid or less than 1, remove the item
      removeFromCart(cartItemId);
      return;
    }

    setCartItems(prevItems =>
      prevItems.map(item =>
        item.cartItemId === cartItemId ? { ...item, quantity: quantityNum } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
    alert('Cart cleared.');
  };

  // Calculate total number of items in the cart
  const cartCount = cartItems.reduce((count, item) => count + item.quantity, 0);
  
  // Calculate total price of items in the cart
  const cartTotal = cartItems.reduce((total, item) => {
    const itemPrice = parseFloat(item.price); // Ensure price is a number
    return total + (itemPrice * item.quantity);
  }, 0);

  // The value object that will be available to consuming components
  const providerValue = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartCount,
    cartTotal,
  };

  return (
    <CartContext.Provider value={providerValue}>
      {children}
    </CartContext.Provider>
  );
};