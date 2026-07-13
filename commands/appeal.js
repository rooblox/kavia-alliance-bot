const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { findAlliance, saveAlliance } = require('../utils/allianceStorage');

const APPEAL_LOG_CHANNEL_ID = '1507114345723727945';
const STAFF_ROLE_ID = '1485100238715883720';
const ALLIED_REPS_ROLE_ID = '1417866883750957188';
const STRIKE_1_ROLE_ID = '1433165486258127062';
const STRIKE_2_ROLE_ID = '1433165562531545141';

const activeAppeals = new Map();

module.exports = {
    APPEAL_LOG_CHANNEL_ID,
    activeAppeals,

    async handleButton(interaction, client) {
        const customId = interaction.customId;

        // ── Start Appeal Button ──
        if (customId.startsWith('appeal_start_')) {
            const parts = customId.replace('appeal_start_', '').split('_');
            const actionLabel = parts[parts.length - 1];
            const groupName = parts.slice(0, -1).join(' ');

            const modal = new ModalBuilder()
                .setCustomId(`appeal_modal_${groupName.replace(/\s+/g, '_')}_${actionLabel}`)
                .setTitle('Submit an Appeal');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('appeal_alliance_name')
                        .setLabel('Alliance Name')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. Valeria Isles')
                        .setRequired(true)
                        .setValue(groupName)
                        .setMaxLength(100)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('appeal_type')
                        .setLabel('What are you appealing?')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Strike or Termination')
                        .setRequired(true)
                        .setMaxLength(50)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('appeal_given_by')
                        .setLabel('Who gave this discipline?')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. username#0000')
                        .setRequired(true)
                        .setMaxLength(100)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('appeal_reason')
                        .setLabel('Why should this be overturned?')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Please use great detail...')
                        .setRequired(true)
                        .setMaxLength(1000)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('appeal_evidence')
                        .setLabel('Evidence (link, "Will DM", or N/A)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Link, "Will DM You The Evidence", or N/A')
                        .setRequired(true)
                        .setMaxLength(500)
                )
            );

            await interaction.showModal(modal);
        }

        // ── Approve Appeal ──
        if (customId.startsWith('appeal_approve_')) {
            const appealId = customId.replace('appeal_approve_', '');
            const appeal = activeAppeals.get(appealId);

            const appealType = appeal?.appealType?.toLowerCase() || '';
            const isStrike = appealType.includes('strike');
            const isTermination = appealType.includes('termination') || appealType.includes('blacklist');

            let autoActionNote = '';

            // ── Auto remove strike ──
            if (isStrike && appeal?.allianceName) {
                try {
                    const alliance = await findAlliance(appeal.allianceName);
                    if (alliance) {
                        const activeStrikes = alliance.strikes.filter(s => !s.removed);
                        const latestStrike = activeStrikes[activeStrikes.length - 1];

                        if (latestStrike) {
                            latestStrike.removed = true;
                            latestStrike.removedBy = `Appeal approved by ${interaction.user.tag}`;
                            latestStrike.removalReason = 'Appeal approved';
                            latestStrike.removedOn = new Date().toLocaleString();
                            alliance.markModified('strikes');
                            await saveAlliance(alliance);

                            // Remove strike roles from their reps
                            const guild = await client.guilds.fetch(interaction.guildId).catch(() => null);
                            if (guild) {
                                const remainingStrikes = alliance.strikes.filter(s => !s.removed);
                                const hasStrike1 = remainingStrikes.some(s => s.number === 1);
                                const hasStrike2 = remainingStrikes.some(s => s.number === 2);

                                for (const repId of alliance.theirRepIds || []) {
                                    const member = await guild.members.fetch(repId).catch(() => null);
                                    if (!member) continue;
                                    if (!hasStrike1) await member.roles.remove(STRIKE_1_ROLE_ID).catch(console.error);
                                    if (!hasStrike2) await member.roles.remove(STRIKE_2_ROLE_ID).catch(console.error);
                                }
                            }

                            autoActionNote = `✅ Strike #${latestStrike.number} has been automatically removed from the alliance record and strike roles updated.`;
                        } else {
                            autoActionNote = '⚠️ No active strikes found to remove — please check manually.';
                        }
                    } else {
                        autoActionNote = '⚠️ Alliance not found in database — strike could not be auto-removed.';
                    }
                } catch (err) {
                    console.error('Failed to auto-remove strike on appeal approval:', err);
                    autoActionNote = '⚠️ Failed to auto-remove strike — please remove it manually using /alliance-discipline.';
                }
            }

            // ── Termination reminder ──
            if (isTermination) {
                autoActionNote = `⚠️ This was a termination/blacklist appeal. The alliance was removed from the database and their roles/channel were archived. To restore:\n• Re-add the alliance using **/alliance-add**\n• Recreate their roles and channel\n• Re-invite their reps and assign roles`;
            }

            await interaction.update({
                embeds: [EmbedBuilder.from(interaction.message.embeds[0])
                    .setTitle('📋 Alliance Appeal — ✅ Approved')
                    .setColor('Green')
                    .addFields(
                        { name: 'Reviewed By', value: interaction.user.tag, inline: true },
                        { name: '⚠️ Action Required', value: autoActionNote || 'No further action needed.', inline: false }
                    )],
                components: []
            });

            if (appeal?.channelId) {
                const allianceChannel = await client.channels.fetch(appeal.channelId).catch(() => null);
                if (allianceChannel) {
                    await allianceChannel.send({
                        content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                        embeds: [new EmbedBuilder()
                            .setTitle('✅ Appeal Approved')
                            .setDescription(
                                `The appeal submitted for **${appeal.allianceName}** has been **approved** by PR Leadership! 💜\n\n` +
                                `The discipline against your alliance has been reviewed and overturned. Please reach out to PR Leadership if you have any further questions.`
                            )
                            .setColor('Green')
                            .addFields(
                                { name: 'Appeal Type', value: appeal.appealType, inline: true },
                                { name: 'Approved By', value: interaction.user.tag, inline: true }
                            )
                            .setFooter({ text: 'Kavià Café — Public Relations Department' })
                            .setTimestamp()],
                        allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                    });
                }
            }

            activeAppeals.delete(appealId);
        }

        // ── Deny Appeal ──
        if (customId.startsWith('appeal_deny_')) {
            const appealId = customId.replace('appeal_deny_', '');

            const modal = new ModalBuilder()
                .setCustomId(`appeal_deny_modal_${appealId}`)
                .setTitle('Deny Appeal');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('deny_reason')
                        .setLabel('Reason for denial')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Please provide a reason for denying this appeal...')
                        .setRequired(true)
                        .setMaxLength(500)
                )
            );

            await interaction.showModal(modal);
        }

        // ── More Info Button ──
        if (customId.startsWith('appeal_moreinfo_')) {
            const appealId = customId.replace('appeal_moreinfo_', '');

            const modal = new ModalBuilder()
                .setCustomId(`appeal_moreinfo_modal_${appealId}`)
                .setTitle('Request More Information');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('moreinfo_message')
                        .setLabel('What information is needed?')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Describe what additional information is needed...')
                        .setRequired(true)
                        .setMaxLength(500)
                )
            );

            await interaction.showModal(modal);
        }

        // ── Resubmit Appeal Button ──
        if (customId.startsWith('appeal_resubmit_')) {
            const appealId = customId.replace('appeal_resubmit_', '');
            const appeal = activeAppeals.get(appealId);
            if (!appeal) {
                return interaction.reply({ content: '❌ This appeal is no longer active.', ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId(`appeal_resubmit_modal_${appealId}`)
                .setTitle('Resubmit Appeal');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('appeal_reason')
                        .setLabel('Updated reason for appeal')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Update your appeal with the requested information...')
                        .setRequired(true)
                        .setMaxLength(1000)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('appeal_evidence')
                        .setLabel('Updated Evidence')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Link, "Will DM You The Evidence", or N/A')
                        .setRequired(true)
                        .setMaxLength(500)
                )
            );

            await interaction.showModal(modal);
        }
    },

    async handleModal(interaction, client) {
        const customId = interaction.customId;

        // ── Appeal Submission Modal ──
        if (customId.startsWith('appeal_modal_')) {
            const parts = customId.replace('appeal_modal_', '').split('_');
            const actionLabel = parts[parts.length - 1];
            const groupName = parts.slice(0, -1).join(' ');

            const allianceName = interaction.fields.getTextInputValue('appeal_alliance_name');
            const appealType = interaction.fields.getTextInputValue('appeal_type');
            const givenBy = interaction.fields.getTextInputValue('appeal_given_by');
            const reason = interaction.fields.getTextInputValue('appeal_reason');
            const evidence = interaction.fields.getTextInputValue('appeal_evidence');

            await interaction.deferReply({ ephemeral: true });

            const alliance = await findAlliance(allianceName).catch(() => null);
            const appealId = `${interaction.user.id}_${Date.now()}`;

            activeAppeals.set(appealId, {
                appealId,
                userId: interaction.user.id,
                allianceName,
                appealType,
                givenBy,
                reason,
                evidence,
                channelId: alliance?.welcomeChannelId || null,
                submittedAt: new Date().toISOString()
            });

            // Post in alliance channel that appeal has been submitted
            if (alliance?.welcomeChannelId) {
                const allianceChannel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
                if (allianceChannel) {
                    await allianceChannel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('📋 Appeal Submitted')
                            .setDescription(
                                `An appeal has been submitted by <@${interaction.user.id}> for **${allianceName}**.\n\n` +
                                `**Appealing:** ${appealType}\n\n` +
                                `PR Leadership has been notified and will review the appeal shortly. You will be notified here once a decision has been made. 💜`
                            )
                            .setColor(0x9B59B6)
                            .setFooter({ text: 'Kavià Café — Appeals System' })
                            .setTimestamp()]
                    });
                }
            }

            const appealLogChannel = await client.channels.fetch(APPEAL_LOG_CHANNEL_ID).catch(() => null);
            if (appealLogChannel) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`appeal_approve_${appealId}`)
                        .setLabel('✅ Approve')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`appeal_deny_${appealId}`)
                        .setLabel('❌ Deny')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`appeal_moreinfo_${appealId}`)
                        .setLabel('📋 Ask for More Info')
                        .setStyle(ButtonStyle.Secondary)
                );

                await appealLogChannel.send({
                    content: `<@&${STAFF_ROLE_ID}>`,
                    embeds: [new EmbedBuilder()
                        .setTitle('📋 New Alliance Appeal Submitted')
                        .setColor(0x9B59B6)
                        .addFields(
                            { name: 'Submitted By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                            { name: 'Alliance Name', value: allianceName, inline: true },
                            { name: 'Appealing', value: appealType, inline: true },
                            { name: 'Discipline Given By', value: givenBy, inline: true },
                            { name: 'Submitted At', value: new Date().toLocaleString(), inline: true },
                            { name: 'Reason for Appeal', value: reason, inline: false },
                            { name: 'Evidence', value: evidence, inline: false }
                        )
                        .setFooter({ text: 'Kavià Café — Appeals System' })
                        .setTimestamp()],
                    components: [row],
                    allowedMentions: { roles: [STAFF_ROLE_ID] }
                });
            }

            await interaction.editReply({
                content: '✅ Your appeal has been submitted and is awaiting review by PR Leadership. You will be notified in your alliance channel once a decision has been made. 💜'
            });
        }

        // ── Deny Modal ──
        if (customId.startsWith('appeal_deny_modal_')) {
            const appealId = customId.replace('appeal_deny_modal_', '');
            const appeal = activeAppeals.get(appealId);
            const reason = interaction.fields.getTextInputValue('deny_reason');

            await interaction.update({
                embeds: [EmbedBuilder.from(interaction.message.embeds[0])
                    .setTitle('📋 Alliance Appeal — ❌ Denied')
                    .setColor('Red')
                    .addFields(
                        { name: 'Reviewed By', value: interaction.user.tag, inline: true },
                        { name: 'Denial Reason', value: reason, inline: false }
                    )],
                components: []
            });

            if (appeal?.channelId) {
                const allianceChannel = await client.channels.fetch(appeal.channelId).catch(() => null);
                if (allianceChannel) {
                    await allianceChannel.send({
                        content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                        embeds: [new EmbedBuilder()
                            .setTitle('❌ Appeal Denied')
                            .setDescription(
                                `The appeal for **${appeal?.allianceName || 'your alliance'}** has been **denied** by PR Leadership.\n\n` +
                                `**Reason:** ${reason}\n\n` +
                                `If you have further questions, please reach out to PR Leadership directly. 💜`
                            )
                            .setColor('Red')
                            .addFields(
                                { name: 'Appeal Type', value: appeal?.appealType || 'N/A', inline: true },
                                { name: 'Denied By', value: interaction.user.tag, inline: true }
                            )
                            .setFooter({ text: 'Kavià Café — Public Relations Department' })
                            .setTimestamp()],
                        allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                    });
                }
            }

            activeAppeals.delete(appealId);
        }

        // ── More Info Modal ──
        if (customId.startsWith('appeal_moreinfo_modal_')) {
            const appealId = customId.replace('appeal_moreinfo_modal_', '');
            const appeal = activeAppeals.get(appealId);
            const infoMessage = interaction.fields.getTextInputValue('moreinfo_message');

            await interaction.update({
                embeds: [EmbedBuilder.from(interaction.message.embeds[0])
                    .setTitle('📋 Alliance Appeal — 📋 More Info Requested')
                    .setColor('Yellow')
                    .addFields(
                        { name: 'Requested By', value: interaction.user.tag, inline: true },
                        { name: 'Information Needed', value: infoMessage, inline: false }
                    )],
                components: []
            });

            if (appeal?.channelId) {
                const allianceChannel = await client.channels.fetch(appeal.channelId).catch(() => null);
                if (allianceChannel) {
                    const resubmitRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`appeal_resubmit_${appealId}`)
                            .setLabel('📋 Resubmit Appeal')
                            .setStyle(ButtonStyle.Primary)
                    );

                    await allianceChannel.send({
                        content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                        embeds: [new EmbedBuilder()
                            .setTitle('📋 More Information Needed for Your Appeal')
                            .setDescription(
                                `PR Leadership has reviewed the appeal for **${appeal?.allianceName || 'your alliance'}** and requires additional information before a decision can be made.\n\n` +
                                `**What is needed:**\n${infoMessage}\n\n` +
                                `Please click the button below to resubmit your appeal with the requested information. 💜`
                            )
                            .setColor('Yellow')
                            .addFields(
                                { name: 'Requested By', value: interaction.user.tag, inline: true }
                            )
                            .setFooter({ text: 'Kavià Café — Public Relations Department' })
                            .setTimestamp()],
                        components: [resubmitRow],
                        allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                    });
                }
            }
        }

        // ── Resubmit Modal ──
        if (customId.startsWith('appeal_resubmit_modal_')) {
            const appealId = customId.replace('appeal_resubmit_modal_', '');
            const appeal = activeAppeals.get(appealId);
            if (!appeal) {
                return interaction.reply({ content: '❌ This appeal is no longer active.', ephemeral: true });
            }

            const updatedReason = interaction.fields.getTextInputValue('appeal_reason');
            const updatedEvidence = interaction.fields.getTextInputValue('appeal_evidence');

            appeal.reason = updatedReason;
            appeal.evidence = updatedEvidence;

            await interaction.deferReply({ ephemeral: true });

            const appealLogChannel = await client.channels.fetch(APPEAL_LOG_CHANNEL_ID).catch(() => null);
            if (appealLogChannel) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`appeal_approve_${appealId}`)
                        .setLabel('✅ Approve')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`appeal_deny_${appealId}`)
                        .setLabel('❌ Deny')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`appeal_moreinfo_${appealId}`)
                        .setLabel('📋 Ask for More Info')
                        .setStyle(ButtonStyle.Secondary)
                );

                await appealLogChannel.send({
                    content: `<@&${STAFF_ROLE_ID}> 🔄 **Resubmitted Appeal**`,
                    embeds: [new EmbedBuilder()
                        .setTitle('📋 Alliance Appeal — Resubmitted')
                        .setColor(0x9B59B6)
                        .addFields(
                            { name: 'Submitted By', value: `<@${appeal.userId}> (${interaction.user.tag})`, inline: true },
                            { name: 'Alliance Name', value: appeal.allianceName, inline: true },
                            { name: 'Appealing', value: appeal.appealType, inline: true },
                            { name: 'Discipline Given By', value: appeal.givenBy, inline: true },
                            { name: 'Resubmitted At', value: new Date().toLocaleString(), inline: true },
                            { name: 'Updated Reason', value: updatedReason, inline: false },
                            { name: 'Updated Evidence', value: updatedEvidence, inline: false }
                        )
                        .setFooter({ text: 'Kavià Café — Appeals System (Resubmission)' })
                        .setTimestamp()],
                    components: [row],
                    allowedMentions: { roles: [STAFF_ROLE_ID] }
                });
            }

            await interaction.editReply({ content: '✅ Your appeal has been resubmitted! PR Leadership will review it shortly. 💜' });
        }
    }
};