const { EmbedBuilder } = require('discord.js');
const { loadAlliances, saveAlliances } = require('./allianceStorage');

const ALLIANCE_LIST_CHANNEL_NAME = 'alliances-list';
const MESSAGE_ID_STORAGE_KEY = 'alliancesListMessageId.json'; // We'll store the message ID in JSON

const fs = require('fs');
const path = require('path');

// Helper to read message ID
function getMessageId() {
    const filePath = path.join(__dirname, MESSAGE_ID_STORAGE_KEY);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')).messageId;
}

// Helper to save message ID
function setMessageId(messageId) {
    const filePath = path.join(__dirname, MESSAGE_ID_STORAGE_KEY);
    fs.writeFileSync(filePath, JSON.stringify({ messageId }));
}

/**
 * Update the pinned alliance list message in the alliances-list channel
 * @param {Client} client
 */
async function updateAllianceList(client) {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        const channel = guild.channels.cache.find(ch => ch.name === ALLIANCE_LIST_CHANNEL_NAME);
        if (!channel) return console.warn(`Channel "${ALLIANCE_LIST_CHANNEL_NAME}" not found.`);

        const alliances = loadAlliances();

        const embed = new EmbedBuilder()
            .setTitle('📜 Alliances List')
            .setColor('Blue')
            .setTimestamp();

        if (alliances.length === 0) {
            embed.setDescription('No alliances added yet.');
        } else {
            const fields = alliances.map(a => {
                return {
                    name: a.groupName,
                    value: `**Our Reps:** ${a.ourReps}\n**Their Reps:** ${a.theirReps}\n**Discord:** ${a.discordLink || 'N/A'}\n**Roblox:** ${a.robloxLink || 'N/A'}\n**Rep Role:** ${a.repRoleId ? `<@&${a.repRoleId}>` : 'None'}`,
                };
            });
            embed.addFields(fields);
        }

        // Check if the message already exists
        let messageId = getMessageId();
        let message;
        if (messageId) {
            try {
                message = await channel.messages.fetch(messageId);
                await message.edit({ embeds: [embed] });
            } catch (err) {
                // If message not found (deleted?), send a new one
                message = await channel.send({ embeds: [embed] });
                setMessageId(message.id);
            }
        } else {
            // Send new message and save ID
            message = await channel.send({ embeds: [embed] });
            setMessageId(message.id);
        }
    } catch (err) {
        console.error('Failed to update alliance list:', err);
    }
}

module.exports = { updateAllianceList };
