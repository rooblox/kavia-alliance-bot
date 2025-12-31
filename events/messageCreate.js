const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        // Ignore bot messages
        if (message.author.bot) return;

        // Only handle DMs
        if (message.guild) return;

        // Find dm-logs channel (first guild only)
        const guild = client.guilds.cache.first();
        if (!guild) return;

        const logChannel = guild.channels.cache.find(
            ch => ch.name === 'dm-logs'
        );
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('📨 Incoming DM Reply')
            .addFields(
                { name: 'From', value: `${message.author.tag}`, inline: false },
                { name: 'User ID', value: message.author.id, inline: false },
                { name: 'Message', value: message.content || '*No text content*', inline: false },
                { name: 'Date', value: new Date().toLocaleString(), inline: false }
            )
            .setColor('Orange')
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    }
};
