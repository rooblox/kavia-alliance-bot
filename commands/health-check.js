const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { loadAlliances, findAlliance, saveAlliance } = require('../utils/allianceStorage');

const ALLIANCE_GUILD_ID = '1385081586285940796';
const ALLIED_REPS_ROLE_ID = '1417866883750957188';
const VERIFICATION_CHANNEL_ID = '1417865773271224350';
const LOG_CHANNEL_ID = '1462580398935642144';
const KAVIA_DISCORD = 'https://discord.gg/rMtv4smu36';
const KAVIA_ROBLOX = 'https://www.roblox.com/communities/13827902/Kavi-Cafe#!/about';

const activeHealthChecks = new Map();

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
        const allianceFlags = {}; // groupName -> { missingReps, missingDiscord, missingRoblox, staffOnlyIssues }
        let checkedCount = 0;

        for (const alliance of alliances) {
            const allianceIssues = [];
            const theirRepIds = alliance.theirRepIds || [];
            const flags = { missingReps: false, missingDiscord: false, missingRoblox: false, staffOnlyIssues: [] };

            // ── 2-rep check ──
            if (theirRepIds.length < 2) {
                allianceIssues.push(`⚠️ Only **${theirRepIds.length}** rep(s) on file (needs 2)`);
                flags.missingReps = true;
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

            // ── Channel check (staff-only) ──
            if (alliance.welcomeChannelId) {
                const channel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
                if (!channel) {
                    allianceIssues.push(`❌ Alliance channel **no longer exists**`);
                    flags.staffOnlyIssues.push('channel missing');
                }
            } else {
                allianceIssues.push(`⚠️ No channel set for this alliance`);
                flags.staffOnlyIssues.push('no channel set');
            }

            // ── Role existence check (staff-only) ──
            if (alliance.repRoleId) {
                const role = guild.roles.cache.get(alliance.repRoleId);
                if (!role) {
                    allianceIssues.push(`❌ Rep role **no longer exists**`);
                    flags.staffOnlyIssues.push('rep role deleted');
                }
            } else {
                allianceIssues.push(`⚠️ No rep role set`);
                flags.staffOnlyIssues.push('no rep role set');
            }

            // ── Discord invite link check ──
            if (alliance.discordLink && alliance.discordLink !== 'N/A') {
                try {
                    const inviteCode = alliance.discordLink.split('/').pop();
                    const invite = await client.fetchInvite(inviteCode).catch(() => null);
                    if (!invite) {
                        allianceIssues.push(`❌ Discord invite link is **invalid or expired**`);
                        flags.missingDiscord = true;
                    }
                } catch (err) {
                    allianceIssues.push(`❌ Discord invite link could not be verified`);
                    flags.missingDiscord = true;
                }
            } else {
                allianceIssues.push(`⚠️ No Discord link set`);
                flags.missingDiscord = true;
            }

            // ── Roblox link check ──
            if (!alliance.robloxLink || alliance.robloxLink === 'N/A') {
                allianceIssues.push(`⚠️ No Roblox link set`);
                flags.missingRoblox = true;
            }

            checkedCount++;

            if (allianceIssues.length > 0) {
                issues.push({ groupName: alliance.groupName, allianceIssues });
                allianceFlags[alliance.groupName] = flags;
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

        const healthCheckId = `${interaction.user.id}_${Date.now()}`;
        activeHealthChecks.set(healthCheckId, allianceFlags);

        const sections = issues.map(i => `**${i.groupName}**\n${i.allianceIssues.join('\n')}`);
        let description = '';
        const embeds = [];

        for (const section of sections) {
            if ((description + '\n\n' + section).length > 3800) {
                embeds.push(new EmbedBuilder()
                    .setTitle('🩺 Alliance Health Check Report')
                    .setDescription(description)
                    .setColor('Orange'));
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

        const alertableCount = Object.values(allianceFlags).filter(f => f.missingReps || f.missingDiscord || f.missingRoblox).length;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`healthcheck_alert_${healthCheckId}`)
                .setLabel(`📢 Alert ${alertableCount} Flagged Alliance(s)`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(alertableCount === 0)
        );

        await interaction.editReply({ embeds: embeds.slice(0, 10), components: [row] });
    },

    async handleButton(interaction, client) {
        const customId = interaction.customId;

        // ── Alert all flagged alliances ──
        if (customId.startsWith('healthcheck_alert_')) {
            const healthCheckId = customId.replace('healthcheck_alert_', '');
            const allianceFlags = activeHealthChecks.get(healthCheckId);
            if (!allianceFlags) {
                return interaction.reply({ content: '❌ This health check session has expired. Please run /health-check again.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            let alerted = 0;
            let failed = 0;

            for (const [groupName, flags] of Object.entries(allianceFlags)) {
                if (!flags.missingReps && !flags.missingDiscord && !flags.missingRoblox) continue;

                const alliance = await findAlliance(groupName).catch(() => null);
                if (!alliance || !alliance.welcomeChannelId) { failed++; continue; }

                const channel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
                if (!channel) { failed++; continue; }

                try {
                    // ── Missing rep alert ──
                    if (flags.missingReps) {
                        await channel.send({
                            content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                            embeds: [new EmbedBuilder()
                                .setTitle('👥 Missing Representative')
                                .setDescription(
                                    `Hey there! 👋\n\n` +
                                    `We noticed that **${groupName}** currently does not have 2 representatives registered in our Alliance Hub.\n\n` +
                                    `**What to do:**\n` +
                                    `• Have your second representative join the **Kavià Alliance Hub**\n` +
                                    `• Have them verify in <#${VERIFICATION_CHANNEL_ID}>\n` +
                                    `• A PR staff member will then assign them the correct roles\n\n` +
                                    `🔗 [Discord Server](${KAVIA_DISCORD}) • [Roblox Group](${KAVIA_ROBLOX})`
                                )
                                .setColor('Yellow')
                                .setFooter({ text: 'Kavià Café — Alliance Hub Health Check' })
                                .setTimestamp()],
                            allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                        });
                    }

                    // ── Missing link(s) alert ──
                    if (flags.missingDiscord || flags.missingRoblox) {
                        const buttons = [];
                        if (flags.missingDiscord) {
                            buttons.push(new ButtonBuilder()
                                .setCustomId(`healthcheck_addlink_discord_${groupName.replace(/\s+/g, '_')}`)
                                .setLabel('🔗 Add Discord Link')
                                .setStyle(ButtonStyle.Primary));
                        }
                        if (flags.missingRoblox) {
                            buttons.push(new ButtonBuilder()
                                .setCustomId(`healthcheck_addlink_roblox_${groupName.replace(/\s+/g, '_')}`)
                                .setLabel('🔗 Add Roblox Link')
                                .setStyle(ButtonStyle.Primary));
                        }

                        const missingList = [
                            flags.missingDiscord ? 'Discord invite link' : null,
                            flags.missingRoblox ? 'Roblox group link' : null
                        ].filter(Boolean).join(' and ');

                        await channel.send({
                            content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                            embeds: [new EmbedBuilder()
                                .setTitle('🔗 Missing Link(s)')
                                .setDescription(
                                    `Hey there! 👋\n\n` +
                                    `We noticed that **${groupName}** is missing a **${missingList}** in our records.\n\n` +
                                    `Please click the button(s) below to submit it. 💜`
                                )
                                .setColor('Yellow')
                                .setFooter({ text: 'Kavià Café — Alliance Hub Health Check' })
                                .setTimestamp()],
                            components: [new ActionRowBuilder().addComponents(...buttons)],
                            allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                        });
                    }

                    alerted++;
                } catch (err) {
                    console.error(`Failed to alert ${groupName}:`, err);
                    failed++;
                }
            }

            activeHealthChecks.delete(healthCheckId);

            await interaction.editReply(`✅ Alerted **${alerted}** alliance(s)${failed > 0 ? ` — ⚠️ failed for **${failed}**` : ''}.`);
            return;
        }

        // ── Add link buttons ──
        if (customId.startsWith('healthcheck_addlink_discord_') || customId.startsWith('healthcheck_addlink_roblox_')) {
            const isDiscord = customId.startsWith('healthcheck_addlink_discord_');
            const groupName = customId.replace(isDiscord ? 'healthcheck_addlink_discord_' : 'healthcheck_addlink_roblox_', '').replace(/_/g, ' ');

            const modal = new ModalBuilder()
                .setCustomId(`healthcheck_link_modal_${isDiscord ? 'discord' : 'roblox'}_${groupName.replace(/\s+/g, '_')}`)
                .setTitle(`Add ${isDiscord ? 'Discord' : 'Roblox'} Link`);

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('link_value')
                        .setLabel(`Your ${isDiscord ? 'Discord invite' : 'Roblox group'} link`)
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder(isDiscord ? 'https://discord.gg/...' : 'https://www.roblox.com/communities/...')
                        .setRequired(true)
                        .setMaxLength(200)
                )
            );

            await interaction.showModal(modal);
        }
    },

    async handleModal(interaction, client) {
        if (!interaction.customId.startsWith('healthcheck_link_modal_')) return;

        const withoutPrefix = interaction.customId.replace('healthcheck_link_modal_', '');
        const isDiscord = withoutPrefix.startsWith('discord_');
        const groupName = withoutPrefix.replace(isDiscord ? 'discord_' : 'roblox_', '').replace(/_/g, ' ');
        const linkValue = interaction.fields.getTextInputValue('link_value');

        await interaction.deferReply({ ephemeral: true });

        const alliance = await findAlliance(groupName);
        if (!alliance) return await interaction.editReply(`❌ Alliance **${groupName}** not found.`);

        if (isDiscord) {
            alliance.discordLink = linkValue;
            alliance.markModified('discordLink');
        } else {
            alliance.robloxLink = linkValue;
            alliance.markModified('robloxLink');
        }
        await saveAlliance(alliance);

        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            await logChannel.send({
                embeds: [new EmbedBuilder()
                    .setTitle(`🔗 ${isDiscord ? 'Discord' : 'Roblox'} Link Submitted`)
                    .setColor('Green')
                    .addFields(
                        { name: 'Alliance', value: groupName, inline: true },
                        { name: 'Submitted By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                        { name: 'Link', value: linkValue, inline: false }
                    )
                    .setTimestamp()]
            });
        }

        await interaction.editReply(`✅ Your ${isDiscord ? 'Discord' : 'Roblox'} link has been submitted and saved. Thank you! 💜`);
    },

    activeHealthChecks
};