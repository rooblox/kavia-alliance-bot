const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const sendingDMs = new Set();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Send a direct message to a user as the bot')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Select the user to DM')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Message to send')
                .setRequired(true)),

    async execute(interaction, client) {
        const user = interaction.options.getUser('member');
        const messageContent = interaction.options.getString('message');

        if (sendingDMs.has(user.id)) {
            return interaction.reply({ content: `⚠️ A DM is already being sent to ${user.tag}.`, ephemeral: true });
        }
        sendingDMs.add(user.id);

        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle('📩 Staff Direct Message')
                .setDescription(messageContent)
                .setColor('Gold')
                .setTimestamp();

            await user.send({ embeds: [dmEmbed] });
            await interaction.reply({ content: `✅ DM sent to ${user.tag}`, ephemeral: true });

            if (LOG_CHANNEL_ID) {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('📩 Staff DM Sent')
                        .addFields(
                            { name: 'To', value: `${user.tag}`, inline: false },
                            { name: 'Message', value: messageContent, inline: false },
                            { name: 'Sent By', value: `${interaction.user.tag}`, inline: false },
                            { name: 'Date', value: new Date().toLocaleString(), inline: false }
                        )
                        .setColor('Blue')
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }
        } catch (err) {
            console.error('Error sending DM:', err);
            if (!interaction.replied) {
                await interaction.reply({ content: `❌ Could not DM ${user.tag}. They may have DMs closed.`, ephemeral: true });
            }
        } finally {
            sendingDMs.delete(user.id);
        }
    }
};