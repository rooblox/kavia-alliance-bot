const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { findAlliance, loadAlliances } = require('../utils/allianceStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-strikes')
        .setDescription('View strikes for an alliance')
        .addStringOption(option =>
            option.setName('group_name')
                .setDescription('Name of the alliance')
                .setRequired(true)
                .setAutocomplete(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const alliances = await loadAlliances().catch(() => []);
        const filtered = alliances
            .filter(a => a.groupName.toLowerCase().includes(focusedValue))
            .slice(0, 25)
            .map(a => ({ name: a.groupName, value: a.groupName }));
        await interaction.respond(filtered);
    },

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const groupName = interaction.options.getString('group_name');
        const alliance = await findAlliance(groupName);
        if (!alliance) return await interaction.editReply(`❌ Alliance "${groupName}" not found.`);

        const strikes = alliance.strikes || [];
        if (strikes.length === 0) return await interaction.editReply(`📋 No strikes found for **${groupName}**.`);

        const activeStrikes = strikes.filter(s => !s.removed);
        const removedStrikes = strikes.filter(s => s.removed);

        const activeLines = activeStrikes.length > 0
            ? activeStrikes.map(s =>
                `**Strike #${s.number}** — Active\n` +
                `• **Reason:** ${s.reason}\n` +
                `• **Notes:** ${s.notes || 'N/A'}\n` +
                `• **Added by:** ${s.addedBy} on ${s.addedOn}`
            ).join('\n\n')
            : '*No active strikes*';

        const removedLines = removedStrikes.length > 0
            ? removedStrikes.map(s =>
                `**Strike #${s.number}** — ~~Removed~~\n` +
                `• **Original Reason:** ${s.reason}\n` +
                `• **Added by:** ${s.addedBy} on ${s.addedOn}\n` +
                `• **Removed by:** ${s.removedBy} on ${s.removedOn}\n` +
                `• **Removal reason:** ${s.removalReason}`
            ).join('\n\n')
            : '*No removed strikes*';

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle(`⚠️ Strikes — ${groupName}`)
                .addFields(
                    { name: `✅ Active Strikes (${activeStrikes.length})`, value: activeLines, inline: false },
                    { name: `🗑️ Removed Strikes (${removedStrikes.length})`, value: removedLines, inline: false }
                )
                .setColor('Orange')
                .setFooter({ text: `${activeStrikes.length} active strike(s) • ${strikes.length} total` })
                .setTimestamp()]
        });
    }
};