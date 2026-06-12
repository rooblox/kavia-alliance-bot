const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { loadAlliances, findAlliance } = require('../utils/allianceStorage');

const LOG_CHANNEL_ID = '1514798629037281390';
const ALLIED_REPS_ROLE_ID = '1417866883750957188';
const STAFF_ROLE_ID = '1485100238715883720';
const KAVIA_DISCORD = 'https://discord.gg/rMtv4smu36';
const KAVIA_ROBLOX = 'https://www.roblox.com/communities/13827902/Kavi-Cafe#!/about';

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
        if (!interaction.customId.startsWith('event_request_modal_')) return;

        const allianceName = interaction.customId
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

        // Parse date for reminders (DD/MM/YYYY)
        let eventDateObj = null;
        try {
            const [day, month, year] = eventDate.split('/').map(Number);
            eventDateObj = new Date(year, month - 1, day);
        } catch (err) {
            console.error('Failed to parse event date:', err);
        }

        // Send event request to alliance channel
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
                    `Please let us know if you are able to attend by responding in this channel. We look forward to hearing from you! 💜\n\n` +
                    `🔗 **Kavià Café Links**\n` +
                    `• [Discord Server](${KAVIA_DISCORD})\n` +
                    `• [Roblox Group](${KAVIA_ROBLOX})\n\n` +
                    `**Signed,**\n**${eventSigned}**\n**Kavià Café | Public Relations**`
                )
                .setColor(0x9B59B6)
                .setFooter({ text: 'Kavià Café — Public Relations Department' })
                .setTimestamp()],
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

        // Schedule 1 day before reminder
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
};