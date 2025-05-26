// pages/index.js
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  // const [password, setPassword] = useState(''); // If you implement password auth
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  // const [isSignUp, setIsSignUp] = useState(false); // To toggle between Login and Sign Up
  const router = useRouter();

  // Redirect if user is already logged in
 useEffect(() => {
  const checkUserAndRedirect = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const userEmail = session.user.email;
      if (userEmail === 'onetwoclickcz@gmail.com') {
        router.push('/admin/galleries');
      } else {
        router.push('/galleries');
      }
    }
  };
  checkUserAndRedirect();
}, [router]); // router is a dependency, though it rarely changes.

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signInWithOtp({ // signInWithOtp for magic links
        email,
        options: {
          // emailRedirectTo: `${window.location.origin}/galleries`, // Optional: where to redirect after magic link click
        }
      });
      if (error) throw error;
      setMessage('Check your email for the login link!');
    } catch (error) {
      setMessage(`Error: ${error.error_description || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // If you implement sign-up with password:
  // const handleSignUp = async (e) => { /* ... */ };

  return (
    <div className={`${styles.container} pageContainer`}>
      <h1 className={styles.title}>
        Frozen Moments
      </h1>
      <p className={styles.subtitle}>
        Log in to access exclusive ice hockey photo galleries.
      </p>
      
      <div className={styles.formContainer}>
        <h2 className={styles.formTitle}>
          Entrance
        </h2>
        
        <form onSubmit={handleLogin}> {/* Changed to always handleLogin for magic link */}
          <div className={styles.inputGroup}>
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              className="themedInput"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="themedButton" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Sending Link...' : 'Send Magic Link'}
          </button>
        </form>

        {message && (
          <div 
            className={`${styles.message} appMessage ${message.toLowerCase().includes('error') ? 'appMessage-error' : 'appMessage-info'}`}
            style={{ marginTop: '1.5rem' }}
          >
            {message}
          </div>
        )}

        {loading && <div className={styles.puckLoader} style={{ marginTop: '1.5rem' }}></div>}
      </div>
    </div>
  );
}