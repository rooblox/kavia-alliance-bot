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
                .setRequired(false)
                .addChoices(
                    { name: 'Playing', value: 'PLAYING' },
                    { name: 'Watching', value: 'WATCHING' },
                    { name: 'Listening', value: 'LISTENING' }
                )),

    async execute(interaction, client) {
        const text = interaction.options.getString('text');
        const type = interaction.options.getString('type') || 'PLAYING';

        let activityType = ActivityType.Playing;
        if (type === 'WATCHING') activityType = ActivityType.Watching;
        if (type === 'LISTENING') activityType = ActivityType.Listening;

        client.user.setPresence({
            activities: [{ name: text, type: activityType }],
            status: 'online'
        });

        await interaction.reply({
            content: `✅ Status updated to **${type.toLowerCase()} ${text}**`,
            ephemeral: true
        });
    }
};
