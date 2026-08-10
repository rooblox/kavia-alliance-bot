const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-stats')
        .setDescription('View a quick dashboard of alliance statistics'),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const alliances = await loadAlliances().catch(() => []);
        if (!alliances.length) return await interaction.editReply('❌ No alliances found.');

        const total = alliances.length;
        const byTeam = {
            1: alliances.filter(a => a.team === 1).length,
            2: alliances.filter(a => a.team === 2).length,
            3: alliances.filter(a => a.team === 3).length,
            4: alliances.filter(a => a.team === 4).length,
            5: alliances.filter(a => a.team === 5).length,
        };

        const totalReps = alliances.reduce((sum, a) => sum + (a.theirRepIds?.length || 0), 0);
        const missingReps = alliances.filter(a => (a.theirRepIds?.length || 0) < 2).length;
        const noReps = alliances.filter(a => (a.theirRepIds?.length || 0) === 0).length;

        const totalStrikes = alliances.reduce((sum, a) => sum + (a.strikes?.filter(s => !s.removed).length || 0), 0);
        const allianceWithStrikes = alliances.filter(a => (a.strikes?.filter(s => !s.removed).length || 0) > 0).length;

        const avgRepsPerAlliance = total > 0 ? (totalReps / total).toFixed(1) : 0;
        const noChannel = alliances.filter(a => !a.welcomeChannelId).length;

        const topStriked = [...alliances]
            .map(a => ({ groupName: a.groupName, activeStrikes: a.strikes?.filter(s => !s.removed).length || 0 }))
            .filter(a => a.activeStrikes > 0)
            .sort((a, b) => b.activeStrikes - a.activeStrikes)
            .slice(0, 5);

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('📊 Alliance Statistics Dashboard')
                .setColor(0x9B59B6)
                .addFields(
                    { name: '🏛️ Total Alliances', value: `${total}`, inline: true },
                    { name: '👥 Total Reps', value: `${totalReps}`, inline: true },
                    { name: '📐 Avg Reps / Alliance', value: `${avgRepsPerAlliance}`, inline: true },
                    { name: '👥 Team 1', value: `${byTeam[1]}`, inline: true },
                    { name: '👥 Team 2', value: `${byTeam[2]}`, inline: true },
                    { name: '👥 Team 3', value: `${byTeam[3]}`, inline: true },
                    { name: '👥 Team 4', value: `${byTeam[4]}`, inline: true },
                    { name: '👥 Team 5', value: `${byTeam[5]}`, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '⚠️ Missing Reps (<2)', value: `${missingReps}`, inline: true },
                    { name: '❌ Zero Reps', value: `${noReps}`, inline: true },
                    { name: '📺 No Channel Set', value: `${noChannel}`, inline: true },
                    { name: '🚨 Active Strikes (Total)', value: `${totalStrikes}`, inline: true },
                    { name: '⚠️ Alliances With Strikes', value: `${allianceWithStrikes}`, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    {
                        name: '🔥 Top Striked Alliances',
                        value: topStriked.length > 0
                            ? topStriked.map(a => `**${a.groupName}** — ${a.activeStrikes} strike(s)`).join('\n')
                            : 'None — clean record! 🎉',
                        inline: false
                    }
                )
                .setFooter({ text: 'Kavià Café — Alliance Hub' })
                .setTimestamp()]
        });
    }
};