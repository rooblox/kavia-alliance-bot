const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { findAlliance, loadAlliances } = require('../utils/allianceStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-history')
        .setDescription('View the full history of strikes and notes for an alliance')
        .addStringOption(option =>
            option.setName('group_name')
                .setDescription('Alliance name')
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
        if (!alliance) return await interaction.editReply(`❌ Alliance **${groupName}** not found.`);

        const strikes = alliance.strikes || [];
        const notes = alliance.notes || [];

        // Build a combined timeline
        const timeline = [];

        for (const s of strikes) {
            timeline.push({
                date: s.addedOn,
                rawDate: new Date(s.addedOn).getTime() || 0,
                text: `⚠️ **Strike #${s.number}** added by ${s.addedBy}\n> ${s.reason}`
            });
            if (s.removed) {
                timeline.push({
                    date: s.removedOn,
                    rawDate: new Date(s.removedOn).getTime() || 0,
                    text: `✅ **Strike #${s.number}** removed by ${s.removedBy}\n> ${s.removalReason}`
                });
            }
        }

        for (const n of notes) {
            timeline.push({
                date: n.addedAt,
                rawDate: new Date(n.addedAt).getTime() || 0,
                text: `📋 **Note #${n.number}** added by ${n.addedBy}\n> ${n.text}`
            });
            if (n.removed) {
                timeline.push({
                    date: n.removedAt,
                    rawDate: new Date(n.removedAt).getTime() || 0,
                    text: `🗑️ **Note #${n.number}** removed by ${n.removedBy}`
                });
            }
        }

        timeline.sort((a, b) => a.rawDate - b.rawDate);

        if (timeline.length === 0) {
            return await interaction.editReply(`📋 No history found for **${groupName}** — clean record! 🎉`);
        }

        const lines = timeline.map(t => `**${t.date}**\n${t.text}`);

        // Chunk into multiple embeds if needed
        const embeds = [];
        let description = '';
        for (const line of lines) {
            if ((description + '\n\n' + line).length > 3800) {
                embeds.push(new EmbedBuilder()
                    .setTitle(`📜 History — ${groupName}`)
                    .setDescription(description)
                    .setColor(0x9B59B6));
                description = '';
            }
            description += (description ? '\n\n' : '') + line;
        }
        if (description) {
            embeds.push(new EmbedBuilder()
                .setTitle(`📜 History — ${groupName}`)
                .setDescription(description)
                .setColor(0x9B59B6)
                .setFooter({ text: `${strikes.length} strike(s) • ${notes.length} note(s) total` })
                .setTimestamp());
        }

        await interaction.editReply({ embeds: embeds.slice(0, 10) });
    }
};