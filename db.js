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
    ourRepRoleId: { type: String, default: null },
    welcomeChannelId: { type: String, default: null },
    section: { type: String, enum: ['Restaurants', 'Cafes', 'Others'], required: true },
    theirRepIds: [{ type: String }],
    ourRepIds: [{ type: String }],
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

const allianceListMessageSchema = new mongoose.Schema({
    messageId: { type: String, required: true },
    channelId: { type: String, required: true }
});

const Alliance = mongoose.models.Alliance || mongoose.model('Alliance', allianceSchema);
const AllianceListMessage = mongoose.models.AllianceListMessage || mongoose.model('AllianceListMessage', allianceListMessageSchema);

module.exports = { connectDB, Alliance, AllianceListMessage };