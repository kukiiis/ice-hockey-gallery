import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '../styles/Header.module.css';
import { useCart } from '../context/CartContext';
import { supabase } from '../lib/supabase';

export default function Header() {
  const router = useRouter();
  const { cartCount } = useCart();
  const [user, setUser] = React.useState(null);
  const [isAdmin, setIsAdmin] = React.useState(false);

  React.useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      
      // Check if user is admin
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', session.user.id)
          .single();
        setIsAdmin(data?.is_admin || false);
      }
    };
    checkUser();
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null);
        
        // Check if user is admin
        if (session?.user) {
          const { data } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', session.user.id)
            .single();
          setIsAdmin(data?.is_admin || false);
        } else {
          setIsAdmin(false);
        }
      }
    );
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Only show cart and login on appropriate pages
  const isLoginPage = ['/', '/login'].includes(router.pathname);

  return (
    <header className={styles.header}>
      <div className={styles.logoContainer}>
        <Link href={user ? "/galleries" : "/"} legacyBehavior>
          <a className={styles.logo}>🏒 <span className={styles.logoText}>CZECH LIONS CUP</span></a>
        </Link>
      </div>
      <div className={styles.actionsContainer}>
        {user && isAdmin && (
          <Link href="/admin/galleries" legacyBehavior>
            <a className={`${styles.authButton} ${styles.backButton}`}>BACK</a>
          </Link>
        )}
        
        {user && (
          <span className={styles.userEmail}>{user.email}</span>
        )}
        
        {/* Show cart only when user is logged in */}
        {user && (
          <Link href="/cart" legacyBehavior>
            <a className={styles.cartLink}>
              🛒
              {cartCount > 0 && (
                <span className={styles.cartCountBadge}>{cartCount}</span>
              )}
            </a>
          </Link>
        )}
        
        {user ? (
          <button onClick={handleSignOut} className={styles.authButton}>Logout</button>
        ) : (
          // Hide login button on login page
          !isLoginPage && (
            <Link href="/login" legacyBehavior>
              <a className={styles.authButton}>Login</a>
            </Link>
          )
        )}
      </div>
    </header>
  );
}