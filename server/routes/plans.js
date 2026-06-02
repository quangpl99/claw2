const express = require('express');
const router = express.Router();

// Get pricing plans
router.get('/', (req, res) => {
  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      period: 'forever',
      docs: 1,
      chats_per_month: 100,
      features: [
        '1 document',
        '100 chats/month',
        'Basic embedding',
        'Community support',
      ],
      cta: 'Get Started',
      highlighted: false,
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 12,
      period: 'month',
      docs: 5,
      chats_per_month: 5000,
      features: [
        '5 documents',
        '5,000 chats/month',
        'Priority embedding',
        'Email support',
        'Widget customization',
      ],
      cta: 'Start Free Trial',
      highlighted: true,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 29,
      period: 'month',
      docs: -1,
      chats_per_month: 25000,
      features: [
        'Unlimited documents',
        '25,000 chats/month',
        'Advanced embeddings',
        'Priority support',
        'Custom branding',
        'Analytics',
      ],
      cta: 'Start Free Trial',
      highlighted: false,
    },
  ];

  res.json({ plans });
});

// Get plan details
router.get('/:planId', (req, res) => {
  const planDetails = {
    free: {
      id: 'free',
      name: 'Free',
      price: 0,
      docs: 1,
      chats_per_month: 100,
      stripe_price_id: null,
    },
    starter: {
      id: 'starter',
      name: 'Starter',
      price: 12,
      docs: 5,
      chats_per_month: 5000,
      stripe_price_id: process.env.STRIPE_PRICE_STARTER || null,
    },
    pro: {
      id: 'pro',
      name: 'Pro',
      price: 29,
      docs: -1,
      chats_per_month: 25000,
      stripe_price_id: process.env.STRIPE_PRICE_PRO || null,
    },
  };

  const plan = planDetails[req.params.planId];
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  res.json(plan);
});

module.exports = router;