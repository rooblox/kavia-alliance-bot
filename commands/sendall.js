const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

const ALLIED_REPS_ROLE_ID = '1417866883750957188';
const LOG_CHANNEL_ID = '1482430133561196625';

const activePolls = new Map();

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
            const optionsRaw = interaction.fields.getTextInputValue('poll_options');
            const durationRaw = interaction.fields.getTextInputValue('poll_duration').trim().toLowerCase();

            const options = optionsRaw.split('\n').map(o => o.trim()).filter(Boolean).slice(0, 4);
            if (options.length < 2) return interaction.reply({ content: '❌ You need at least 2 options.', ephemeral: true });

            await interaction.deferReply({ ephemeral: true });

            const pollId = `sendall_${interaction.user.id}_${Date.now()}`;
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

            // Store poll data
            activePolls.set(pollId, {
                pollId,
                question,
                options,
                votes: {}, // { optionIndex: [{ userId, userTag }] }
                channelMessageIds: [], // [{ channelId, messageId }]
                closed: false,
                createdBy: interaction.user.tag,
                createdAt: Date.now(),
                durationMs,
                durationLabel
            });

            options.forEach((_, i) => {
                activePolls.get(pollId).votes[i] = [];
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
                    .setCustomId(`sendall_poll_vote_${pollId}_${i}`)
                    .setLabel(`${emojis[i]} ${opt}`)
                    .setStyle(ButtonStyle.Secondary)
            );

            const voteRow = new ActionRowBuilder().addComponents(...buttons);

            const alliances = await loadAlliances();
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
                    activePolls.get(pollId).channelMessageIds.push({ channelId: alliance.welcomeChannelId, messageId: msg.id });
                    sent++;
                } catch (err) {
                    console.error(`Failed to send poll to ${alliance.groupName}:`, err);
                    failed++;
                    failedAlliances.push(`${alliance.groupName} (send failed)`);
                }
            }

            // Post to log channel with close button
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                const closeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`sendall_poll_close_${pollId}`)
                        .setLabel('🔒 Close Poll & See Results')
                        .setStyle(ButtonStyle.Danger)
                );

                await logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('📊 Send All — Poll Sent')
                        .setColor(0x9B59B6)
                        .addFields(
                            { name: 'Sent By', value: interaction.user.tag, inline: true },
                            { name: 'Sent To', value: `${sent} alliance(s)`, inline: true },
                            { name: 'Duration', value: durationLabel, inline: true },
                            { name: 'Failed', value: failed > 0 ? `${failed}\n${failedAlliances.join('\n')}` : 'None', inline: false },
                            { name: 'Question', value: question, inline: false },
                            { name: 'Options', value: options.map((o, i) => `${emojis[i]} ${o}`).join('\n'), inline: false }
                        )
                        .setTimestamp()],
                    components: [closeRow]
                });
            }

            // Auto-close if duration set
            if (durationMs) {
                setTimeout(async () => {
                    await closePoll(pollId, client, null, 'auto');
                }, durationMs);
            }

            await interaction.editReply(`✅ Poll sent to **${sent}** alliance(s)! Duration: **${durationLabel}**${failed > 0 ? `\n⚠️ Failed for: ${failedAlliances.join(', ')}` : ''}`);
        }
    },

    async handleButton(interaction, client) {
        const customId = interaction.customId;

        // ── Vote button ──
        if (customId.startsWith('sendall_poll_vote_')) {
            const parts = customId.replace('sendall_poll_vote_', '').split('_');
            const optionIndex = parseInt(parts[parts.length - 1]);
            const pollId = parts.slice(0, -1).join('_');
            const poll = activePolls.get(pollId);

            if (!poll || poll.closed) {
                return interaction.reply({ content: '❌ This poll has already closed.', ephemeral: true });
            }

            // Check if already voted
            const alreadyVoted = Object.values(poll.votes).some(voters =>
                voters.some(v => v.userId === interaction.user.id)
            );

            if (alreadyVoted) {
                // Remove old vote
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
        if (customId.startsWith('sendall_poll_close_')) {
            const pollId = customId.replace('sendall_poll_close_', '');
            await interaction.deferReply({ ephemeral: true });
            await closePoll(pollId, client, interaction, 'manual');
        }
    },

    activePolls
};

async function closePoll(pollId, client, interaction, closeType) {
    const activePolls = require('./sendall').activePolls;
    const poll = activePolls.get(pollId);
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
                    .setCustomId(`sendall_poll_vote_${pollId}_${i}`)
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

    // Post results to log channel
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

        // Update the original log message to remove close button
        try {
            // Find and update the log message with the close button
            const messages = await logChannel.messages.fetch({ limit: 50 });
            const logMsg = messages.find(m =>
                m.author.id === client.user.id &&
                m.components.length > 0 &&
                m.components[0].components[0]?.customId === `sendall_poll_close_${pollId}`
            );
            if (logMsg) {
                await logMsg.edit({ components: [] }).catch(console.error);
            }
        } catch (err) {
            console.error('Failed to update log message:', err);
        }
    }

    activePolls.delete(pollId);

    if (interaction) await interaction.editReply('✅ Poll closed! Results have been posted in the log channel.');
}