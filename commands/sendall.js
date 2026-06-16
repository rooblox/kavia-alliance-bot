const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

const ALLIED_REPS_ROLE_ID = '1417866883750957188';
const LOG_CHANNEL_ID = '1482430133561196625';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sendall')
        .setDescription('Send a message or poll to all alliance channels — no response tracking')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Send a message or a poll')
                .setRequired(true)
                .addChoices(
                    { name: '📢 Message', value: 'message' },
                    { name: '📊 Poll', value: 'poll' }
                )),

    async execute(interaction, client) {
        const type = interaction.options.getString('type');

        if (type === 'message') {
            const modal = new ModalBuilder()
                .setCustomId(`sendall_message_modal_${interaction.user.id}`)
                .setTitle('Send Message to All Alliances');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('sendall_title')
                        .setLabel('Title')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. Upcoming Event Announcement')
                        .setRequired(true)
                        .setMaxLength(256)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('sendall_message')
                        .setLabel('Message')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Type your message here...')
                        .setRequired(true)
                        .setMaxLength(4000)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('sendall_footer')
                        .setLabel('Footer / Signature (optional)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. Signed, Connor | PR Leadership')
                        .setRequired(false)
                        .setMaxLength(256)
                )
            );

            await interaction.showModal(modal);

        } else if (type === 'poll') {
            const modal = new ModalBuilder()
                .setCustomId(`sendall_poll_modal_${interaction.user.id}`)
                .setTitle('Send Poll to All Alliances');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('poll_question')
                        .setLabel('Poll Question')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. What day works best for an event?')
                        .setRequired(true)
                        .setMaxLength(256)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('poll_option_1')
                        .setLabel('Option 1')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. Friday')
                        .setRequired(true)
                        .setMaxLength(80)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('poll_option_2')
                        .setLabel('Option 2')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. Saturday')
                        .setRequired(true)
                        .setMaxLength(80)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('poll_option_3')
                        .setLabel('Option 3 (optional — leave blank to skip)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. Sunday')
                        .setRequired(false)
                        .setMaxLength(80)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('poll_option_4')
                        .setLabel('Option 4 (optional — leave blank to skip)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. No preference')
                        .setRequired(false)
                        .setMaxLength(80)
                )
            );

            await interaction.showModal(modal);
        }
    },

    async handleModal(interaction, client) {
        const customId = interaction.customId;

        // ── Message Modal ──
        if (customId.startsWith('sendall_message_modal_')) {
            const title = interaction.fields.getTextInputValue('sendall_title');
            const message = interaction.fields.getTextInputValue('sendall_message');
            const footer = interaction.fields.getTextInputValue('sendall_footer') || null;

            await interaction.deferReply({ ephemeral: true });

            const alliances = await loadAlliances();
            let sent = 0;
            let failed = 0;
            const failedAlliances = [];

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(
                    `${message}\n\n` +
                    `${footer ? `**${footer}**` : ''}`
                )
                .setColor(0x9B59B6)
                .setFooter({ text: 'Kavià Café — Public Relations Department' })
                .setTimestamp();

            for (const alliance of alliances) {
                if (!alliance.welcomeChannelId) { failed++; failedAlliances.push(`${alliance.groupName} (no channel)`); continue; }
                const channel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
                if (!channel) { failed++; failedAlliances.push(`${alliance.groupName} (channel not found)`); continue; }

                try {
                    await channel.send({
                        content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                        embeds: [embed],
                        allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                    });
                    sent++;
                } catch (err) {
                    console.error(`Failed to send to ${alliance.groupName}:`, err);
                    failed++;
                    failedAlliances.push(`${alliance.groupName} (send failed)`);
                }
            }

            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                await logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('📢 Send All — Message Sent')
                        .setColor(0x9B59B6)
                        .addFields(
                            { name: 'Sent By', value: interaction.user.tag, inline: true },
                            { name: 'Sent To', value: `${sent} alliance(s)`, inline: true },
                            { name: 'Failed', value: failed > 0 ? `${failed}\n${failedAlliances.join('\n')}` : 'None', inline: false },
                            { name: 'Title', value: title, inline: false },
                            { name: 'Message Preview', value: message.slice(0, 1024), inline: false }
                        )
                        .setTimestamp()]
                });
            }

            await interaction.editReply(`✅ Message sent to **${sent}** alliance(s)${failed > 0 ? `\n⚠️ Failed for: ${failedAlliances.join(', ')}` : ''}`);
        }

        // ── Poll Modal ──
        if (customId.startsWith('sendall_poll_modal_')) {
            const question = interaction.fields.getTextInputValue('poll_question');
            const option1 = interaction.fields.getTextInputValue('poll_option_1');
            const option2 = interaction.fields.getTextInputValue('poll_option_2');
            const option3 = interaction.fields.getTextInputValue('poll_option_3') || null;
            const option4 = interaction.fields.getTextInputValue('poll_option_4') || null;

            await interaction.deferReply({ ephemeral: true });

            const pollId = `${interaction.user.id}_${Date.now()}`;
            const options = [option1, option2, option3, option4].filter(Boolean);
            const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

            const description = options.map((opt, i) => `${emojis[i]} **${opt}**`).join('\n\n');

            const pollEmbed = new EmbedBuilder()
                .setTitle(`📊 ${question}`)
                .setDescription(
                    `${description}\n\n` +
                    `*Click a button below to cast your vote!*`
                )
                .setColor(0x9B59B6)
                .setFooter({ text: 'Kavià Café — Alliance Poll' })
                .setTimestamp();

            const buttons = options.map((opt, i) =>
                new ButtonBuilder()
                    .setCustomId(`sendall_poll_vote_${pollId}_${i}`)
                    .setLabel(`${emojis[i]} ${opt}`)
                    .setStyle(ButtonStyle.Secondary)
            );

            const row = new ActionRowBuilder().addComponents(...buttons);

            const alliances = await loadAlliances();
            let sent = 0;
            let failed = 0;
            const failedAlliances = [];

            for (const alliance of alliances) {
                if (!alliance.welcomeChannelId) { failed++; failedAlliances.push(`${alliance.groupName} (no channel)`); continue; }
                const channel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
                if (!channel) { failed++; failedAlliances.push(`${alliance.groupName} (channel not found)`); continue; }

                try {
                    await channel.send({
                        content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                        embeds: [pollEmbed],
                        components: [row],
                        allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                    });
                    sent++;
                } catch (err) {
                    console.error(`Failed to send poll to ${alliance.groupName}:`, err);
                    failed++;
                    failedAlliances.push(`${alliance.groupName} (send failed)`);
                }
            }

            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                await logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('📊 Send All — Poll Sent')
                        .setColor(0x9B59B6)
                        .addFields(
                            { name: 'Sent By', value: interaction.user.tag, inline: true },
                            { name: 'Sent To', value: `${sent} alliance(s)`, inline: true },
                            { name: 'Failed', value: failed > 0 ? `${failed}\n${failedAlliances.join('\n')}` : 'None', inline: false },
                            { name: 'Question', value: question, inline: false },
                            { name: 'Options', value: options.map((o, i) => `${emojis[i]} ${o}`).join('\n'), inline: false }
                        )
                        .setTimestamp()]
                });
            }

            await interaction.editReply(`✅ Poll sent to **${sent}** alliance(s)${failed > 0 ? `\n⚠️ Failed for: ${failedAlliances.join(', ')}` : ''}`);
        }
    },

    async handleButton(interaction, client) {
        if (!interaction.customId.startsWith('sendall_poll_vote_')) return;

        const parts = interaction.customId.replace('sendall_poll_vote_', '').split('_');
        const optionIndex = parseInt(parts[parts.length - 1]);
        const embed = interaction.message.embeds[0];
        const options = embed.description
            .split('\n\n')
            .filter(l => l.match(/^[1-4]️⃣/))
            .map(l => l.replace(/^[1-4]️⃣ \*\*/, '').replace(/\*\*$/, ''));

        const selectedOption = options[optionIndex] || 'Unknown';

        await interaction.reply({
            content: `✅ Your vote for **${selectedOption}** has been recorded! Thank you for participating. 💜`,
            ephemeral: true
        });

        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            await logChannel.send({
                embeds: [new EmbedBuilder()
                    .setTitle('📊 Poll Vote Received')
                    .setColor(0x9B59B6)
                    .addFields(
                        { name: 'Voted By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                        { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
                        { name: 'Selected Option', value: selectedOption, inline: false },
                        { name: 'Poll Question', value: embed.title?.replace('📊 ', '') || 'Unknown', inline: false }
                    )
                    .setTimestamp()]
            });
        }
    }
};