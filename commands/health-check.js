const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

const ALLIANCE_GUILD_ID = '1385081586285940796';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('health-check')
        .setDescription('Run a full health check across all alliances'),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const alliances = await loadAlliances().catch(() => []);
        if (!alliances.length) return await interaction.editReply('❌ No alliances found.');

        const guild = await client.guilds.fetch(ALLIANCE_GUILD_ID).catch(() => null);
        if (!guild) return await interaction.editReply('❌ Could not fetch the main guild.');

        const issues = [];
        let checkedCount = 0;

        for (const alliance of alliances) {
            const allianceIssues = [];
            const theirRepIds = alliance.theirRepIds || [];

            // ── 2-rep check ──
            if (theirRepIds.length < 2) {
                allianceIssues.push(`⚠️ Only **${theirRepIds.length}** rep(s) on file (needs 2)`);
            }

            // ── Server membership + role check ──
            for (const repId of theirRepIds) {
                const member = await guild.members.fetch(repId).catch(() => null);
                if (!member) {
                    allianceIssues.push(`❌ Rep <@${repId}> is **not in the server**`);
                    continue;
                }
                if (alliance.repRoleId && !member.roles.cache.has(alliance.repRoleId)) {
                    allianceIssues.push(`⚠️ Rep <@${repId}> is in the server but **missing the rep role**`);
                }
            }

            // ── Channel check ──
            if (alliance.welcomeChannelId) {
                const channel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
                if (!channel) {
                    allianceIssues.push(`❌ Alliance channel **no longer exists**`);
                }
            } else {
                allianceIssues.push(`⚠️ No channel set for this alliance`);
            }

            // ── Role existence check ──
            if (alliance.repRoleId) {
                const role = guild.roles.cache.get(alliance.repRoleId);
                if (!role) allianceIssues.push(`❌ Rep role **no longer exists**`);
            } else {
                allianceIssues.push(`⚠️ No rep role set`);
            }

            // ── Discord invite link check ──
            if (alliance.discordLink && alliance.discordLink !== 'N/A') {
                try {
                    const inviteCode = alliance.discordLink.split('/').pop();
                    const invite = await client.fetchInvite(inviteCode).catch(() => null);
                    if (!invite) {
                        allianceIssues.push(`❌ Discord invite link is **invalid or expired**`);
                    }
                } catch (err) {
                    allianceIssues.push(`❌ Discord invite link could not be verified`);
                }
            } else {
                allianceIssues.push(`⚠️ No Discord link set`);
            }

            // ── Roblox link check ──
            if (!alliance.robloxLink || alliance.robloxLink === 'N/A') {
                allianceIssues.push(`⚠️ No Roblox link set`);
            }

            checkedCount++;

            if (allianceIssues.length > 0) {
                issues.push({ groupName: alliance.groupName, allianceIssues });
            }
        }

        if (issues.length === 0) {
            return await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('✅ Health Check Complete')
                    .setDescription(`Checked **${checkedCount}** alliance(s) — no issues found! Everything looks healthy. 💜`)
                    .setColor('Green')
                    .setTimestamp()]
            });
        }

        // Build report, chunking if too long
        const sections = issues.map(i => `**${i.groupName}**\n${i.allianceIssues.join('\n')}`);
        let description = '';
        const embeds = [];

        for (const section of sections) {
            if ((description + '\n\n' + section).length > 3800) {
                embeds.push(new EmbedBuilder()
                    .setTitle('🩺 Alliance Health Check Report')
                    .setDescription(description)
                    .setColor('Orange')
                    .setTimestamp());
                description = '';
            }
            description += (description ? '\n\n' : '') + section;
        }

        if (description) {
            embeds.push(new EmbedBuilder()
                .setTitle('🩺 Alliance Health Check Report')
                .setDescription(description)
                .setColor('Orange')
                .setFooter({ text: `Checked ${checkedCount} alliance(s) • ${issues.length} with issues` })
                .setTimestamp());
        }

        await interaction.editReply({ embeds: embeds.slice(0, 10) });
    }
};