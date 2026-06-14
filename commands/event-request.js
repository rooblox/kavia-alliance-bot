const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { loadAlliances, findAlliance } = require('../utils/allianceStorage');

const LOG_CHANNEL_ID = '1514798629037281390';
const ALLIED_REPS_ROLE_ID = '1417866883750957188';
const STAFF_ROLE_ID = '1485100238715883720';
const KAVIA_DISCORD = 'https://discord.gg/rMtv4smu36';
const KAVIA_ROBLOX = 'https://www.roblox.com/communities/13827902/Kavi-Cafe#!/about';

const activeEventRequests = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('event-request')
        .setDescription('Send an event request to an alliance')
        .addStringOption(option =>
            option.setName('alliance')
                .setDescription('Select the alliance')
                .setRequired(true)
                .setAutocomplete(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const alliances = await loadAlliances().catch(() => []);
        const filtered = alliances
            .filter(a => a.groupName.toLowerCase().includes(focusedValue))
            .slice(0, 25)
            .map(a => ({ name: a.groupName, value: a.groupName }));
        await interaction.respond(filtered);
    },

    async execute(interaction, client) {
        const allianceName = interaction.options.getString('alliance');
        const alliance = await findAlliance(allianceName);
        if (!alliance) return interaction.reply({ content: `❌ Alliance **${allianceName}** not found.`, ephemeral: true });
        if (!alliance.welcomeChannelId) return interaction.reply({ content: `❌ Alliance **${allianceName}** has no channel set.`, ephemeral: true });

        const modal = new ModalBuilder()
            .setCustomId(`event_request_modal_${allianceName.replace(/\s+/g, '_')}`)
            .setTitle('Event Request Form');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('event_type')
                    .setLabel('Event Type')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Game Night / Alliance Visit / Community Event / Other')
                    .setRequired(true)
                    .setMaxLength(100)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('event_date')
                    .setLabel('Date (DD/MM/YYYY)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g. 25/12/2026')
                    .setRequired(true)
                    .setMaxLength(20)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('event_time')
                    .setLabel('Time & Timezone')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g. 5:00 PM EST')
                    .setRequired(true)
                    .setMaxLength(50)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('event_details')
                    .setLabel('Event Details')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Brief explanation of the event, activities planned, what to expect...')
                    .setRequired(true)
                    .setMaxLength(1000)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('event_signed')
                    .setLabel('Signed (your name/rank)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g. Connor | PR Leadership')
                    .setRequired(true)
                    .setMaxLength(100)
            )
        );

        await interaction.showModal(modal);
    },

    async handleModal(interaction, client) {
        const customId = interaction.customId;

        // ── Event Request Submission ──
        if (customId.startsWith('event_request_modal_')) {
            const allianceName = customId
                .replace('event_request_modal_', '')
                .replace(/_/g, ' ');

            const eventType = interaction.fields.getTextInputValue('event_type');
            const eventDate = interaction.fields.getTextInputValue('event_date');
            const eventTime = interaction.fields.getTextInputValue('event_time');
            const eventDetails = interaction.fields.getTextInputValue('event_details');
            const eventSigned = interaction.fields.getTextInputValue('event_signed');

            await interaction.deferReply({ ephemeral: true });

            const alliance = await findAlliance(allianceName);
            if (!alliance) return await interaction.editReply(`❌ Alliance **${allianceName}** not found.`);
            if (!alliance.welcomeChannelId) return await interaction.editReply(`❌ Alliance **${allianceName}** has no channel set.`);

            const allianceChannel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
            if (!allianceChannel) return await interaction.editReply('❌ Could not find the alliance channel.');

            const eventId = `${interaction.user.id}_${Date.now()}`;

            activeEventRequests.set(eventId, {
                eventId,
                allianceName,
                eventType,
                eventDate,
                eventTime,
                eventDetails,
                eventSigned,
                channelId: alliance.welcomeChannelId,
                staffId: interaction.user.id
            });

            // Parse date for reminders (DD/MM/YYYY)
            let eventDateObj = null;
            try {
                const [day, month, year] = eventDate.split('/').map(Number);
                eventDateObj = new Date(year, month - 1, day);
            } catch (err) {
                console.error('Failed to parse event date:', err);
            }

            const responseRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`event_attend_${eventId}`)
                    .setLabel('✅ We Can Attend!')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`event_decline_${eventId}`)
                    .setLabel('❌ We Can\'t Attend')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`event_reschedule_${eventId}`)
                    .setLabel('📅 Request Different Date')
                    .setStyle(ButtonStyle.Secondary)
            );

            await allianceChannel.send({
                content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                embeds: [new EmbedBuilder()
                    .setTitle(`🎉 Kavià Café x ${allianceName} — Event Request`)
                    .setDescription(
                        `Hello! 👋\n\n` +
                        `**Kavià Café** would love to invite **${allianceName}** to participate in an upcoming event with us! We hope you'll join us for what promises to be a fantastic time together. 💜\n\n` +
                        `**━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━**\n\n` +
                        `🎮 **Event Type**\n${eventType}\n\n` +
                        `📅 **Date**\n${eventDate}\n\n` +
                        `⏰ **Time**\n${eventTime}\n\n` +
                        `📍 **Location**\nKavià Café\n\n` +
                        `📋 **Event Details**\n${eventDetails}\n\n` +
                        `**━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━**\n\n` +
                        `Please use the buttons below to let us know if you are able to attend, can't make it, or would like to request a different date! 💜\n\n` +
                        `🔗 **Kavià Café Links**\n` +
                        `• [Discord Server](${KAVIA_DISCORD})\n` +
                        `• [Roblox Group](${KAVIA_ROBLOX})\n\n` +
                        `**Signed,**\n**${eventSigned}**\n**Kavià Café | Public Relations**`
                    )
                    .setColor(0x9B59B6)
                    .setFooter({ text: 'Kavià Café — Public Relations Department' })
                    .setTimestamp()],
                components: [responseRow],
                allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
            });

            // Log
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                await logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('📋 Event Request Sent')
                        .setColor(0x9B59B6)
                        .addFields(
                            { name: 'Alliance', value: allianceName, inline: true },
                            { name: 'Sent By', value: interaction.user.tag, inline: true },
                            { name: 'Event Type', value: eventType, inline: true },
                            { name: 'Date', value: eventDate, inline: true },
                            { name: 'Time', value: eventTime, inline: true },
                            { name: 'Channel', value: `<#${alliance.welcomeChannelId}>`, inline: true },
                            { name: 'Details', value: eventDetails, inline: false }
                        )
                        .setTimestamp()]
                });
            }

            // Schedule reminders
            if (eventDateObj) {
                const oneDayBefore = new Date(eventDateObj.getTime() - 24 * 60 * 60 * 1000);
                const twoBefore = new Date(eventDateObj.getTime() - 2 * 60 * 60 * 1000);
                const now = new Date();

                if (oneDayBefore > now) {
                    setTimeout(async () => {
                        try {
                            await allianceChannel.send({
                                content: `<@&${ALLIED_REPS_ROLE_ID}> <@&${STAFF_ROLE_ID}>`,
                                embeds: [new EmbedBuilder()
                                    .setTitle('📅 Event Reminder — Tomorrow!')
                                    .setDescription(
                                        `Hey! 👋 Just a reminder that the **Kavià Café x ${allianceName}** event is happening **tomorrow**!\n\n` +
                                        `🎮 **Event Type:** ${eventType}\n` +
                                        `📅 **Date:** ${eventDate}\n` +
                                        `⏰ **Time:** ${eventTime}\n` +
                                        `📍 **Location:** Kavià Café\n\n` +
                                        `Please confirm in this channel whether you are still able to attend. 💜`
                                    )
                                    .setColor(0x9B59B6)
                                    .setFooter({ text: 'Kavià Café — Event Reminder' })
                                    .setTimestamp()],
                                allowedMentions: { roles: [ALLIED_REPS_ROLE_ID, STAFF_ROLE_ID] }
                            });
                        } catch (err) {
                            console.error('Failed to send 1 day event reminder:', err);
                        }
                    }, oneDayBefore.getTime() - now.getTime());
                }

                if (twoBefore > now) {
                    setTimeout(async () => {
                        try {
                            await allianceChannel.send({
                                content: `<@&${ALLIED_REPS_ROLE_ID}> <@&${STAFF_ROLE_ID}>`,
                                embeds: [new EmbedBuilder()
                                    .setTitle('⏰ Event Reminder — 2 Hours Away!')
                                    .setDescription(
                                        `Hey! 👋 The **Kavià Café x ${allianceName}** event is starting in **2 hours**!\n\n` +
                                        `🎮 **Event Type:** ${eventType}\n` +
                                        `📅 **Date:** ${eventDate}\n` +
                                        `⏰ **Time:** ${eventTime}\n` +
                                        `📍 **Location:** Kavià Café\n\n` +
                                        `Please confirm in this channel if you are still able to make it! 💜`
                                    )
                                    .setColor('Orange')
                                    .setFooter({ text: 'Kavià Café — Event Reminder' })
                                    .setTimestamp()],
                                allowedMentions: { roles: [ALLIED_REPS_ROLE_ID, STAFF_ROLE_ID] }
                            });
                        } catch (err) {
                            console.error('Failed to send 2 hour event reminder:', err);
                        }
                    }, twoBefore.getTime() - now.getTime());
                }
            }

            await interaction.editReply(`✅ Event request sent to **${allianceName}**! Reminders scheduled for 1 day and 2 hours before the event.`);
        }

        // ── Reschedule Modal ──
        if (customId.startsWith('event_reschedule_modal_')) {
            const eventId = customId.replace('event_reschedule_modal_', '');
            const eventRequest = activeEventRequests.get(eventId);

            const newDate = interaction.fields.getTextInputValue('new_date');
            const newTime = interaction.fields.getTextInputValue('new_time');
            const rescheduleReason = interaction.fields.getTextInputValue('reschedule_reason');

            await interaction.deferReply({ ephemeral: true });

            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                await logChannel.send({
                    content: `<@&${STAFF_ROLE_ID}>`,
                    embeds: [new EmbedBuilder()
                        .setTitle('📅 Event Reschedule Request')
                        .setColor('Yellow')
                        .addFields(
                            { name: 'Alliance', value: eventRequest?.allianceName || 'Unknown', inline: true },
                            { name: 'Requested By', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Original Date', value: eventRequest?.eventDate || 'Unknown', inline: true },
                            { name: 'Original Time', value: eventRequest?.eventTime || 'Unknown', inline: true },
                            { name: 'Requested New Date', value: newDate, inline: true },
                            { name: 'Requested New Time', value: newTime, inline: true },
                            { name: 'Reason', value: rescheduleReason, inline: false },
                            { name: 'Event Type', value: eventRequest?.eventType || 'Unknown', inline: true },
                            { name: 'Channel', value: eventRequest?.channelId ? `<#${eventRequest.channelId}>` : 'Unknown', inline: true }
                        )
                        .setFooter({ text: 'Kavià Café — Event Reschedule Request' })
                        .setTimestamp()],
                    allowedMentions: { roles: [STAFF_ROLE_ID] }
                });
            }

            await interaction.editReply('✅ Your reschedule request has been sent to PR Leadership! They will be in touch shortly. 💜');
        }
    },

    async handleButton(interaction, client) {
        const customId = interaction.customId;

        // ── Attend ──
        if (customId.startsWith('event_attend_')) {
            const eventId = customId.replace('event_attend_', '');
            const eventRequest = activeEventRequests.get(eventId);

            await interaction.update({
                embeds: [EmbedBuilder.from(interaction.message.embeds[0])
                    .setTitle(`🎉 Kavià Café x ${eventRequest?.allianceName || 'Alliance'} — Event Request`)
                    .setColor('Green')
                    .setFooter({ text: `✅ Confirmed attendance by ${interaction.user.tag}` })],
                components: []
            });

            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                await logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('✅ Event Attendance Confirmed')
                        .setColor('Green')
                        .addFields(
                            { name: 'Alliance', value: eventRequest?.allianceName || 'Unknown', inline: true },
                            { name: 'Confirmed By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                            { name: 'Event Type', value: eventRequest?.eventType || 'Unknown', inline: true },
                            { name: 'Date', value: eventRequest?.eventDate || 'Unknown', inline: true },
                            { name: 'Time', value: eventRequest?.eventTime || 'Unknown', inline: true }
                        )
                        .setTimestamp()]
                });
            }
        }

        // ── Decline ──
        if (customId.startsWith('event_decline_')) {
            const eventId = customId.replace('event_decline_', '');
            const eventRequest = activeEventRequests.get(eventId);

            await interaction.update({
                embeds: [EmbedBuilder.from(interaction.message.embeds[0])
                    .setTitle(`🎉 Kavià Café x ${eventRequest?.allianceName || 'Alliance'} — Event Request`)
                    .setColor('Red')
                    .setFooter({ text: `❌ Declined by ${interaction.user.tag}` })],
                components: []
            });

            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                await logChannel.send({
                    content: `<@&${STAFF_ROLE_ID}>`,
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Event Attendance Declined')
                        .setColor('Red')
                        .addFields(
                            { name: 'Alliance', value: eventRequest?.allianceName || 'Unknown', inline: true },
                            { name: 'Declined By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                            { name: 'Event Type', value: eventRequest?.eventType || 'Unknown', inline: true },
                            { name: 'Date', value: eventRequest?.eventDate || 'Unknown', inline: true },
                            { name: 'Time', value: eventRequest?.eventTime || 'Unknown', inline: true }
                        )
                        .setTimestamp()],
                    allowedMentions: { roles: [STAFF_ROLE_ID] }
                });
            }
        }

        // ── Reschedule ──
        if (customId.startsWith('event_reschedule_')) {
            const eventId = customId.replace('event_reschedule_', '');

            const modal = new ModalBuilder()
                .setCustomId(`event_reschedule_modal_${eventId}`)
                .setTitle('Request Different Date');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('new_date')
                        .setLabel('Preferred Date (DD/MM/YYYY)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. 01/01/2027')
                        .setRequired(true)
                        .setMaxLength(20)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('new_time')
                        .setLabel('Preferred Time & Timezone')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. 6:00 PM EST')
                        .setRequired(true)
                        .setMaxLength(50)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('reschedule_reason')
                        .setLabel('Reason for reschedule request')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Let us know why the current date/time does not work...')
                        .setRequired(true)
                        .setMaxLength(500)
                )
            );

            await interaction.showModal(modal);
        }
    },

    activeEventRequests
};