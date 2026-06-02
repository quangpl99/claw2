const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { getDb } = require('../lib/db');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

function getAccountFromStripeCustomer(customerId) {
  const db = getDb();
  return db.prepare('SELECT * FROM accounts WHERE stripe_customer_id = ?').get(customerId);
}

// Stripe webhook handler
router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret && sig) {
      const crypto = require('crypto');
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(req.body)
        .digest('hex');

      if (sig !== expectedSig) {
        throw new Error('Invalid signature');
      }
    }

    event = JSON.parse(req.body);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  const db = getDb();

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const plan = subscription.metadata?.plan || extractPlanFromPrice(subscription.items?.data?.[0]?.price?.id);
      const status = subscription.status;

      const account = getAccountFromStripeCustomer(customerId);
      if (account) {
        db.prepare(`
          UPDATE accounts SET plan = ?, stripe_subscription_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE stripe_customer_id = ?
        `).run(status === 'active' ? plan : 'free', subscription.id, customerId);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const customerId = subscription.customer;

      const account = getAccountFromStripeCustomer(customerId);
      if (account) {
        db.prepare(`
          UPDATE accounts SET plan = 'free', stripe_subscription_id = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE stripe_customer_id = ?
        `).run(customerId);
      }
      break;
    }

    case 'checkout.session.completed': {
      const session = event.data.object;
      const customerId = session.customer;
      const plan = session.metadata?.plan || 'starter';

      const account = getAccountFromStripeCustomer(customerId);
      if (account && session.payment_status === 'paid') {
        db.prepare(`
          UPDATE accounts SET plan = ? WHERE stripe_customer_id = ?
        `).run(plan, customerId);
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      // Keep subscription active
      break;
    }

    case 'invoice.payment_failed': {
      // Could notify user or downgrade
      const invoice = event.data.object;
      const customerId = invoice.customer;
      console.log(`Payment failed for customer ${customerId}`);
      break;
    }

    default:
      console.log(`Unhandled webhook event: ${event.type}`);
  }

  res.json({ received: true });
});

// Create checkout session
router.post('/create-checkout', async (req, res) => {
  try {
    const { plan, success_url, cancel_url } = req.body;

    const prices = {
      starter: process.env.STRIPE_PRICE_STARTER || 'price_starter_placeholder',
      pro: process.env.STRIPE_PRICE_PRO || 'price_pro_placeholder',
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: prices[plan],
        quantity: 1,
      }],
      success_url: success_url || process.env.SUCCESS_URL || 'http://localhost:3000/dashboard?success=true',
      cancel_url: cancel_url || process.env.CANCEL_URL || 'http://localhost:3000/?cancelled=true',
      metadata: { plan },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get subscription status
router.get('/subscription', async (req, res) => {
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const db = getDb();
  const account = db.prepare('SELECT * FROM accounts WHERE api_key = ?').get(apiKey);

  if (!account) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  if (!account.stripe_subscription_id) {
    return res.json({ plan: account.plan, status: 'active', subscription: null });
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);
    res.json({
      plan: account.plan,
      status: subscription.status,
      current_period_end: subscription.current_period_end,
    });
  } catch (err) {
    res.json({ plan: account.plan, status: 'active', subscription: null });
  }
});

function extractPlanFromPrice(priceId) {
  // In production, map price IDs to plan names
  return 'starter';
}

module.exports = router;