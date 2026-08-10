const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadAlliances, saveAlliance } = require('../utils/allianceStorage');

const TEAM_CATEGORY_MAP = {
    1: '1451290397086060705',
    2: '1451292986557337761',
    3: '1451294316000579848',
    4: '1536082175475195976',
    5: '1536082236653178910'
};

// Reverse map: category ID -> team number
const CATEGORY_TO_TEAM = Object.fromEntries(
    Object.entries(TEAM_CATEGORY_MAP).map(([team, cat]) => [cat, parseInt(team)])
);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('migrate-to-teams')
        .setDescription('Auto-assign all alliances to teams based on which category their channel is in'),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const alliances = await loadAlliances().catch(() => []);
        if (!alliances.length) return await interaction.editReply('❌ No alliances found.');

        let migrated = 0;
        let alreadySet = 0;
        let failed = 0;
        const results = [];

        for (const alliance of alliances) {
            // Skip if already has a team set
            if (alliance.team) {
                alreadySet++;
                continue;
            }

            if (!alliance.welcomeChannelId) {
                failed++;
                results.push(`❌ **${alliance.groupName}** — no channel set`);
                continue;
            }

            const channel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
            if (!channel || !channel.parentId) {
                failed++;
                results.push(`❌ **${alliance.groupName}** — channel not found or no category`);
                continue;
            }

            const team = CATEGORY_TO_TEAM[channel.parentId];
            if (!team) {
                failed++;
                results.push(`❌ **${alliance.groupName}** — category \`${channel.parentId}\` not mapped to any team`);
                continue;
            }

            try {
                alliance.team = team;
                alliance.markModified('team');
                await saveAlliance(alliance);
                migrated++;
                results.push(`✅ **${alliance.groupName}** → Team ${team}`);
            } catch (err) {
                console.error(`Failed to migrate ${alliance.groupName}:`, err);
                failed++;
                results.push(`❌ **${alliance.groupName}** — save failed`);
            }
        }

        const summary = `**Migration complete!**\n✅ Migrated: **${migrated}**\n⏭️ Already had team: **${alreadySet}**\n❌ Failed: **${failed}**`;
        const detail = results.join('\n').slice(0, 3800);

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('🔄 Team Migration Results')
                .setDescription(`${summary}\n\n${detail}`)
                .setColor('Green')
                .setTimestamp()]
        });
    }
};