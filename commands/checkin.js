const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

const LOG_CHANNEL_ID = '1482430133561196625';
const CHECKIN_LOG_CHANNEL_ID = '1482430133561196625';
const ALLIED_REPS_ROLE_ID = '1417866883750957188';

const activeCheckins = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkin')
        .setDescription('Send the alliance check-in message to all alliance channels'),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const alliances = await loadAlliances();
            if (!alliances.length) return await interaction.editReply('❌ No alliances found.');

            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            const checkinLogChannel = await client.channels.fetch(CHECKIN_LOG_CHANNEL_ID).catch(() => null);

            let sent = 0;
            let failed = 0;
            const failedAlliances = [];

            // Build initial tracking embed
            const buildTrackingEmbed = (alliances, checkins) => {
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
                        const checkin = checkins.get(a.welcomeChannelId);
                        if (!checkin) {
                            lines.push(`⚠️ **${a.groupName}** — Failed to send`);
                        } else if (checkin.responded) {
                            lines.push(`✅ **${a.groupName}** — Responded`);
                        } else if (checkin.noResponse) {
                            lines.push(`❌ **${a.groupName}** — No response (48hrs)`);
                        } else {
                            lines.push(`⏳ **${a.groupName}** — Awaiting response`);
                        }
                    });
                });

                return new EmbedBuilder()
                    .setTitle('📋 Alliance Check-In Tracker')
                    .setDescription(lines.join('\n'))
                    .setColor(0x9B59B6)
                    .setFooter({ text: `Started by ${interaction.user.tag} • Updates automatically` })
                    .setTimestamp();
            };

            // Send initial tracking embed
            let trackingMessage = null;
            if (checkinLogChannel) {
                trackingMessage = await checkinLogChannel.send({
                    embeds: [buildTrackingEmbed(alliances, activeCheckins)]
                });
            }

            // Send checkin to each alliance
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
                    const checkinMessage = await channel.send({
                        content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                        embeds: [new EmbedBuilder()
                            .setTitle('📋 Alliance Check-In')
                            .setDescription(
                                `Hello, <@&${ALLIED_REPS_ROLE_ID}>\n\n` +
                                `It is time for our alliance check-in. This will take place once every 2 weeks. Your response is **mandatory**, and you will receive a strike if you do not answer our questions within **48 hours** unless you have a valid reason for the delay.\n\n` +
                                `Please respond honestly. This will help us see areas where we can improve.\n\n` +
                                `**1.** Please rate our communication on a scale of 1-10.\n` +
                                `**2.** How would you rate our activity on a scale of 1-10?\n` +
                                `**3.** Do you think Kavià can make any improvements in our alliance program? If yes, please let us know what we can improve.\n` +
                                `**4.** Do you feel that Kavià is maintaining a good reputation?\n` +
                                `**5.** Does your group have 2 reps provided from our staff team at Kavià? If not, please ping PR leadership and we will assist you.`
                            )
                            .setColor(0x9B59B6)
                            .setFooter({ text: 'Respond to these 5 questions in your channel • You have 48 hours to do so.' })
                            .setTimestamp()],
                        allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                    });

                    activeCheckins.set(alliance.welcomeChannelId, {
                        groupName: alliance.groupName,
                        responded: false,
                        noResponse: false,
                        messageId: checkinMessage.id,
                        startedAt: Date.now(),
                        trackingMessageId: trackingMessage?.id,
                        alliances
                    });

                    sent++;

                    // Update tracking embed after each send
                    if (trackingMessage) {
                        await trackingMessage.edit({
                            embeds: [buildTrackingEmbed(alliances, activeCheckins)]
                        }).catch(() => {});
                    }

                    // 48 hour timeout
                    setTimeout(async () => {
                        const checkin = activeCheckins.get(alliance.welcomeChannelId);
                        if (!checkin || checkin.responded) return;

                        checkin.noResponse = true;

                        // Update tracking embed
                        if (trackingMessage) {
                            await trackingMessage.edit({
                                embeds: [buildTrackingEmbed(alliances, activeCheckins)]
                            }).catch(() => {});
                        }

                        activeCheckins.delete(alliance.welcomeChannelId);

                        if (logChannel) {
                            const noResponseEmbed = new EmbedBuilder()
                                .setTitle('⚠️ Check-In No Response')
                                .setColor('Red')
                                .addFields(
                                    { name: 'Alliance', value: alliance.groupName, inline: true },
                                    { name: 'Status', value: '❌ No response within 48 hours', inline: true },
                                    { name: 'Channel', value: `<#${alliance.welcomeChannelId}>`, inline: true },
                                    { name: 'Date', value: new Date().toLocaleString(), inline: false }
                                )
                                .setTimestamp();
                            await logChannel.send({ embeds: [noResponseEmbed] });
                        }

                        await channel.send({
                            embeds: [new EmbedBuilder()
                                .setDescription(`⚠️ <@&${ALLIED_REPS_ROLE_ID}> The 48 hour check-in window has passed with no response. PR Leadership has been notified.`)
                                .setColor('Red')]
                        });

                    }, 48 * 60 * 60 * 1000);

                } catch (err) {
                    console.error(`Failed to send checkin to ${alliance.groupName}:`, err);
                    failed++;
                    failedAlliances.push(`${alliance.groupName} (send failed)`);
                }
            }

            // Final tracking embed update after all sent
            if (trackingMessage) {
                await trackingMessage.edit({
                    embeds: [buildTrackingEmbed(alliances, activeCheckins)]
                }).catch(() => {});
            }

            // Log checkin started
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📋 Alliance Check-In Started')
                    .setColor(0x9B59B6)
                    .addFields(
                        { name: 'Started By', value: interaction.user.tag, inline: true },
                        { name: 'Sent To', value: `${sent} alliance(s)`, inline: true },
                        { name: 'Failed', value: failed > 0 ? `${failed} alliance(s)\n${failedAlliances.join('\n')}` : 'None', inline: false },
                        { name: 'Date', value: new Date().toLocaleString(), inline: false }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }

            await interaction.editReply(`✅ Check-in sent to **${sent}** alliance(s)${failed > 0 ? `\n⚠️ Failed for: ${failedAlliances.join(', ')}` : ''}`);

        } catch (err) {
            console.error('Error executing checkin:', err);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ There was an error executing this command.');
            }
        }
    },

    async handleCheckinReply(message, client) {
        if (message.author.bot) return;
        if (!message.guild) return;

        const checkin = activeCheckins.get(message.channel.id);
        if (!checkin || checkin.responded) return;

        checkin.responded = true;

        await message.react('✅').catch(() => {});

        // Update tracking embed
        if (checkin.trackingMessageId) {
            const checkinLogChannel = await client.channels.fetch(CHECKIN_LOG_CHANNEL_ID).catch(() => null);
            if (checkinLogChannel) {
                const trackingMessage = await checkinLogChannel.messages.fetch(checkin.trackingMessageId).catch(() => null);
                if (trackingMessage) {
                    const buildTrackingEmbed = (alliances, checkins) => {
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
                                const c = checkins.get(a.welcomeChannelId);
                                if (!c) {
                                    lines.push(`✅ **${a.groupName}** — Responded`);
                                } else if (c.responded) {
                                    lines.push(`✅ **${a.groupName}** — Responded`);
                                } else if (c.noResponse) {
                                    lines.push(`❌ **${a.groupName}** — No response (48hrs)`);
                                } else {
                                    lines.push(`⏳ **${a.groupName}** — Awaiting response`);
                                }
                            });
                        });

                        return new EmbedBuilder()
                            .setTitle('📋 Alliance Check-In Tracker')
                            .setDescription(lines.join('\n'))
                            .setColor(0x9B59B6)
                            .setFooter({ text: `Updates automatically` })
                            .setTimestamp();
                    };

                    await trackingMessage.edit({
                        embeds: [buildTrackingEmbed(checkin.alliances, activeCheckins)]
                    }).catch(() => {});
                }
            }
        }

        activeCheckins.delete(message.channel.id);

        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('✅ Check-In Response Received')
                .setColor('Green')
                .addFields(
                    { name: 'Alliance', value: checkin.groupName, inline: true },
                    { name: 'Responded By', value: `${message.author.tag}`, inline: true },
                    { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                    { name: 'Response', value: message.content.slice(0, 1024) || 'No text content', inline: false },
                    { name: 'Date', value: new Date().toLocaleString(), inline: false }
                )
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
        }
    }
};

module.exports.activeCheckins = activeCheckins;