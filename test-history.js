const mongoose = require('mongoose');

async function checkBattleHistory() {
  await mongoose.connect('mongodb://localhost:27017/jamm');

  const userId = '69a15e7fe79bbf94c0f5882f'; // The ID from previous output
  const history = await mongoose.connection
    .collection('battlehistories')
    .find({ 'participants.userId': new mongoose.Types.ObjectId(userId) })
    .toArray();

  console.log('Query Match Count:', history.length);
  process.exit(0);
}

checkBattleHistory().catch(console.error);
