const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');
const fs = require('fs');

const messageIdFile = './alliancesMessage.json';
const channelId = '1454552983688843305'; // Production channel

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-list-post')
        .setDescription('Post or update the alliance list in the designated channel'),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const alliances = loadAlliances();

            if (!alliances.length) {
                return await interaction.editReply('No alliances found.');
            }

            const embed = new EmbedBuilder()
                .setTitle('📜 Current Alliances')
                .setColor('Blue')
                .setTimestamp();

            alliances.forEach(a => {
                embed.addFields({
                    name: a.groupName,
                    value: `**Our Reps:** ${a.ourReps}\n**Their Reps:** ${a.theirReps}\n**Discord:** ${a.discordLink}\n**Roblox:** ${a.robloxLink}\n**Rep Role:** ${a.repRoleId ? `<@&${a.repRoleId}>` : 'None'}`,
                    inline: false
                });
            });

            const channel = await client.channels.fetch(channelId);
            if (!channel) return interaction.editReply('Channel not found.');

            // Read existing message ID or initialize
            let messageIdData = { messageId: null };
            if (fs.existsSync(messageIdFile)) {
                messageIdData = JSON.parse(fs.readFileSync(messageIdFile));
            }

            let message;
            if (messageIdData.messageId) {
                try {
                    // Try to fetch existing message and update it
                    message = await channel.messages.fetch(messageIdData.messageId);
                    await message.edit({ embeds: [embed] });
                } catch {
                    // If message not found, send a new one
                    message = await channel.send({ embeds: [embed] });
                    messageIdData.messageId = message.id;
                    fs.writeFileSync(messageIdFile, JSON.stringify(messageIdData, null, 2));
                }
            } else {
                // First-time posting
                message = await channel.send({ embeds: [embed] });
                messageIdData.messageId = message.id;
                fs.writeFileSync(messageIdFile, JSON.stringify(messageIdData, null, 2));
            }

            await interaction.editReply('✅ Alliance list posted/updated successfully!');
        } catch (err) {
            console.error('Error posting alliance list:', err);
            await interaction.editReply('❌ Failed to post/update alliance list.');
        }
    }
};
