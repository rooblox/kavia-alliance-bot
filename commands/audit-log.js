const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('audit-log')
        .setDescription('View a searchable log of major actions across all alliances')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Filter by action type')
                .setRequired(false)
                .addChoices(
                    { name: 'Strikes', value: 'strikes' },
                    { name: 'Notes', value: 'notes' },
                    { name: 'Warnings', value: 'warnings' },
                    { name: 'All', value: 'all' }
                ))
        .addIntegerOption(option =>
            option.setName('team')
                .setDescription('Filter by team number')
                .setRequired(false)
                .addChoices(
                    { name: 'Team 1', value: 1 },
                    { name: 'Team 2', value: 2 },
                    { name: 'Team 3', value: 3 },
                    { name: 'Team 4', value: 4 },
                    { name: 'Team 5', value: 5 }
                ))
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Number of entries to show (default 15, max 25)')
                .setRequired(false)),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const type = interaction.options.getString('type') || 'all';
        const teamFilter = interaction.options.getInteger('team') || null;
        const limit = Math.min(interaction.options.getInteger('limit') || 15, 25);

        let alliances = await loadAlliances().catch(() => []);
        if (teamFilter) alliances = alliances.filter(a => a.team === teamFilter);
        const entries = [];

        for (const alliance of alliances) {
            if (type === 'strikes' || type === 'all') {
                for (const s of alliance.strikes || []) {
                    entries.push({
                        date: s.addedOn,
                        rawDate: new Date(s.addedOn).getTime() || 0,
                        text: `⚠️ **[${alliance.groupName}]** Strike #${s.number} added by ${s.addedBy}\n> ${s.reason}`
                    });
                    if (s.removed) {
                        entries.push({
                            date: s.removedOn,
                            rawDate: new Date(s.removedOn).getTime() || 0,
                            text: `✅ **[${alliance.groupName}]** Strike #${s.number} removed by ${s.removedBy}`
                        });
                    }
                }
            }
            if (type === 'notes' || type === 'all') {
                for (const n of alliance.notes || []) {
                    entries.push({
                        date: n.addedAt,
                        rawDate: new Date(n.addedAt).getTime() || 0,
                        text: `📋 **[${alliance.groupName}]** Note #${n.number} added by ${n.addedBy}`
                    });
                }
            }
            if (type === 'warnings' || type === 'all') {
                for (const w of alliance.warnings || []) {
                    entries.push({
                        date: w.addedOn,
                        rawDate: new Date(w.addedOn).getTime() || 0,
                        text: `⚡ **[${alliance.groupName}]** Warning #${w.number} issued by ${w.addedBy}`
                    });
                }
            }
        }

        entries.sort((a, b) => b.rawDate - a.rawDate);
        const limited = entries.slice(0, limit);

        if (limited.length === 0) {
            return await interaction.editReply('📋 No entries found for this filter.');
        }

        const lines = limited.map(e => `**${e.date}**\n${e.text}`);

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle(`📜 Audit Log${type !== 'all' ? ` — ${type.charAt(0).toUpperCase() + type.slice(1)}` : ''}${teamFilter ? ` — Team ${teamFilter}` : ''}`)
                .setDescription(lines.join('\n\n').slice(0, 4000))
                .setColor(0x9B59B6)
                .setFooter({ text: `Showing ${limited.length} of ${entries.length} total entries` })
                .setTimestamp()]
        });
    }
};