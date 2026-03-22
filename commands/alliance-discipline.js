const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { findAlliance, saveAlliance, deleteAlliance } = require('../utils/allianceStorage');
const { refreshAllianceList } = require('../utils/refreshAllianceList');

const APPEAL_LINK = 'https://forms.gle/h3jUfsMkkzNSdcww8';
const ALLIED_REPS_ROLE_ID = '1417866883750957188';
const TERMINATED_CATEGORY_ID = '1428837884252786819';
const LOG_CHANNEL_ID = '1462580398935642144';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-discipline')
        .setDescription('Discipline an alliance')
        .addStringOption(option =>
            option.setName('group_name')
                .setDescription('Name of the alliance group')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Choose the action')
                .setRequired(true)
                .addChoices(
                    { name: 'Strike 1', value: 'strike1' },
                    { name: 'Strike 2', value: 'strike2' },
                    { name: 'Termination', value: 'termination' },
                    { name: 'Blacklist', value: 'blacklist' },
                    { name: 'Remove Strike', value: 'remove-strike' }
                ))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the action')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('rank')
                .setDescription('Your rank (shown in DM to reps on termination/blacklist)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('strike_number')
                .setDescription('Strike number to remove (required if removing strike)'))
        .addStringOption(option =>
            option.setName('notes')
                .setDescription('Notes / Evidence'))
        .addStringOption(option =>
            option.setName('approved_by')
                .setDescription('Decision approved by'))
        .addStringOption(option =>
            option.setName('follow_up')
                .setDescription('Follow-up actions')),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const groupName = interaction.options.getString('group_name');
            const action = interaction.options.getString('action');
            const reason = interaction.options.getString('reason');
            const rank = interaction.options.getString('rank') || 'PR Staff';
            const strikeNumber = interaction.options.getInteger('strike_number');
            const notes = interaction.options.getString('notes') || 'N/A';
            const approvedBy = interaction.options.getString('approved_by') || 'N/A';
            const followUp = interaction.options.getString('follow_up') || 'N/A';

            const alliance = await findAlliance(groupName);
            if (!alliance) return await interaction.editReply(`❌ Alliance "${groupName}" not found.`);

            const logChannel = interaction.guild.channels.cache.find(ch => ch.name === 'alliance-term-strikes');

            const publicChannel = alliance.welcomeChannelId
                ? await client.channels.fetch(alliance.welcomeChannelId).catch(() => null)
                : null;

            const noChannelWarning = !publicChannel
                ? `\n\n⚠️ **Note:** No channel is set for this alliance. The action has been logged but you will need to send the public message manually.`
                : '';

            // ── Remove Strike ──
            if (action === 'remove-strike') {
                if (!strikeNumber) return await interaction.editReply('❌ You must provide a strike number to remove.');

                const strike = alliance.strikes.find(s => s.number === strikeNumber && !s.removed);
                if (!strike) return await interaction.editReply(`❌ Strike #${strikeNumber} not found or already removed.`);

                strike.removed = true;
                strike.removedBy = interaction.user.tag;
                strike.removalReason = reason;
                strike.removedOn = new Date().toLocaleString();

                await saveAlliance(alliance);

                if (logChannel) {
                    const removeEmbed = new EmbedBuilder()
                        .setTitle(`⚠️ Strike Removed from ${groupName}`)
                        .setColor('Yellow')
                        .addFields(
                            { name: '📅 Date Removed', value: strike.removedOn },
                            { name: '🗑️ Removed By', value: strike.removedBy },
                            { name: '📝 Removal Reason', value: strike.removalReason },
                            { name: 'Strike Number', value: `${strike.number}` },
                            { name: 'Original Reason', value: strike.reason }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [removeEmbed] });
                }

                return await interaction.editReply(`✅ Strike #${strikeNumber} removed from alliance "${groupName}".${noChannelWarning}`);
            }

            // ── Strike ──
            if (action === 'strike1' || action === 'strike2') {
                const newStrikeNumber = alliance.strikes.length + 1;
                alliance.strikes.push({
                    number: newStrikeNumber,
                    reason,
                    notes,
                    addedBy: interaction.user.tag,
                    addedOn: new Date().toLocaleString(),
                    removed: false
                });
                await saveAlliance(alliance);

                if (publicChannel) {
                    await publicChannel.send({
                        content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                        embeds: [new EmbedBuilder()
                            .setTitle(`⚠️ Alliance Strike — ${groupName}`)
                            .setDescription(
                                `<@&${ALLIED_REPS_ROLE_ID}>\n\n` +
                                `Your alliance has received **${action === 'strike1' ? 'Strike 1' : 'Strike 2'}**.\n\n` +
                                `**Reason:** ${reason}\n\n` +
                                `If you believe this is an error or would like to appeal, please use the link below.\n` +
                                `[Submit an Appeal](${APPEAL_LINK})`
                            )
                            .setColor('Orange')
                            .setFooter({ text: 'Kavià Café — Public Relations Department' })
                            .setTimestamp()],
                        allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                    });
                }
            }

            // ── Termination or Blacklist ──
            if (action === 'termination' || action === 'blacklist') {
                const isBlacklist = action === 'blacklist';
                const actionLabel = isBlacklist ? 'Blacklist' : 'Termination';
                const actionColor = isBlacklist ? 0x000000 : 'Red';

                const theirRepIds = alliance.theirRepIds || [];
                const pendingKicks = new Set(theirRepIds);

                // Send notice in alliance channel with I Understand buttons per rep
                if (publicChannel) {
                    await publicChannel.send({
                        content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                        embeds: [new EmbedBuilder()
                            .setTitle(`📢 Alliance ${actionLabel} — ${groupName}`)
                            .setDescription(
                                `<@&${ALLIED_REPS_ROLE_ID}>\n\n` +
                                `We regret to inform you that Kavià Café will be **${isBlacklist ? 'blacklisting' : 'terminating'}** our alliance partnership with **${groupName}**, effective immediately.\n\n` +
                                `**Reason:** ${reason}\n\n` +
                                `${isBlacklist
                                    ? 'This means your group will no longer be eligible for future alliances with Kavià Café.'
                                    : 'This decision does not reflect any ill intent toward your group. We truly appreciate the time, effort, and partnership we\'ve shared.'
                                }\n\n` +
                                `If you would like to appeal this decision, please use the link below.\n` +
                                `[Submit an Appeal](${APPEAL_LINK})\n\n` +
                                `**Please click the button below to acknowledge this notice. You will be removed from the server once you do so.**\n` +
                                `If you do not acknowledge within **24 hours**, you will be automatically removed.`
                            )
                            .setColor(actionColor)
                            .setFooter({ text: 'Kavià Café — Public Relations Department' })
                            .setTimestamp()],
                        components: [new ActionRowBuilder().addComponents(
                            ...theirRepIds.map(repId =>
                                new ButtonBuilder()
                                    .setCustomId(`discipline_understood_${repId}_${groupName.replace(/\s+/g, '_')}_${actionLabel.toLowerCase()}_${rank.replace(/\s+/g, '_')}_${reason.slice(0, 50).replace(/\s+/g, '_')}`)
                                    .setLabel(`I Understand — <@${repId}>`)
                                    .setStyle(ButtonStyle.Secondary)
                            ).slice(0, 5)
                        )],
                        allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                    });

                    // 24 hour auto-kick for anyone who hasn't acknowledged
                    setTimeout(async () => {
                        for (const repId of pendingKicks) {
                            const member = await interaction.guild.members.fetch(repId).catch(() => null);
                            if (!member) continue;

                            // DM them before kicking
                            try {
                                await member.send({
                                    embeds: [new EmbedBuilder()
                                        .setTitle(`${actionLabel} Notice`)
                                        .setDescription(
                                            `Greetings, <@${repId}>\n\n` +
                                            `I'm unfortunately saddened to inform you that your alliance with **Kavià Café** has been **${isBlacklist ? 'blacklisted' : 'terminated'}**, effective immediately.\n\n` +
                                            `This decision was made after careful consideration and was not made lightly.\n\n` +
                                            `🗒️ **Reason:** ${reason}\n\n` +
                                            `We appreciate the time and effort you've contributed during your time as an alliance with **Kavià Café**.\n\n` +
                                            `If you believe this decision was made in error, please feel free to DM me for clarification or open a ticket.\n\n` +
                                            `**Regards,**\n` +
                                            `**${interaction.user.username}**\n` +
                                            `**${rank}**\n` +
                                            `**Kavià || Public Relations Team**`
                                        )
                                        .setColor(actionColor)
                                        .setFooter({ text: 'Kavià Café — Public Relations Department' })
                                        .setTimestamp()]
                                });
                            } catch (err) {
                                console.error(`Failed to DM ${repId} on auto-kick:`, err);
                            }

                            // Kick
                            try {
                                await member.kick(`Alliance ${actionLabel} — auto removed after 24hrs`);
                            } catch (err) {
                                console.error(`Failed to auto-kick ${repId}:`, err);
                            }

                            // Log
                            const logFetchChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                            if (logFetchChannel) {
                                await logFetchChannel.send({
                                    embeds: [new EmbedBuilder()
                                        .setTitle('⏰ Auto-Kick — No Acknowledgement')
                                        .setColor('Orange')
                                        .addFields(
                                            { name: 'User', value: `<@${repId}>`, inline: true },
                                            { name: 'Alliance', value: groupName, inline: true },
                                            { name: 'Reason', value: 'No acknowledgement within 24 hours', inline: false },
                                            { name: 'Date', value: new Date().toLocaleString(), inline: false }
                                        )
                                        .setTimestamp()]
                                });
                            }
                        }

                        // If all kicked, delete roles and archive channel
                        if (pendingKicks.size === 0) {
                            if (alliance.repRoleId) {
                                const theirRole = interaction.guild.roles.cache.get(alliance.repRoleId);
                                if (theirRole) await theirRole.delete().catch(console.error);
                            }
                            if (alliance.ourRepRoleId) {
                                const ourRole = interaction.guild.roles.cache.get(alliance.ourRepRoleId);
                                if (ourRole) await ourRole.delete().catch(console.error);
                            }
                        } else {
                            // Delete roles anyway after auto-kick
                            if (alliance.repRoleId) {
                                const theirRole = interaction.guild.roles.cache.get(alliance.repRoleId);
                                if (theirRole) await theirRole.delete().catch(console.error);
                            }
                            if (alliance.ourRepRoleId) {
                                const ourRole = interaction.guild.roles.cache.get(alliance.ourRepRoleId);
                                if (ourRole) await ourRole.delete().catch(console.error);
                            }
                        }

                        // Archive channel
                        if (publicChannel) {
                            await publicChannel.setParent(TERMINATED_CATEGORY_ID, { lockPermissions: false }).catch(console.error);
                        }

                    }, 24 * 60 * 60 * 1000);
                }

                // Store pending kicks and action info on client for button handler
                client._disciplinePending = client._disciplinePending || new Map();
                client._disciplinePending.set(groupName, {
                    pendingKicks,
                    alliance,
                    actionLabel,
                    actionColor,
                    reason,
                    rank,
                    interactionUserId: interaction.user.id,
                    interactionUserName: interaction.user.username,
                    guildId: interaction.guild.id
                });

                await deleteAlliance(groupName);
                await refreshAllianceList(client);
            }

            // ── Log embed ──
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('☕ | Kavia Café — Alliance / Termination & Strike Log')
                    .setColor(action === 'termination' ? 'Red' : action === 'blacklist' ? 0x000000 : 'Orange')
                    .addFields(
                        { name: '📅 Date', value: new Date().toLocaleString() },
                        { name: '🏛️ Alliance Name', value: groupName },
                        { name: '🔗 Group Link', value: alliance.robloxLink || 'N/A' },
                        { name: '👤 Logged By', value: interaction.user.tag },
                        { name: '⚠️ Action Taken', value: action === 'strike1' ? 'Strike 1' : action === 'strike2' ? 'Strike 2' : action === 'blacklist' ? 'Blacklist' : 'Termination' },
                        { name: '📝 Reason', value: reason },
                        { name: '💬 Notes / Evidence', value: notes },
                        { name: '✅ Decision Approved By', value: approvedBy },
                        { name: '📌 Follow-Up Action', value: followUp },
                        { name: '📝 Appeal Link', value: APPEAL_LINK }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }

            await interaction.editReply(`✅ Action "${action}" successfully applied to alliance "${groupName}".${noChannelWarning}`);

        } catch (err) {
            console.error('Error executing alliance-discipline:', err);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ There was an error executing this command.');
            }
        }
    }
};