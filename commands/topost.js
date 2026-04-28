const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

const CHECKIN_LOG_CHANNEL_ID = '1482430133561196625';
const ALLIED_REPS_ROLE_ID = '1417866883750957188';
const STAFF_ROLE_ID = '1485100238715883720';

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

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('topost_title')
                        .setLabel('Title')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. Media Team Applications')
                        .setRequired(true)
                        .setMaxLength(256)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('topost_message')
                        .setLabel('Message')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Type your message here. Markdown formatting will be preserved.')
                        .setRequired(true)
                        .setMaxLength(4000)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('topost_footer')
                        .setLabel('Footer / Signature (optional)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. Signed, Nina | PRD Lead')
                        .setRequired(false)
                        .setMaxLength(256)
                )
            );

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

            const formattedMessage = [
                `**${session.title}**`,
                ``,
                session.message,
                session.footer ? `\n**${session.footer}**` : ''
            ].filter(line => line !== undefined).join('\n');

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
                        if (!t || t.confirmed) {
                            lines.push(t?.confirmed ? `✅ **${a.groupName}** — Confirmed` : `⚠️ **${a.groupName}** — Failed to send`);
                        } else if (t.responded) {
                            lines.push(`🔵 **${a.groupName}** — Awaiting staff review`);
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
                    // Instructions embed
                    await channel.send({
                        content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                        embeds: [new EmbedBuilder()
                            .setDescription(
                                `📢 **You have a new post to share in your server!**\n\n` +
                                `Please copy and post the message below in your server within **48 hours**.\n\n` +
                                `Failure to do so without a valid reason may result in a **strike** against your alliance.\n\n` +
                                `If you have any questions or need an extension, please reach out to a member of **PR Leadership** as soon as possible.`
                            )
                            .setColor(0x9B59B6)
                            .setFooter({ text: 'Kavià Café — Public Relations Department' })
                            .setTimestamp()],
                        allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                    });

                    // Send as plain text so it's copyable
                    await channel.send({ content: formattedMessage });

                    const key = `${userId}_${alliance.welcomeChannelId}`;
                    activeToposts.set(key, {
                        groupName: alliance.groupName,
                        channelId: alliance.welcomeChannelId,
                        responded: false,
                        confirmed: false,
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
                        const t = activeToposts.get(key);
                        if (!t || t.responded || t.confirmed) return;

                        await channel.send({
                            content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                            embeds: [new EmbedBuilder()
                                .setDescription(
                                    `⏰ **Friendly Reminder!**\n\n` +
                                    `You still have a pending post that needs to be shared in your server.\n\n` +
                                    `You have **24 hours** remaining before the deadline. Please make sure to get this posted as soon as possible.\n\n` +
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
                        const t = activeToposts.get(key);
                        if (!t || t.responded || t.confirmed) return;

                        t.noResponse = true;

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
                                    `The 48 hour posting deadline has passed without confirmation. PR Leadership has been notified.\n\n` +
                                    `If you have a valid reason for the delay, please reach out to **PR Leadership** immediately.`
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
                            { name: 'Title', value: session.title, inline: false },
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

        // ── TOPOST CONFIRM BUTTON ──
        if (customId.startsWith('topost_confirm_')) {
            const channelId = customId.replace('topost_confirm_', '');

            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (!member || !member.roles.cache.has(STAFF_ROLE_ID)) {
                return interaction.reply({ content: '❌ Only PR Leadership can confirm posted responses.', ephemeral: true });
            }

            let matchedKey = null;
            for (const [key, topost] of activeToposts.entries()) {
                if (topost.channelId === channelId) {
                    matchedKey = key;
                    break;
                }
            }

            if (!matchedKey) {
                return interaction.reply({ content: '❌ This session is no longer active.', ephemeral: true });
            }

            const topost = activeToposts.get(matchedKey);
            topost.confirmed = true;

            await interaction.update({
                embeds: [EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('Green')
                    .setTitle('📢 To Post Response — ✅ Confirmed')],
                components: []
            });

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
                                if (!t || t.confirmed) {
                                    lines.push(`✅ **${a.groupName}** — Confirmed`);
                                } else if (t.responded) {
                                    lines.push(`🔵 **${a.groupName}** — Awaiting staff review`);
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

        const title = interaction.fields.getTextInputValue('topost_title');
        const message = interaction.fields.getTextInputValue('topost_message');
        const footer = interaction.fields.getTextInputValue('topost_footer') || null;

        activeToposts.set(userId, { title, message, footer });

        const previewText = [
            `**${title}**`,
            ``,
            message,
            footer ? `\n**${footer}**` : ''
        ].filter(line => line !== undefined).join('\n');

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
            content: previewText,
            embeds: [new EmbedBuilder()
                .setTitle('📢 Preview — Confirm Send')
                .setDescription('This is how your message will look in each alliance channel. Confirm to send to all alliances.')
                .setColor(0x9B59B6)],
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
            if (topost.channelId === message.channel.id && !topost.responded && !topost.confirmed) {
                matchedKey = key;
                break;
            }
        }

        if (!matchedKey) return;

        const topost = activeToposts.get(matchedKey);
        topost.responded = true;

        await message.react('👀').catch(() => {});

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`topost_confirm_${message.channel.id}`)
                .setLabel('✅ Confirm Posted')
                .setStyle(ButtonStyle.Success)
        );

        await message.channel.send({
            content: `<@&${STAFF_ROLE_ID}>`,
            embeds: [new EmbedBuilder()
                .setTitle('📢 To Post — Response Received')
                .setColor('Blue')
                .addFields(
                    { name: 'Alliance', value: topost.groupName, inline: true },
                    { name: 'Responded By', value: `${message.author.tag}`, inline: true },
                    { name: 'Message', value: message.content.slice(0, 1024) || 'No text content', inline: false },
                    { name: 'Date', value: new Date().toLocaleString(), inline: false }
                )
                .setFooter({ text: 'Only PR Leadership can confirm this response.' })
                .setTimestamp()],
            components: [row],
            allowedMentions: { roles: [STAFF_ROLE_ID] }
        });

        const logChannel = await client.channels.fetch(CHECKIN_LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            await logChannel.send({
                embeds: [new EmbedBuilder()
                    .setTitle('🔵 To Post — Awaiting Staff Review')
                    .setColor('Blue')
                    .addFields(
                        { name: 'Alliance', value: topost.groupName, inline: true },
                        { name: 'Responded By', value: `${message.author.tag}`, inline: true },
                        { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                        { name: 'Message', value: message.content.slice(0, 1024) || 'No text content', inline: false },
                        { name: 'Date', value: new Date().toLocaleString(), inline: false }
                    )
                    .setTimestamp()]
            });
        }
    }
};

module.exports.activeToposts = activeToposts;