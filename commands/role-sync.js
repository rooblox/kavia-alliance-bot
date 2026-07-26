const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

const ALLIANCE_GUILD_ID = '1385081586285940796';
const ALLIED_REPS_ROLE_ID = '1417866883750957188';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role-sync')
        .setDescription('Verify every rep has the correct roles and optionally fix mismatches')
        .addBooleanOption(option =>
            option.setName('fix')
                .setDescription('Automatically fix any mismatches found (default: report only)')
                .setRequired(false)),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const fix = interaction.options.getBoolean('fix') || false;
        const alliances = await loadAlliances().catch(() => []);
        const guild = await client.guilds.fetch(ALLIANCE_GUILD_ID).catch(() => null);
        if (!guild) return await interaction.editReply('❌ Could not fetch the main guild.');

        const mismatches = [];
        let fixedCount = 0;

        for (const alliance of alliances) {
            const theirRepIds = alliance.theirRepIds || [];

            for (const repId of theirRepIds) {
                const member = await guild.members.fetch(repId).catch(() => null);
                if (!member) {
                    mismatches.push(`❌ **${alliance.groupName}** — <@${repId}> not found in server`);
                    continue;
                }

                const missingAllied = !member.roles.cache.has(ALLIED_REPS_ROLE_ID);
                const missingAllianceRole = alliance.repRoleId && !member.roles.cache.has(alliance.repRoleId);

                if (missingAllied || missingAllianceRole) {
                    const issues = [];
                    if (missingAllied) issues.push('missing Allied Reps role');
                    if (missingAllianceRole) issues.push('missing alliance rep role');

                    mismatches.push(`⚠️ **${alliance.groupName}** — <@${repId}> ${issues.join(', ')}`);

                    if (fix) {
                        if (missingAllied) await member.roles.add(ALLIED_REPS_ROLE_ID).catch(console.error);
                        if (missingAllianceRole) await member.roles.add(alliance.repRoleId).catch(console.error);
                        fixedCount++;
                    }
                }
            }
        }

        if (mismatches.length === 0) {
            return await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('✅ Role Sync Complete')
                    .setDescription('All reps have the correct roles. No mismatches found! 💜')
                    .setColor('Green')
                    .setTimestamp()]
            });
        }

        const description = mismatches.join('\n').slice(0, 4000);

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle(`🔄 Role Sync ${fix ? 'Report — Fixed' : 'Report — Dry Run'}`)
                .setDescription(description)
                .setColor(fix ? 'Green' : 'Yellow')
                .setFooter({ text: fix ? `${fixedCount} mismatch(es) fixed` : `${mismatches.length} mismatch(es) found — run with fix:true to auto-correct` })
                .setTimestamp()]
        });
    }
};