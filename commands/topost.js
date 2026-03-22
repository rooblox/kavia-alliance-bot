const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

const CHECKIN_LOG_CHANNEL_ID = '1482430133561196625';
const ALLIED_REPS_ROLE_ID = '1417866883750957188';

const activeToposts = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('topost')
        .setDescription('Send a message to all alliance channels'),

    async execute(interaction, client) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`topost_compose_${interaction.user.id}`)
                .setLabel('✏️ Compose Message')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setTitle('📢 To Post')
                .setDescription('Click the button below to compose your message. It will be sent to all alliance channels once you confirm.')
                .setColor(0x9B59B6)
                .setTimestamp()],
            components: [row]
        });
    },

    async handleButton(interaction, client) {
        const customId = interaction.customId;

        // ── COMPOSE BUTTON — open modal ──
        if (customId.startsWith('topost_compose_')) {
            const userId = customId.replace('topost_compose_', '');
            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ This is not your session.', ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId(`topost_modal_${userId}`)
                .setTitle('Compose Alliance Message');

            const messageInput = new TextInputBuilder()
                .setCustomId('topost_message')
                .setLabel('Message')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Type your message here. Formatting and spacing will be preserved.')
                .setRequired(true)
                .setMaxLength(2000);

            modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
            await interaction.showModal(modal);
        }

        // ── CONFIRM SEND BUTTON ──
        if (customId.startsWith('topost_send_')) {
            const userId = customId.replace('topost_send_', '');
            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ This is not your session.', ephemeral: true });
            }

            const session = activeToposts.get(userId);
            if (!session) return interaction.reply({ content: '❌ Session expired. Please run /topost again.', ephemeral: true });

            await interaction.update({ components: [] });

            const alliances = await loadAlliances();
            const logChannel = await client.channels.fetch(CHECKIN_LOG_CHANNEL_ID).catch(() => null);

            let sent = 0;
            let failed = 0;
            const failedAlliances = [];

            const buildTrackingEmbed = (alliances, toposts) => {
                const sections = ['Restaurants', 'Cafes', 'Others'];
                const lines = [];

                sections.forEach(section => {
                    const list = alliances.filter(a => a.section === section);
                    if (!list.length) return;

                    lines.push(`\n**— ${section} —**`);
                    list.forEach(a => {
                        if (!a.welcomeChannelId) {
                            lines.push(`⚠️ **${a.groupName}** — No channel set`);
                            return;
                        }
                        const t = toposts.get(`${userId}_${a.welcomeChannelId}`);
                        if (!t) {
                            lines.push(`⚠️ **${a.groupName}** — Failed to send`);
                        } else if (t.responded) {
                            lines.push(`✅ **${a.groupName}** — Posted`);
                        } else if (t.noResponse) {
                            lines.push(`❌ **${a.groupName}** — No response (48hrs)`);
                        } else {
                            lines.push(`⏳ **${a.groupName}** — Awaiting post`);
                        }
                    });
                });

                return new EmbedBuilder()
                    .setTitle('📢 To Post Tracker')
                    .setDescription(lines.join('\n'))
                    .setColor(0x9B59B6)
                    .setFooter({ text: `Started by ${interaction.user.tag} • Updates automatically` })
                    .setTimestamp();
            };

            // Send tracking embed
            let trackingMessage = null;
            if (logChannel) {
                trackingMessage = await logChannel.send({
                    embeds: [buildTrackingEmbed(alliances, activeToposts)]
                });
            }

            for (const alliance of alliances) {
                if (!alliance.welcomeChannelId) {
                    failed++;
                    failedAlliances.push(`${alliance.groupName} (no channel set)`);
                    continue;
                }

                const channel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
                if (!channel) {
                    failed++;
                    failedAlliances.push(`${alliance.groupName} (channel not found)`);
                    continue;
                }

                try {
                    // Send ping + deadline warning first
                    await channel.send({
                        content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                        embeds: [new EmbedBuilder()
                            .setDescription(
                                `📢 **You have a new post to share in your server!**\n\n` +
                                `Please copy the message below and post it in your server within **48 hours**.\n\n` +
                                `Failure to do so without a valid reason may result in a **strike** against your alliance.\n\n` +
                                `If you have any questions or need an extension, please reach out to a member of **PR Leadership** as soon as possible.`
                            )
                            .setColor(0x9B59B6)
                            .setFooter({ text: 'Kavià Café — Public Relations Department' })
                            .setTimestamp()],
                        allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                    });

                    // Send the raw message on its own so its easy to copy
                    await channel.send({
                        content: session.message
                    });

                    const key = `${userId}_${alliance.welcomeChannelId}`;
                    activeToposts.set(key, {
                        groupName: alliance.groupName,
                        channelId: alliance.welcomeChannelId,
                        responded: false,
                        noResponse: false,
                        startedAt: Date.now(),
                        trackingMessageId: trackingMessage?.id,
                        userId,
                        alliances
                    });

                    sent++;

                    if (trackingMessage) {
                        await trackingMessage.edit({
                            embeds: [buildTrackingEmbed(alliances, activeToposts)]
                        }).catch(() => {});
                    }

                    // 24 hour reminder
                    setTimeout(async () => {
                        const key = `${userId}_${alliance.welcomeChannelId}`;
                        const topost = activeToposts.get(key);
                        if (!topost || topost.responded) return;

                        await channel.send({
                            content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                            embeds: [new EmbedBuilder()
                                .setDescription(
                                    `⏰ **Friendly Reminder!**\n\n` +
                                    `You still have a pending post that needs to be shared in your server.\n\n` +
                                    `You have **24 hours** remaining before the deadline. Please make sure to get this posted as soon as possible to avoid any issues with your alliance standing.\n\n` +
                                    `If you need assistance or require an extension, please reach out to **PR Leadership** right away.`
                                )
                                .setColor('Yellow')
                                .setFooter({ text: 'Kavià Café — Public Relations Department' })
                                .setTimestamp()],
                            allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                        });
                    }, 24 * 60 * 60 * 1000);

                    // 48 hour deadline
                    setTimeout(async () => {
                        const key = `${userId}_${alliance.welcomeChannelId}`;
                        const topost = activeToposts.get(key);
                        if (!topost || topost.responded) return;

                        topost.noResponse = true;

                        if (trackingMessage) {
                            await trackingMessage.edit({
                                embeds: [buildTrackingEmbed(alliances, activeToposts)]
                            }).catch(() => {});
                        }

                        activeToposts.delete(key);

                        if (logChannel) {
                            await logChannel.send({
                                embeds: [new EmbedBuilder()
                                    .setTitle('⚠️ To Post — No Confirmation')
                                    .setColor('Red')
                                    .addFields(
                                        { name: 'Alliance', value: alliance.groupName, inline: true },
                                        { name: 'Status', value: '❌ No confirmation within 48 hours', inline: true },
                                        { name: 'Channel', value: `<#${alliance.welcomeChannelId}>`, inline: true },
                                        { name: 'Date', value: new Date().toLocaleString(), inline: false }
                                    )
                                    .setTimestamp()]
                            });
                        }

                        await channel.send({
                            content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                            embeds: [new EmbedBuilder()
                                .setDescription(
                                    `⚠️ **Deadline Passed**\n\n` +
                                    `The 48 hour posting deadline has passed without confirmation. PR Leadership has been notified and this may be reviewed for alliance standing purposes.\n\n` +
                                    `If you believe this is a mistake or have a valid reason for the delay, please reach out to **PR Leadership** immediately.`
                                )
                                .setColor('Red')
                                .setFooter({ text: 'Kavià Café — Public Relations Department' })
                                .setTimestamp()],
                            allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                        });

                    }, 48 * 60 * 60 * 1000);

                } catch (err) {
                    console.error(`Failed to send topost to ${alliance.groupName}:`, err);
                    failed++;
                    failedAlliances.push(`${alliance.groupName} (send failed)`);
                }
            }

            if (trackingMessage) {
                await trackingMessage.edit({
                    embeds: [buildTrackingEmbed(alliances, activeToposts)]
                }).catch(() => {});
            }

            if (logChannel) {
                await logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('📢 To Post Started')
                        .setColor(0x9B59B6)
                        .addFields(
                            { name: 'Started By', value: interaction.user.tag, inline: true },
                            { name: 'Sent To', value: `${sent} alliance(s)`, inline: true },
                            { name: 'Failed', value: failed > 0 ? `${failed} alliance(s)\n${failedAlliances.join('\n')}` : 'None', inline: false },
                            { name: 'Message Preview', value: session.message.slice(0, 1024), inline: false },
                            { name: 'Date', value: new Date().toLocaleString(), inline: false }
                        )
                        .setTimestamp()]
                });
            }

            activeToposts.delete(userId);

            await interaction.followUp({
                content: `✅ Message sent to **${sent}** alliance(s)${failed > 0 ? `\n⚠️ Failed for: ${failedAlliances.join(', ')}` : ''}`,
                ephemeral: true
            });
        }

        // ── CANCEL BUTTON ──
        if (customId.startsWith('topost_cancel_')) {
            const userId = customId.replace('topost_cancel_', '');
            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ This is not your session.', ephemeral: true });
            }

            activeToposts.delete(userId);
            await interaction.update({
                embeds: [new EmbedBuilder()
                    .setDescription('❌ Message cancelled.')
                    .setColor('Red')],
                components: []
            });
        }
    },

    async handleModal(interaction, client) {
        if (!interaction.customId.startsWith('topost_modal_')) return;

        const userId = interaction.customId.replace('topost_modal_', '');
        if (interaction.user.id !== userId) return;

        const message = interaction.fields.getTextInputValue('topost_message');

        activeToposts.set(userId, { message });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`topost_send_${userId}`)
                .setLabel('📢 Send to All Alliances')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`topost_cancel_${userId}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setTitle('📢 Preview — Confirm Send')
                .setDescription(`**Message:**\n\n${message}`)
                .setColor(0x9B59B6)
                .setFooter({ text: 'This will be sent to all alliance channels with the allied reps role pinged.' })
                .setTimestamp()],
            components: [row],
            ephemeral: true
        });
    },

    async handleTopostReply(message, client) {
        if (message.author.bot) return;
        if (!message.guild) return;

        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        if (!member) return;
        if (!member.roles.cache.has(ALLIED_REPS_ROLE_ID)) return;

        let matchedKey = null;
        for (const [key, topost] of activeToposts.entries()) {
            if (topost.channelId === message.channel.id && !topost.responded) {
                matchedKey = key;
                break;
            }
        }

        if (!matchedKey) return;

        const topost = activeToposts.get(matchedKey);
        topost.responded = true;

        await message.react('✅').catch(() => {});

        if (topost.trackingMessageId) {
            const logChannel = await client.channels.fetch(CHECKIN_LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                const trackingMessage = await logChannel.messages.fetch(topost.trackingMessageId).catch(() => null);
                if (trackingMessage) {
                    const sections = ['Restaurants', 'Cafes', 'Others'];
                    const lines = [];

                    sections.forEach(section => {
                        const list = topost.alliances.filter(a => a.section === section);
                        if (!list.length) return;

                        lines.push(`\n**— ${section} —**`);
                        list.forEach(a => {
                            if (!a.welcomeChannelId) {
                                lines.push(`⚠️ **${a.groupName}** — No channel set`);
                                return;
                            }
                            const key = `${topost.userId}_${a.welcomeChannelId}`;
                            const t = activeToposts.get(key);
                            if (!t) {
                                lines.push(`✅ **${a.groupName}** — Posted`);
                            } else if (t.responded) {
                                lines.push(`✅ **${a.groupName}** — Posted`);
                            } else if (t.noResponse) {
                                lines.push(`❌ **${a.groupName}** — No response (48hrs)`);
                            } else {
                                lines.push(`⏳ **${a.groupName}** — Awaiting post`);
                            }
                        });
                    });

                    await trackingMessage.edit({
                        embeds: [new EmbedBuilder()
                            .setTitle('📢 To Post Tracker')
                            .setDescription(lines.join('\n'))
                            .setColor(0x9B59B6)
                            .setFooter({ text: 'Updates automatically' })
                            .setTimestamp()]
                    }).catch(() => {});
                }
            }
        }

        activeToposts.delete(matchedKey);

        const logChannel = await client.channels.fetch(CHECKIN_LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            await logChannel.send({
                embeds: [new EmbedBuilder()
                    .setTitle('✅ To Post — Confirmed')
                    .setColor('Green')
                    .addFields(
                        { name: 'Alliance', value: topost.groupName, inline: true },
                        { name: 'Confirmed By', value: `${message.author.tag}`, inline: true },
                        { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                        { name: 'Date', value: new Date().toLocaleString(), inline: false }
                    )
                    .setTimestamp()]
            });
        }
    }
};

module.exports.activeToposts = activeToposts;