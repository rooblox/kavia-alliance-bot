const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BlacklistedUser } = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklist-check')
        .setDescription('Check if a Discord user is on the global alliance blacklist')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Discord user to check')
                .setRequired(true)),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const user = interaction.options.getUser('user');

        const entries = await BlacklistedUser.find({ discordId: user.id }).sort({ addedAt: -1 }).catch(() => []);

        if (!entries || entries.length === 0) {
            return await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('✅ Not Blacklisted')
                    .setDescription(`<@${user.id}> (${user.tag}) is **not** on the global alliance blacklist.`)
                    .setColor('Green')
                    .setTimestamp()]
            });
        }

        const entryLines = entries.map(e =>
            `**Alliance:** ${e.allianceName}\n` +
            `**Reason:** ${e.reason}\n` +
            `**Added By:** ${e.addedBy}\n` +
            `**Date:** ${new Date(e.addedAt).toLocaleString()}`
        ).join('\n\n');

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('🚫 User Is Blacklisted')
                .setDescription(
                    `<@${user.id}> (${user.tag}) is on the global alliance blacklist with **${entries.length}** entry(s):\n\n` +
                    entryLines
                )
                .setColor('Red')
                .setFooter({ text: 'Kavià Café — Global Alliance Blacklist' })
                .setTimestamp()]
        });
    }
};