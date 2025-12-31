const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const alliancesFile = './alliances.json';
const messageIdFile = './alliancesMessage.json';
const channelId = '1454552983688843305'; // Channel to post the list in

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-list-post')
        .setDescription('Post or update the alliance list in the designated channel'),

    async execute(interaction, client) {
        try {
            // Read alliances from file
            const alliancesData = fs.readFileSync(alliancesFile, 'utf-8');
            const alliances = JSON.parse(alliancesData);

            if (!alliances || alliances.length === 0) {
                return interaction.reply({ content: 'No alliances found in the list.', ephemeral: true });
            }

            // Build the embed
            const embed = new EmbedBuilder()
                .setTitle('📜 Alliance List')
                .setColor('Green')
                .setTimestamp();

            alliances.forEach((alliance, index) => {
                embed.addFields({
                    name: `${index + 1}. ${alliance.name || 'Unnamed Alliance'}`,
                    value: `Leader: ${alliance.leader || 'Unknown'}\nMembers: ${alliance.members?.join(', ') || 'None'}`,
                    inline: false
                });
            });

            // Fetch the channel
            const channel = await client.channels.fetch(channelId);
            if (!channel) return interaction.reply({ content: 'Channel not found.', ephemeral: true });

            // Read or initialize message ID
            let messageIdData = { messageId: null };
            if (fs.existsSync(messageIdFile)) {
                messageIdData = JSON.parse(fs.readFileSync(messageIdFile));
            }

            let message;
            if (messageIdData.messageId) {
                try {
                    // Try to fetch existing message
                    message = await channel.messages.fetch(messageIdData.messageId);
                    await message.edit({ embeds: [embed] }); // Update it
                } catch {
                    // If message doesn't exist, send new
                    message = await channel.send({ embeds: [embed] });
                    messageIdData.messageId = message.id;
                    fs.writeFileSync(messageIdFile, JSON.stringify(messageIdData, null, 2));
                }
            } else {
                // First time posting
                message = await channel.send({ embeds: [embed] });
                messageIdData.messageId = message.id;
                fs.writeFileSync(messageIdFile, JSON.stringify(messageIdData, null, 2));
            }

            await interaction.reply({ content: '✅ Alliance list posted/updated successfully!', ephemeral: true });

        } catch (err) {
            console.error('Error posting/updating alliance list:', err);
            await interaction.reply({ content: '❌ Failed to post/update alliance list.', ephemeral: true });
        }
    }
};
