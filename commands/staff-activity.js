const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff-activity')
        .setDescription('View which staff members have been actively reviewing items'),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const alliances = await loadAlliances().catch(() => []);

        const staffCounts = {};

        const tally = (name, type) => {
            if (!name) return;
            if (!staffCounts[name]) staffCounts[name] = { strikes: 0, removals: 0, notes: 0, warnings: 0 };
            staffCounts[name][type] = (staffCounts[name][type] || 0) + 1;
        };

        for (const alliance of alliances) {
            for (const s of alliance.strikes || []) {
                tally(s.addedBy, 'strikes');
                if (s.removed) tally(s.removedBy, 'removals');
            }
            for (const n of alliance.notes || []) {
                tally(n.addedBy, 'notes');
            }
            for (const w of alliance.warnings || []) {
                tally(w.addedBy, 'warnings');
            }
        }

        const staffNames = Object.keys(staffCounts);
        if (staffNames.length === 0) {
            return await interaction.editReply('📋 No staff activity recorded yet.');
        }

        const sorted = staffNames
            .map(name => ({
                name,
                total: staffCounts[name].strikes + staffCounts[name].removals + staffCounts[name].notes + staffCounts[name].warnings,
                ...staffCounts[name]
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 15);

        const lines = sorted.map((s, i) =>
            `**${i + 1}. ${s.name}** — ${s.total} action(s)\n` +
            `> ⚠️ ${s.strikes} strike(s) • ✅ ${s.removals} removal(s) • 📋 ${s.notes} note(s) • ⚡ ${s.warnings} warning(s)`
        );

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('👤 Staff Activity Report')
                .setDescription(lines.join('\n\n'))
                .setColor(0x9B59B6)
                .setFooter({ text: 'Based on strikes, removals, notes, and warnings logged in alliance records' })
                .setTimestamp()]
        });
    }
};