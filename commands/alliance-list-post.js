const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');
const fs = require('fs');

const channelId = '1454552983688843305'; // channel to post
const messageIdFile = './alliancesMessage.json';

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

            const sections = [
                { name: 'Restaurants', emoji: '🍽️' },
                { name: 'Cafes', emoji: '☕' },
                { name: 'Others', emoji: '🏷️' }
            ];

            sections.forEach(section => {
                const sectionAlliances = alliances.filter(a => a.section === section.name);
                if (!sectionAlliances.length) return;

                embed.addFields({ name: `${section.emoji} ${section.name}`, value: '\u200B' });

                sectionAlliances.forEach(a => {
                    embed.addFields({
                        name: `✨ **${a.groupName}** ✨`,
                        value:
                            `**Our Reps:** ${a.ourReps}\n` +
                            `**Their Reps:** ${a.theirReps}\n` +
                            `**Discord:** ${a.discordLink}\n` +
                            `**Roblox:** ${a.robloxLink}\n` +
                            `**Rep Role:** ${a.repRoleId ? `<@&${a.repRoleId}>` : 'None'}\n` +
                            `────────────────────`,
                        inline: false
                    });
                });
            });

            const channel = await client.channels.fetch(channelId);
            if (!channel) return interaction.editReply('Channel not found.');

            let messageIdData = { messageId: null };
            if (fs.existsSync(messageIdFile)) {
                messageIdData = JSON.parse(fs.readFileSync(messageIdFile));
            }

            let message;
            if (messageIdData.messageId) {
                try {
                    message = await channel.messages.fetch(messageIdData.messageId);
                    await message.edit({ embeds: [embed] });
                } catch {
                    message = await channel.send({ embeds: [embed] });
                    messageIdData.messageId = message.id;
                    fs.writeFileSync(messageIdFile, JSON.stringify(messageIdData, null, 2));
                }
            } else {
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
