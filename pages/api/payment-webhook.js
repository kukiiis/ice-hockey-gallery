// pages/api/payment-webhook.js
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Track processed sessions to prevent duplicate emails
const processedSessions = new Set();

export default async function handler(req, res) {
  console.log('Received payment webhook POST', req.body);

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({ message: 'Missing session_id' });
  }

  // Check if we've already processed this session
  if (processedSessions.has(session_id)) {
    return res.status(200).json({ 
      success: true, 
      message: 'Order emails already sent' 
    });
  }

  try {
    // First, retrieve the basic session
    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log('Session retrieved:', session.id, 'Payment status:', session.payment_status);
    
    // Then, get the line items separately
    const lineItems = await stripe.checkout.sessions.listLineItems(session_id, {
      expand: ['data.price.product']
    });
    console.log('Line items retrieved:', lineItems.data.length);

    // Extract order details safely
    const orderItems = lineItems.data.map(item => ({
      name: item.description || (item.price?.product?.name || 'Photo'),
      quantity: item.quantity,
      price: ((item.amount_total || 0) / 100).toFixed(2),
      type: (item.description || '').toLowerCase().includes('digital') ? 'Digital' : 'Print',
      photo_id: item.price?.product?.metadata?.photo_id
    }));
    console.log('Order items processed:', orderItems.length);
    console.log('Digital items:', orderItems.filter(item => item.type === 'Digital').length);

    const orderTotal = (session.amount_total / 100).toFixed(2);
    const orderNumber = `ORDER-${Date.now().toString().slice(-6)}`;
    
    // Create HTML table for admin email
    const adminEmailHtml = `
    <h2>New Order: ${orderNumber}</h2>
    <p><strong>Customer:</strong> ${session.customer_details?.email || 'Unknown'}</p>
    <p><strong>Order Total:</strong> €${orderTotal}</p>
    <table border="1" cellpadding="5" style="border-collapse: collapse;">
      <tr>
        <th>Photo</th>
        <th>Type</th>
        <th>Quantity</th>
        <th>Price</th>
      </tr>
      ${orderItems.map(item => `
      <tr>
        <td>${item.name}</td>
        <td>${item.type}</td>
        <td>${item.quantity}</td>
        <td>€${item.price}</td>
      </tr>
      `).join('')}
    </table>
    `;

    // Create customer email base
    let customerEmailHtml = `
    <h2>Thank you for your order!</h2>
    <p><strong>Order Number:</strong> ${orderNumber}</p>
    <p><strong>Order Total:</strong> €${orderTotal}</p>
    `;
    
    // Add print pickup info if there are print items
    if (orderItems.some(item => item.type === 'Print')) {
      customerEmailHtml += `
      <p>The photos in printed form will be available to pick up daily at ICE RINK SKODA.</p>
      `;
    }
    
    // Process digital photos if any
    const digitalItems = orderItems.filter(item => item.type === 'Digital' && item.photo_id);
    console.log('Processing digital items:', digitalItems.length);
    
    if (digitalItems.length > 0) {
      customerEmailHtml += `
      <h3>Your Digital Photos</h3>
      <p>Click the links below to download your digital photos:</p>
      <div style="margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;">
      `;
      
      // Process each digital item
      for (const item of digitalItems) {
        console.log('Processing digital item with photo_id:', item.photo_id);
        
        try {
          // Get the photo data from the database
          const { data, error } = await supabase
            .from('photos')
            .select('*')
            .eq('id', item.photo_id)
            .single();
          
          if (error) {
            console.error('Error fetching photo data:', error);
            continue;
          }
          
          console.log('Found photo data:', data);
          
          // Create a public URL for the photo
          // Try different approaches to get a valid URL
          let photoUrl = '';
          
          if (data.image_url && data.image_url.startsWith('http')) {
            // If image_url is already a full URL
            photoUrl = data.image_url;
          } else if (data.image_url) {
            // If image_url is a relative path
            photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${data.image_url}`;
          } else if (data.storage_path) {
            // Try using storage_path
            const { data: publicUrlData } = await supabase
              .storage
              .from('photos')
              .getPublicUrl(data.storage_path);
            
            if (publicUrlData?.publicUrl) {
              photoUrl = publicUrlData.publicUrl;
            }
          }
          
          if (!photoUrl) {
            console.error('Could not generate URL for photo:', item.photo_id);
            continue;
          }
          
          console.log('Generated URL for photo:', photoUrl);
          
          customerEmailHtml += `
          <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
            <p style="font-weight: bold; margin-bottom: 5px;">${data.filename || `Photo ${item.photo_id}`}</p>
            <a href="${photoUrl}" 
               style="display: inline-block; padding: 8px 15px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 4px;"
               download="${data.filename || 'photo.jpg'}">
              Download Photo
            </a>
          </div>
          `;
        } catch (err) {
          console.error('Error processing digital item:', err);
        }
      }
      
      customerEmailHtml += `</div>`;
    }
    
    customerEmailHtml += `
    <p>If you have any questions, please contact us.</p>
    `;

    console.log('Sending admin email');
    // Send email to admin
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: 'onetwoclickcz@gmail.com',
      subject: `New Order: ${orderNumber}`,
      html: adminEmailHtml,
    });
    console.log('Admin email sent');

    // Send email to customer (if we have their email)
    if (session.customer_details?.email) {
      console.log('Sending customer email to:', session.customer_details.email);
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: session.customer_details.email,
        subject: 'Your order was successful!',
        html: customerEmailHtml,
      });
      console.log('Customer email sent with digital photos:', digitalItems.length > 0);
    }

    // Mark this session as processed
    processedSessions.add(session_id);
    console.log('Session marked as processed');

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing payment success:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}