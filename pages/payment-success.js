// pages/payment-success.js
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';

export default function PaymentSuccess() {
  const router = useRouter();
  const { session_id } = router.query;
  const { clearCart } = useCart();
  const hasSentRef = useRef(false);

  useEffect(() => {
    // Only run if session_id is defined and we haven't sent the email yet
    if (!session_id || hasSentRef.current) return;

    hasSentRef.current = true; // Prevent further calls

    // Clear cart without showing alert
    clearCart(false);

    // Send email notification
    const sendEmail = async () => {
      try {
        console.log('Sending webhook for session:', session_id);
        
        // Call the webhook endpoint
        const response = await fetch('/api/payment-webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id }),
        });

        const data = await response.json();
        console.log('Webhook response:', data);
      } catch (err) {
        console.error('Network error:', err);
      }
    };

    sendEmail();
  }, [session_id, clearCart]);

  return (
    <div style={{ 
      padding: '80px 20px', 
      textAlign: 'center',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <h1 style={{ 
        color: '#FFFF', 
        fontSize: '2.5rem', 
        marginBottom: '1.5rem' 
      }}>
        Thank you for your purchase!
      </h1>
      
      <p style={{ 
        color: '#FFFF', 
        fontSize: '1.5rem',
        marginBottom: '2rem'
      }}>
        Your payment was successful. You will receive a confirmation email shortly.
      </p>
      
      <a href="/galleries" style={{
        display: 'inline-block',
        padding: '12px 28px',
        background: 'transparent',
        color: '#FFFF',
        borderRadius: '6px',
        fontWeight: 'bold',
        textDecoration: 'none',
        fontSize: '1.1rem',
        border: '2px solid #FFFF',
        transition: 'background-color 0.3s, color 0.3s'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = '#FFFF';
        e.currentTarget.style.color = '#0A192F';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = '#FFFF';
      }}
      >
        Back to Galleries
      </a>
    </div>
  );
}