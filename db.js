const mongoose = require('mongoose');

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            dbName: 'alliance-bot'
        });
        console.log('✅ Connected to MongoDB (alliance-bot)');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    }
}

const allianceSchema = new mongoose.Schema({
    groupName: { type: String, required: true, unique: true },
    ourReps: { type: String, default: 'N/A' },
    theirReps: { type: String, default: 'N/A' },
    discordLink: { type: String, default: 'N/A' },
    robloxLink: { type: String, default: 'N/A' },
    repRoleId: { type: String, default: null },
    welcomeChannelId: { type: String, default: null },
    section: { type: String, enum: ['Restaurants', 'Cafes', 'Others'], required: true },
    strikes: [
        {
            number: Number,
            reason: String,
            notes: String,
            addedBy: String,
            addedOn: String,
            removed: { type: Boolean, default: false },
            removedBy: String,
            removalReason: String,
            removedOn: String
        }
    ],
    addedAt: { type: Date, default: Date.now }
});

const Alliance = mongoose.models.Alliance || mongoose.model('Alliance', allianceSchema);

module.exports = { connectDB, Alliance };