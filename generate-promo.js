const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/jamm';
const PROMO_SALT = process.env.PROMO_SALT || 'default-promo-salt-!!';

const promoCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    usedCount: { type: Number, default: 0 },
    maxUses: { type: Number, default: 100 },
  },
  { timestamps: true },
);

const PromoCode = mongoose.model('PromoCode', promoCodeSchema, 'promocodes');

function hashPromoCode(code) {
  return crypto.createHmac('sha256', PROMO_SALT).update(code).digest('hex');
}

async function createPromo() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const rawCode = 'JAMM-PREMIUM-2026';
  const hashedCode = hashPromoCode(rawCode);

  const now = new Date();
  const nextYear = new Date();
  nextYear.setFullYear(now.getFullYear() + 1);

  try {
    const existing = await PromoCode.findOne({ code: hashedCode });
    if (existing) {
      console.log(`Promo code '${rawCode}' already exists in the database!`);
    } else {
      await PromoCode.create({
        code: hashedCode,
        validFrom: now,
        validUntil: nextYear,
        isActive: true,
        usedCount: 0,
        maxUses: 1, // Can be used 100 times
      });
      console.log(`Successfully created promo code: ${rawCode}`);
    }
  } catch (err) {
    console.error('Error creating promo code:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createPromo();
