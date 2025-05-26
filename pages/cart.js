import { useCart } from '../context/CartContext';
import styles from '../styles/Cart.module.css';
import Link from 'next/link';
import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe with your publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// Function to remove any file extension
const removeFileExtension = (filename) => {
  if (!filename) return '';
  return filename.replace(/\.[^/.]+$/, '');
};

export default function CartPage() {
  const { cartItems, removeFromCart, updateQuantity, cartTotal, clearCart } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle checkout with Stripe
  async function handleCheckout() {
    try {
    setIsProcessing(true);
    
    // Call your API route to create a Stripe checkout session
    const response = await fetch('/api/checkout_sessions', {
    method: 'POST',
    headers: {
    'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items: cartItems }),
    });
    
    const data = await response.json();
    
    if (response.ok && data.sessionId) {
    // Redirect to Stripe Checkout
    const stripe = await stripePromise;
    const { error } = await stripe.redirectToCheckout({
    sessionId: data.sessionId,
    });
    
    if (error) {
    console.error('Stripe redirect error:', error);
    alert(`Payment Error: ${error.message}`);
    }
    } else {
    throw new Error(data.message || 'Failed to create checkout session');
    }
    } catch (error) {
    console.error('Checkout error:', error);
    alert(`Checkout Error: ${error.message}`);
    } finally {
    setIsProcessing(false);
    }
  }

  return (
  
    <div className={styles.pageContainer}>
    <h1 className={styles.pageTitle}>Your Shopping Cart</h1>
    {cartItems.length === 0 ? (
    <div className={styles.emptyCartMessage}>
    <p>Your cart is empty.</p>
    <Link href="/galleries" legacyBehavior>
    <a className={styles.checkoutButton}>Browse Galleries</a>
    </Link>
    </div>
    ) : (
    <>
    <div className={styles.cartItemsGrid}>
    {cartItems.map((item) => (
    <div key={item.cartItemId} className={styles.cartItem}>
    <img 
    src={item.image_url || '/placeholder-image.png'}
    alt={removeFileExtension(item.displayName) || 'Photo'}
    className={styles.itemImage}
    />
    <div className={styles.itemInfo}>
    <h3>
    {removeFileExtension(item.displayName || 'Photo')}
    </h3>
    <p>Type: {item.purchaseType}</p>
    <p className={styles.itemPrice}>Price: €{parseFloat(item.price).toFixed(2)}</p>
    </div>
    <div className={styles.quantityColumn}>
    <div className={styles.itemQuantity}>
    <input
    type="number"
    min="1"
    value={item.quantity}
    onChange={(e) => updateQuantity(item.cartItemId, parseInt(e.target.value, 10))}
    className={styles.quantityInput}
    />
    </div>
    <button
    onClick={() => removeFromCart(item.cartItemId)}
    className={styles.removeItemButton}
    >
    Remove
    </button>
    </div>
    </div>
    ))}
    </div>
    <div className={styles.cartSummary}>
    <h2 className={styles.totalPrice}>Total: €{cartTotal.toFixed(2)}</h2>
    <button
    className={styles.checkoutButton}
    onClick={handleCheckout}
    disabled={cartItems.length === 0 || isProcessing}
    >
    {isProcessing ? 'Processing...' : 'Proceed to Checkout'}
    </button>
    
    {/* Back to Galleries button */}
    <Link href="/galleries" legacyBehavior>
      <a className={styles.backToGalleriesButton}>
        Back to Galleries
      </a>
    </Link>
    </div>
    </>
    )}
    </div>
  );
}