const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const sendingDMs = new Set();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Send a staff direct message to a user')
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
        const guildId = '1454555005725048894'; // Replace with your production server ID

        // Prevent spamming multiple DMs
        if (sendingDMs.has(user.id)) {
            return interaction.reply({ content: `⚠️ DM already being sent to ${user.tag}`, ephemeral: true });
        }
        sendingDMs.add(user.id);

        const dmEmbed = new EmbedBuilder()
            .setTitle('📩 Staff Direct Message')
            .setDescription(messageContent)
            .setColor('Gold')
            .setTimestamp();

        try {
            // Send DM to user
            await user.send({ embeds: [dmEmbed] });

            // Confirm to the staff member
            if (!interaction.replied) {
                await interaction.reply({ content: `✅ DM sent to ${user.tag}`, ephemeral: true });
            }

            // Fetch guild and log channel properly
            const guild = await client.guilds.fetch(guildId);
            if (!guild) return console.error('Guild not found');

            const channels = await guild.channels.fetch();
            const logChannel = channels.find(ch => ch.name === 'dm-logs');
            if (!logChannel) return console.error('Log channel not found');

            // Create log embed
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

        } catch (err) {
            console.error('Error sending DM or logging:', err);

            if (!interaction.replied) {
                await interaction.reply({
                    content: `❌ Could not DM ${user.tag}. They may have DMs closed.`,
                    ephemeral: true
                });
            }
        } finally {
            sendingDMs.delete(user.id);
        }
    }
};
