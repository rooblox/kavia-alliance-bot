const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the alliance leaderboard — fastest/best responders'),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const alliances = await loadAlliances().catch(() => []);
        if (!alliances.length) return await interaction.editReply('❌ No alliances found.');

        // Score based on: fewer active strikes = better, more reps = better, has channel = better
        const scored = alliances.map(a => {
            const activeStrikes = a.strikes?.filter(s => !s.removed).length || 0;
            const repCount = a.theirRepIds?.length || 0;
            const warningCount = a.warnings?.length || 0;

            // Simple scoring formula: start at 100, subtract for issues, add for good standing
            let score = 100;
            score -= activeStrikes * 25;
            score -= warningCount * 5;
            score -= (2 - Math.min(repCount, 2)) * 10;
            score = Math.max(score, 0);

            return {
                groupName: a.groupName,
                section: a.section,
                score,
                activeStrikes,
                repCount,
                warningCount
            };
        });

        scored.sort((a, b) => b.score - a.score);

        const medals = ['🥇', '🥈', '🥉'];
        const lines = scored.slice(0, 15).map((a, i) => {
            const medal = medals[i] || `**${i + 1}.**`;
            return `${medal} **${a.groupName}** (${a.section}) — Score: **${a.score}/100**\n` +
                   `> ${a.repCount}/2 reps • ${a.activeStrikes} active strike(s) • ${a.warningCount} warning(s)`;
        });

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('🏆 Alliance Leaderboard')
                .setDescription(lines.join('\n\n'))
                .setColor(0x9B59B6)
                .setFooter({ text: 'Score based on rep count, strikes, and warnings — informational only' })
                .setTimestamp()]
        });
    }
};