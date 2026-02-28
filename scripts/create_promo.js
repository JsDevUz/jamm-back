const crypto = require('crypto');
const { MongoClient } = require('mongodb');

// Configuration
const MONGO_URI = 'mongodb://localhost:27017/jamm';
const PROMO_SALT = 'default-promo-salt-!!';
const CODE = 'PREMIUM30';

function hashPromoCode(code) {
  return crypto.createHmac('sha256', PROMO_SALT).update(code).digest('hex');
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const promoCodes = db.collection('promocodes');

    const hashed = hashPromoCode(CODE);

    // 1. Delete existing if any
    await promoCodes.deleteOne({ code: hashed });

    const now = new Date();
    const validUntil = new Date();
    validUntil.setFullYear(now.getFullYear() + 1);

    // 2. Insert with correct schema fields
    const result = await promoCodes.insertOne({
      code: hashed,
      validFrom: now,
      validUntil: validUntil,
      isActive: true,
      usedCount: 0,
      maxUses: 100,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`Promo code created!`);
    console.log(`Code: ${CODE}`);
    console.log(`Hashed: ${hashed}`);
    console.log(`Result ID: ${result.insertedId}`);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
