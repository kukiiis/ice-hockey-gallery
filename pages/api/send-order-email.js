// pages/api/send-order-email.js
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

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

// Function to download an image from a URL
async function downloadImage(url, filename) {
  const tempDir = path.join(os.tmpdir(), 'photo-downloads');
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const filepath = path.join(tempDir, filename);
  
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download image: ${response.statusCode}`));
      }
      
      const fileStream = fs.createWriteStream(filepath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(filepath);
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Delete the file if there's an error
        reject(err);
      });
    }).on('error', reject);
  });
}

export default async function handler(req, res) {
  console.log('API route called with:', req.body);
  
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
    console.log('Retrieving session:', session_id);
    
    // Verify the session exists
    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log('Session retrieved:', session.id, 'Payment status:', session.payment_status);
    
    // Then, get the line items separately with expanded product data
    const lineItems = await stripe.checkout.sessions.listLineItems(session_id, {
      expand: ['data.price.product']
    });
    console.log('Line items retrieved:', lineItems.data.length);

    // Extract order details safely
    const orderItems = lineItems.data.map(item => {
      const isDigital = (item.description || '').toLowerCase().includes('digital');
      return {
        name: item.description || (item.price?.product?.name || 'Photo'),
        quantity: item.quantity,
        price: ((item.amount_total || 0) / 100).toFixed(2),
        type: isDigital ? 'Digital' : 'Print',
        photo_id: item.price?.product?.metadata?.photo_id
      };
    });
    
    console.log('Order items processed:', orderItems.length);
    
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
    console.log('Digital items:', digitalItems.length);
    
    // Prepare attachments array for email
    const attachments = [];
    
    if (digitalItems.length > 0) {
      customerEmailHtml += `
      <h3>Your Digital Photos</h3>
      <p>Your digital photos are attached to this email. You can also download them using the links below:</p>
      <div style="margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;">
      `;
      
      // Process each digital item
      for (const item of digitalItems) {
        console.log('Processing digital item with photo_id:', item.photo_id);
        
        try {
          // Get the photo data from the database
          const { data, error } = await supabase
            .from('photos')
            .select('filename, image_url')
            .eq('id', item.photo_id)
            .single();
          
          if (error) {
            console.error('Error fetching photo data:', error);
            continue;
          }
          
          console.log('Found photo data:', data?.filename, data?.image_url);
          
          if (!data?.image_url) {
            console.error('No image URL found for photo:', item.photo_id);
            continue;
          }
          
          // Create a public URL for the photo
          const publicUrl = data.image_url.startsWith('http') 
            ? data.image_url 
            : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${data.image_url}`;
          
          // Add the download link to the email
          customerEmailHtml += `
          <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
            <p style="font-weight: bold; margin-bottom: 5px;">${data.filename || `Photo ${item.photo_id}`}</p>
            <a href="${publicUrl}" 
               style="display: inline-block; padding: 8px 15px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 4px;"
               download="${data.filename || 'photo.jpg'}">
              Download Photo
            </a>
          </div>
          `;
          
          // Try to download the image to attach to the email
          try {
            const filename = data.filename || `photo-${uuidv4()}.jpg`;
            const filepath = await downloadImage(publicUrl, filename);
            
            attachments.push({
              filename: filename,
              path: filepath
            });
            
            console.log('Added attachment:', filename);
          } catch (attachErr) {
            console.error('Error attaching photo:', attachErr);
            // Continue even if attachment fails - the download link will still be in the email
          }
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
        attachments: attachments
      });
      console.log('Customer email sent with digital photos:', digitalItems.length > 0);
    }

    // Mark this session as processed
    processedSessions.add(session_id);
    console.log('Session marked as processed');

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing order:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}