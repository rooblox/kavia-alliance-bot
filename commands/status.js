const { SlashCommandBuilder, ActivityType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Change the bot status')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('Status text')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Activity type')
                .addChoices(
                    { name: 'Playing', value: 'PLAYING' },
                    { name: 'Watching', value: 'WATCHING' },
                    { name: 'Listening', value: 'LISTENING' }
                )),

    async execute(interaction, client) {
        const text = interaction.options.getString('text');
        const type = interaction.options.getString('type') || 'PLAYING';

        const activityMap = {
            PLAYING: ActivityType.Playing,
            WATCHING: ActivityType.Watching,
            LISTENING: ActivityType.Listening
        };

        client.user.setPresence({
            activities: [{ name: text, type: activityMap[type] }],
            status: 'online'
        });

        await interaction.reply({ content: `✅ Status updated to **${type.toLowerCase()} ${text}**`, ephemeral: true });
    }
};