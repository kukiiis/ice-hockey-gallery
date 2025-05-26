// pages/_app.js
import '../styles/globals.css';
import { CartProvider } from '@/context/CartContext';
import Header from '@/components/Header';
import Snowfall from 'react-snowfall'; // Import Snowfall

function MyApp({ Component, pageProps }) {
  return (
    <CartProvider>
      <Snowfall
        // Optional props:
        color="#CCD6F6" // Light slate blue, good for a subtle snow
        snowflakeCount={100} // Adjust count as desired
        radius={[0.5, 2.0]} // Min and max snowflake radius
        speed={[0.5, 2.0]} // Min and max speed
        wind={[-0.5, 1.0]} // Min and max wind
        style={{ position: 'fixed', width: '100vw', height: '100vh', zIndex: 9999 }} // Ensure it's behind interactive elements if needed, or above all if desired
      />
      <Header />
      <Component {...pageProps} />
    </CartProvider>
  );
}

export default MyApp;