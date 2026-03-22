const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('message')
        .setDescription('Send a message to a specific text channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Select the text channel')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText))
        .addStringOption(option =>
            option.setName('text')
                .setDescription('Message to send')
                .setRequired(true)),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const text = interaction.options.getString('text');

        await interaction.deferReply({ ephemeral: true });

        try {
            await channel.send({ content: text });
            await interaction.editReply({ content: `✅ Message successfully sent to ${channel}` });
        } catch (err) {
            console.error('Failed to send message:', err);
            await interaction.editReply({ content: '❌ Failed to send message. Check bot permissions in that channel.' });
        }
    }
};