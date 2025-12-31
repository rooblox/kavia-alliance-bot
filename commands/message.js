const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('message')
        .setDescription('Send a message to a specific text channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Select the text channel')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('text')
                .setDescription('Message to send')
                .setRequired(true)),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const text = interaction.options.getString('text');

        try {
            // Validate channel type
            if (!channel || channel.type !== ChannelType.GuildText) {
                return await interaction.reply({ content: 'Please select a valid text channel.', ephemeral: true });
            }

            // Defer reply immediately to avoid "did not respond"
            await interaction.deferReply({ ephemeral: true });

            // Send the message
            await channel.send({ content: text });

            // Confirm to staff
            await interaction.editReply({ content: `Message successfully sent to ${channel}` });

        } catch (err) {
            console.error('Failed to send message:', err);

            // Always respond even if error occurs
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: 'Failed to send message. Check bot permissions in that channel.' });
            } else {
                await interaction.reply({ content: 'Failed to send message. Check bot permissions in that channel.', ephemeral: true });
            }
        }
    },
};
