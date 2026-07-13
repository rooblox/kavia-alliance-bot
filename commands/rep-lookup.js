const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rep-lookup')
        .setDescription('Find which alliance(s) a Discord user represents')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Discord user to look up')
                .setRequired(true)),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const user = interaction.options.getUser('user');
        const alliances = await loadAlliances().catch(() => []);

        const theirMatches = alliances.filter(a => (a.theirRepIds || []).includes(user.id));
        const ourMatches = alliances.filter(a => (a.ourRepIds || []).includes(user.id));

        if (theirMatches.length === 0 && ourMatches.length === 0) {
            return await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🔍 Rep Lookup')
                    .setDescription(`<@${user.id}> (${user.tag}) is not registered as a rep for any alliance.`)
                    .setColor('Grey')
                    .setTimestamp()]
            });
        }

        const fields = [];
        if (theirMatches.length > 0) {
            fields.push({
                name: `🤝 Alliance Rep (${theirMatches.length})`,
                value: theirMatches.map(a => `**${a.groupName}** — ${a.section}${a.welcomeChannelId ? ` — <#${a.welcomeChannelId}>` : ''}`).join('\n'),
                inline: false
            });
        }
        if (ourMatches.length > 0) {
            fields.push({
                name: `☕ Kavià Rep For (${ourMatches.length})`,
                value: ourMatches.map(a => `**${a.groupName}** — ${a.section}`).join('\n'),
                inline: false
            });
        }

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('🔍 Rep Lookup')
                .setDescription(`Results for <@${user.id}> (${user.tag})`)
                .addFields(fields)
                .setColor(0x9B59B6)
                .setTimestamp()]
        });
    }
};