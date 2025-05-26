// pages/api/checkout_sessions.js
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { items } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'No items in cart.' });
      }

      const line_items = items.map((item) => {
        const itemName = `${item.displayName || 'Photo'} - ${item.purchaseType}${item.options?.type ? ` (${item.options.type})` : ''}`;
        // Ensure price is a number and convert to cents
        const unitAmount = Math.round(parseFloat(item.price) * 100); 

        if (isNaN(unitAmount) || unitAmount <= 0) {
          console.error(`Invalid price for item: ${itemName}, Price: ${item.price}`);
          throw new Error(`Invalid price for item: ${itemName}`);
        }

        return {
          price_data: {
            currency: 'eur',
            product_data: {
              name: itemName,
              metadata: {
                photo_id: item.id // Store the photo ID in metadata
              },
              images: item.image_url ? [item.image_url] : undefined,
            },
            unit_amount: unitAmount, // Price in cents
          },
          quantity: item.quantity,
        };
      });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card', 'ideal', 'bancontact'],
        line_items,
        mode: 'payment',
        success_url: `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/cart?payment_cancelled=true`,
      });

      res.status(200).json({ sessionId: session.id });
    } catch (err) {
      console.error("Stripe API Error:", err);
      res.status(500).json({ message: err.message || 'Internal Server Error' });
    }
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
}