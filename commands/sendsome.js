const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

const ALLIED_REPS_ROLE_ID = '1417866883750957188';
const LOG_CHANNEL_ID = '1482430133561196625';

const activeSendsome = new Map();
const activeSomePolls = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sendsome')
        .setDescription('Send a message or poll to specific alliances or categories')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Send a message or a poll')
                .setRequired(true)
                .addChoices(
                    { name: '📢 Message', value: 'message' },
                    { name: '📊 Poll', value: 'poll' }
                ))
        .addStringOption(option =>
            option.setName('target')
                .setDescription('Send to specific alliances or a whole category')
                .setRequired(true)
                .addChoices(
                    { name: '🎯 Select Specific Alliances', value: 'specific' },
                    { name: '🍽️ All Restaurants', value: 'Restaurants' },
                    { name: '☕ All Cafes', value: 'Cafes' },
                    { name: '🌐 All Others', value: 'Others' }
                )),

    async execute(interaction, client) {
        const type = interaction.options.getString('type');
        const target = interaction.options.getString('target');
        const alliances = await loadAlliances();

        if (target === 'specific') {
            const options = alliances.slice(0, 25).map(a => ({
                label: a.groupName,
                value: a.groupName,
                description: a.section
            }));

            if (options.length === 0) return interaction.reply({ content: '❌ No alliances found.', ephemeral: true });

            const sessionId = `${interaction.user.id}_${Date.now()}`;
            activeSendsome.set(sessionId, { type, selectedAlliances: [], alliances });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`sendsome_select_${sessionId}`)
                .setPlaceholder('Select alliances to send to...')
                .setMinValues(1)
                .setMaxValues(Math.min(options.length, 25))
                .addOptions(options);

            return interaction.reply({
                content: `📋 Select which alliances you want to send this **${type}** to:`,
                components: [new ActionRowBuilder().addComponents(selectMenu)],
                ephemeral: true
            });

        } else {
            const sessionId = `${interaction.user.id}_${Date.now()}`;
            const targetAlliances = alliances.filter(a => a.section === target);
            activeSendsome.set(sessionId, {
                type,
                selectedAlliances: targetAlliances.map(a => a.groupName),
                alliances
            });

            return interaction.reply({
                content: `✅ Sending to all **${target}** (${targetAlliances.length} alliance(s)). Click below to compose your ${type}.`,
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`sendsome_compose_${sessionId}`)
                        .setLabel(`✏️ Compose ${type === 'poll' ? 'Poll' : 'Message'}`)
                        .setStyle(ButtonStyle.Primary)
                )],
                ephemeral: true
            });
        }
    },

    async handleSelectMenu(interaction, client) {
        if (!interaction.customId.startsWith('sendsome_select_')) return;

        const sessionId = interaction.customId.replace('sendsome_select_', '');
        const session = activeSendsome.get(sessionId);
        if (!session) return interaction.update({ content: '❌ Session expired. Please run /sendsome again.', components: [] });

        session.selectedAlliances = interaction.values;

        await interaction.update({
            content: `✅ Selected **${interaction.values.length}** alliance(s). Click below to compose your ${session.type}.`,
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`sendsome_compose_${sessionId}`)
                    .setLabel(`✏️ Compose ${session.type === 'poll' ? 'Poll' : 'Message'}`)
                    .setStyle(ButtonStyle.Primary)
            )]
        });
    },

    async handleButton(interaction, client) {
        const customId = interaction.customId;

        // ── Compose button ──
        if (customId.startsWith('sendsome_compose_')) {
            const sessionId = customId.replace('sendsome_compose_', '');
            const session = activeSendsome.get(sessionId);
            if (!session) return interaction.reply({ content: '❌ Session expired. Please run /sendsome again.', ephemeral: true });

            if (session.type === 'message') {
                const modal = new ModalBuilder()
                    .setCustomId(`sendsome_message_modal_${sessionId}`)
                    .setTitle('Send Message to Selected Alliances');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('sendsome_title')
                            .setLabel('Title')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('e.g. Important Announcement')
                            .setRequired(true)
                            .setMaxLength(256)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('sendsome_message')
                            .setLabel('Message')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Type your message here...')
                            .setRequired(true)
                            .setMaxLength(4000)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('sendsome_footer')
                            .setLabel('Footer / Signature (optional)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('e.g. Signed, Connor | PR Leadership')
                            .setRequired(false)
                            .setMaxLength(256)
                    )
                );

                await interaction.showModal(modal);

            } else if (session.type === 'poll') {
                const modal = new ModalBuilder()
                    .setCustomId(`sendsome_poll_modal_${sessionId}`)
                    .setTitle('Send Poll to Selected Alliances');

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
                            .setCustomId('poll_options')
                            .setLabel('Options (one per line, max 4)')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Friday\nSaturday\nSunday\nNo preference')
                            .setRequired(true)
                            .setMaxLength(400)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('poll_duration')
                            .setLabel('Duration (e.g. 1h, 6h, 24h) or "self" to close manually')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('e.g. 24h or self')
                            .setRequired(true)
                            .setMaxLength(10)
                    )
                );

                await interaction.showModal(modal);
            }
            return;
        }

        // ── Vote button ──
        if (customId.startsWith('sendsome_poll_vote_')) {
            const parts = customId.replace('sendsome_poll_vote_', '').split('_');
            const optionIndex = parseInt(parts[parts.length - 1]);
            const pollId = parts.slice(0, -1).join('_');
            const poll = activeSomePolls.get(pollId);

            if (!poll || poll.closed) {
                return interaction.reply({ content: '❌ This poll has already closed.', ephemeral: true });
            }

            const alreadyVoted = Object.values(poll.votes).some(voters =>
                voters.some(v => v.userId === interaction.user.id)
            );

            if (alreadyVoted) {
                Object.values(poll.votes).forEach(voters => {
                    const idx = voters.findIndex(v => v.userId === interaction.user.id);
                    if (idx !== -1) voters.splice(idx, 1);
                });
            }

            poll.votes[optionIndex].push({
                userId: interaction.user.id,
                userTag: interaction.user.tag
            });

            const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
            const selectedOption = poll.options[optionIndex];

            await interaction.reply({
                content: `✅ Your vote for **${emojis[optionIndex]} ${selectedOption}** has been recorded!${alreadyVoted ? ' (Your previous vote was replaced.)' : ''} 💜`,
                ephemeral: true
            });
        }

        // ── Close poll button ──
        if (customId.startsWith('sendsome_poll_close_')) {
            const pollId = customId.replace('sendsome_poll_close_', '');
            await interaction.deferReply({ ephemeral: true });
            await closeSomePoll(pollId, client, interaction, 'manual');
        }
    },

    async handleModal(interaction, client) {
        const customId = interaction.customId;

        // ── Message Modal ──
        if (customId.startsWith('sendsome_message_modal_')) {
            const sessionId = customId.replace('sendsome_message_modal_', '');
            const session = activeSendsome.get(sessionId);
            if (!session) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });

            const title = interaction.fields.getTextInputValue('sendsome_title');
            const message = interaction.fields.getTextInputValue('sendsome_message');
            const footer = interaction.fields.getTextInputValue('sendsome_footer') || null;

            await interaction.deferReply({ ephemeral: true });

            const alliances = session.alliances.filter(a => session.selectedAlliances.includes(a.groupName));
            let sent = 0;
            let failed = 0;
            const failedAlliances = [];

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(`${message}${footer ? `\n\n**${footer}**` : ''}`)
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
                        .setTitle('📢 Send Some — Message Sent')
                        .setColor(0x9B59B6)
                        .addFields(
                            { name: 'Sent By', value: interaction.user.tag, inline: true },
                            { name: 'Sent To', value: `${sent} alliance(s)`, inline: true },
                            { name: 'Alliances', value: session.selectedAlliances.join(', ').slice(0, 1024), inline: false },
                            { name: 'Failed', value: failed > 0 ? `${failed}\n${failedAlliances.join('\n')}` : 'None', inline: false },
                            { name: 'Title', value: title, inline: false },
                            { name: 'Message Preview', value: message.slice(0, 1024), inline: false }
                        )
                        .setTimestamp()]
                });
            }

            activeSendsome.delete(sessionId);
            await interaction.editReply(`✅ Message sent to **${sent}** alliance(s)${failed > 0 ? `\n⚠️ Failed for: ${failedAlliances.join(', ')}` : ''}`);
        }

        // ── Poll Modal ──
        if (customId.startsWith('sendsome_poll_modal_')) {
            const sessionId = customId.replace('sendsome_poll_modal_', '');
            const session = activeSendsome.get(sessionId);
            if (!session) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });

            const question = interaction.fields.getTextInputValue('poll_question');
            const optionsRaw = interaction.fields.getTextInputValue('poll_options');
            const durationRaw = interaction.fields.getTextInputValue('poll_duration').trim().toLowerCase();

            const options = optionsRaw.split('\n').map(o => o.trim()).filter(Boolean).slice(0, 4);
            if (options.length < 2) return await interaction.editReply('❌ You need at least 2 options.');

            await interaction.deferReply({ ephemeral: true });

            const pollId = `sendsome_${interaction.user.id}_${Date.now()}`;
            const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

            // Parse duration
            let durationMs = null;
            let durationLabel = 'Manual close';
            if (durationRaw !== 'self') {
                const match = durationRaw.match(/^(\d+)(h|m)$/);
                if (match) {
                    const amount = parseInt(match[1]);
                    const unit = match[2];
                    durationMs = unit === 'h' ? amount * 60 * 60 * 1000 : amount * 60 * 1000;
                    durationLabel = `${amount}${unit === 'h' ? ' hour(s)' : ' minute(s)'}`;
                } else {
                    return await interaction.editReply('❌ Invalid duration format. Use `1h`, `6h`, `24h`, or `self`.');
                }
            }

            activeSomePolls.set(pollId, {
                pollId,
                question,
                options,
                votes: {},
                channelMessageIds: [],
                closed: false,
                createdBy: interaction.user.tag,
                createdAt: Date.now(),
                durationMs,
                durationLabel
            });

            options.forEach((_, i) => {
                activeSomePolls.get(pollId).votes[i] = [];
            });

            const description = options.map((opt, i) => `${emojis[i]} **${opt}**`).join('\n\n');

            const pollEmbed = new EmbedBuilder()
                .setTitle(`📊 ${question}`)
                .setDescription(
                    `${description}\n\n` +
                    `*Click a button below to cast your vote!*\n\n` +
                    `⏱️ **Closes:** ${durationMs ? `In ${durationLabel}` : 'When closed by staff'}`
                )
                .setColor(0x9B59B6)
                .setFooter({ text: 'Kavià Café — Alliance Poll' })
                .setTimestamp();

            const buttons = options.map((opt, i) =>
                new ButtonBuilder()
                    .setCustomId(`sendsome_poll_vote_${pollId}_${i}`)
                    .setLabel(`${emojis[i]} ${opt}`)
                    .setStyle(ButtonStyle.Secondary)
            );

            const voteRow = new ActionRowBuilder().addComponents(...buttons);

            const alliances = session.alliances.filter(a => session.selectedAlliances.includes(a.groupName));
            let sent = 0;
            let failed = 0;
            const failedAlliances = [];

            for (const alliance of alliances) {
                if (!alliance.welcomeChannelId) { failed++; failedAlliances.push(`${alliance.groupName} (no channel)`); continue; }
                const channel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
                if (!channel) { failed++; failedAlliances.push(`${alliance.groupName} (channel not found)`); continue; }

                try {
                    const msg = await channel.send({
                        content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                        embeds: [pollEmbed],
                        components: [voteRow],
                        allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                    });
                    activeSomePolls.get(pollId).channelMessageIds.push({ channelId: alliance.welcomeChannelId, messageId: msg.id });
                    sent++;
                } catch (err) {
                    console.error(`Failed to send poll to ${alliance.groupName}:`, err);
                    failed++;
                    failedAlliances.push(`${alliance.groupName} (send failed)`);
                }
            }

            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                const closeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`sendsome_poll_close_${pollId}`)
                        .setLabel('🔒 Close Poll & See Results')
                        .setStyle(ButtonStyle.Danger)
                );

                await logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('📊 Send Some — Poll Sent')
                        .setColor(0x9B59B6)
                        .addFields(
                            { name: 'Sent By', value: interaction.user.tag, inline: true },
                            { name: 'Sent To', value: `${sent} alliance(s)`, inline: true },
                            { name: 'Duration', value: durationLabel, inline: true },
                            { name: 'Alliances', value: session.selectedAlliances.join(', ').slice(0, 1024), inline: false },
                            { name: 'Failed', value: failed > 0 ? `${failed}\n${failedAlliances.join('\n')}` : 'None', inline: false },
                            { name: 'Question', value: question, inline: false },
                            { name: 'Options', value: options.map((o, i) => `${emojis[i]} ${o}`).join('\n'), inline: false }
                        )
                        .setTimestamp()],
                    components: [closeRow]
                });
            }

            if (durationMs) {
                setTimeout(async () => {
                    await closeSomePoll(pollId, client, null, 'auto');
                }, durationMs);
            }

            activeSendsome.delete(sessionId);
            await interaction.editReply(`✅ Poll sent to **${sent}** alliance(s)! Duration: **${durationLabel}**${failed > 0 ? `\n⚠️ Failed for: ${failedAlliances.join(', ')}` : ''}`);
        }
    },

    activeSomePolls
};

async function closeSomePoll(pollId, client, interaction, closeType) {
    const { activeSomePolls } = require('./sendsome');
    const poll = activeSomePolls.get(pollId);
    if (!poll || poll.closed) {
        if (interaction) await interaction.editReply('❌ This poll is already closed or no longer active.');
        return;
    }

    poll.closed = true;

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

    // Disable buttons on all alliance channel messages
    for (const { channelId, messageId } of poll.channelMessageIds) {
        try {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel) continue;
            const msg = await channel.messages.fetch(messageId).catch(() => null);
            if (!msg) continue;

            const disabledButtons = poll.options.map((opt, i) =>
                new ButtonBuilder()
                    .setCustomId(`sendsome_poll_vote_${pollId}_${i}`)
                    .setLabel(`${emojis[i]} ${opt}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

            await msg.edit({
                components: [new ActionRowBuilder().addComponents(...disabledButtons)]
            }).catch(console.error);
        } catch (err) {
            console.error(`Failed to disable poll buttons in channel ${channelId}:`, err);
        }
    }

    // Build results
    const totalVotes = Object.values(poll.votes).reduce((sum, voters) => sum + voters.length, 0);
    const resultsLines = poll.options.map((opt, i) => {
        const voters = poll.votes[i] || [];
        const voterNames = voters.length > 0
            ? voters.map(v => `<@${v.userId}>`).join(', ')
            : '*No votes*';
        return `${emojis[i]} **${opt}** — **${voters.length} vote(s)**\n${voterNames}`;
    }).join('\n\n');

    const logChannel = await client.channels.fetch('1482430133561196625').catch(() => null);
    if (logChannel) {
        await logChannel.send({
            embeds: [new EmbedBuilder()
                .setTitle(`📊 Poll Closed — Results`)
                .setDescription(
                    `**Question:** ${poll.question}\n\n` +
                    `**Total Votes:** ${totalVotes}\n` +
                    `**Closed by:** ${closeType === 'manual' ? 'Staff (manual)' : 'Auto (time expired)'}\n\n` +
                    `**━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━**\n\n` +
                    resultsLines
                )
                .setColor('Green')
                .setFooter({ text: `Poll created by ${poll.createdBy} • Duration: ${poll.durationLabel}` })
                .setTimestamp()]
        });

        try {
            const messages = await logChannel.messages.fetch({ limit: 50 });
            const logMsg = messages.find(m =>
                m.author.id === client.user.id &&
                m.components.length > 0 &&
                m.components[0].components[0]?.customId === `sendsome_poll_close_${pollId}`
            );
            if (logMsg) await logMsg.edit({ components: [] }).catch(console.error);
        } catch (err) {
            console.error('Failed to update log message:', err);
        }
    }

    activeSomePolls.delete(pollId);
    if (interaction) await interaction.editReply('✅ Poll closed! Results have been posted in the log channel.');
}