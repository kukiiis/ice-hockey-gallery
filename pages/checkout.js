{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;\red255\green255\blue255;}
{\*\expandedcolortbl;;\cssrgb\c100000\c100000\c100000;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\deftab720
\pard\pardeftab720\partightenfactor0

\f0\fs24 \cf2 \expnd0\expndtw0\kerning0
\outl0\strokewidth0 \strokec2 // pages/checkout.js\
import \{ useEffect, useState \} from 'react';\
import \{ useRouter \} from 'next/router';\
import Head from 'next/head';\
import \{ supabase \} from '../lib/supabase';\
import Layout from '../components/Layout';\
import styles from '../styles/Checkout.module.css';\
\
export default function Checkout() \{\
  const [cartItems, setCartItems] = useState([]);\
  const [loading, setLoading] = useState(true);\
  const [processing, setProcessing] = useState(false);\
  const [user, setUser] = useState(null);\
  const [qrCode, setQrCode] = useState(null);\
  const [orderConfirmed, setOrderConfirmed] = useState(false);\
  const router = useRouter();\
\
  useEffect(() => \{\
    const checkUser = async () => \{\
      const \{ data: \{ session \} \} = await supabase.auth.getSession();\
      if (!session) \{\
        router.push('/');\
        return;\
      \}\
      setUser(session.user);\
      fetchCartItems(session.user.id);\
    \};\
\
    checkUser();\
  \}, [router]);\
\
  const fetchCartItems = async (userId) => \{\
    try \{\
      const \{ data, error \} = await supabase\
        .from('cart_items')\
        .select(`\
          id,\
          type,\
          photos:photo_id (id, filename)\
        `)\
        .eq('user_id', userId);\
\
      if (error) throw error;\
\
      if (data.length === 0) \{\
        router.push('/cart');\
        return;\
      \}\
\
      setCartItems(data);\
    \} catch (error) \{\
      console.error('Error fetching cart items:', error);\
    \} finally \{\
      setLoading(false);\
    \}\
  \};\
\
  const calculateTotal = () => \{\
    return cartItems.reduce((total, item) => \{\
      return total + (item.type === 'digital' ? 4 : 8);\
    \}, 0);\
  \};\
\
  const getItemCounts = () => \{\
    const counts = \{ digital: 0, printed: 0 \};\
    cartItems.forEach(item => \{\
      counts[item.type]++;\
    \});\
    return counts;\
  \};\
\
  const handleConfirm = async () => \{\
    setProcessing(true);\
\
    try \{\
      const totalAmount = calculateTotal();\
      const counts = getItemCounts();\
\
      // Create a Stripe checkout session\
      const response = await fetch('/api/checkout', \{\
        method: 'POST',\
        headers: \{\
          'Content-Type': 'application/json',\
        \},\
        body: JSON.stringify(\{\
          amount: totalAmount,\
          items: cartItems,\
          email: user.email,\
        \}),\
      \});\
\
      const data = await response.json();\
\
      if (data.error) \{\
        throw new Error(data.error);\
      \}\
\
      // Show QR code\
      setQrCode(data.qrCodeUrl);\
\
      // In a real implementation, you would listen for webhook events\
      // For this demo, we'll simulate payment success after a delay\
      setTimeout(() => \{\
        setOrderConfirmed(true);\
        // Redirect to success page after another delay\
        setTimeout(() => \{\
          router.push('/success');\
        \}, 2000);\
      \}, 5000);\
\
    \} catch (error) \{\
      console.error('Error processing payment:', error);\
      alert('Payment processing failed. Please try again.');\
      setProcessing(false);\
    \}\
  \};\
\
  if (loading) \{\
    return (\
      <Layout>\
        <div className=\{styles.loading\}>Loading checkout...</div>\
      </Layout>\
    );\
  \}\
\
  const counts = getItemCounts();\
\
  return (\
    <Layout>\
      <Head>\
        <title>Checkout | Ice Hockey Photo Gallery</title>\
      </Head>\
\
      <h1 className=\{styles.title\}>Checkout</h1>\
\
      <div className=\{styles.checkoutContainer\}>\
        \{qrCode ? (\
          <div className=\{styles.paymentSection\}>\
            <h2>Scan QR Code to Pay</h2>\
            <div className=\{styles.qrCodeContainer\}>\
              <img src=\{qrCode\} alt="Payment QR Code" className=\{styles.qrCode\} />\
            </div>\
            \{orderConfirmed && (\
              <div className=\{styles.successMessage\}>\
                <h3>SUCCESS!</h3>\
                <p>Your payment has been processed. Redirecting to confirmation page...</p>\
              </div>\
            )\}\
          </div>\
        ) : (\
          <div className=\{styles.orderSummary\}>\
            <h2>Order Summary</h2>\
\
            <div className=\{styles.summaryDetails\}>\
              \{counts.digital > 0 && (\
                <div className=\{styles.summaryItem\}>\
                  <span>\{counts.digital\} Digital Photos</span>\
                  <span>\'80\{counts.digital * 4\}</span>\
                </div>\
              )\}\
\
              \{counts.printed > 0 && (\
                <div className=\{styles.summaryItem\}>\
                  <span>\{counts.printed\} Printed Photos</span>\
                  <span>\'80\{counts.printed * 8\}</span>\
                </div>\
              )\}\
\
              <div className=\{styles.totalAmount\}>\
                <span>Total:</span>\
                <span>\'80\{calculateTotal()\}</span>\
              </div>\
            </div>\
\
            <button\
              className=\{styles.confirmButton\}\
              onClick=\{handleConfirm\}\
              disabled=\{processing\}\
            >\
              \{processing ? 'Processing...' : 'CONFIRM'\}\
            </button>\
          </div>\
        )\}\
      </div>\
    </Layout>\
  );\
\}}