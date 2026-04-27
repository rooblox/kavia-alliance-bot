const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { AwarenessSchedule } = require('../db');

const AWARENESS_CHANNEL_ID = '1498323009453166745';
const APPROVAL_CHANNEL_ID = '1498322220836192336';
const GUILD_ID = '1385081586285940796';
const STAFF_ROLE_ID = '1485100238715883720';

function getMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthName() {
    return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function buildScheduleEmbed(schedule) {
    const entries = schedule.entries || [];

    const lines = entries.length > 0
        ? entries.map(e => {
            if (e.completed) return `✅ **${e.date}** — <@${e.userId}> — ${e.title} *(Posted)*`;
            if (e.approved) return `🗓️ **${e.date}** — <@${e.userId}> — ${e.title} *(Approved)*`;
            return `⏳ **${e.date}** — <@${e.userId}> — ${e.title} *(Awaiting Approval)*`;
        }).join('\n')
        : '*No awareness posts claimed yet this month. Click the button below to submit yours!*';

    return new EmbedBuilder()
        .setTitle(`📢 Awareness Schedule — ${getMonthName()}`)
        .setDescription(
            `Welcome to this month's **Awareness** schedule! 🌟\n\n` +
            `**How it works:**\n` +
            `• Each staff member may claim **one awareness post per month**\n` +
            `• Click the button below to submit your date, title and what you plan to post\n` +
            `• Your submission will be reviewed by PR Leadership before it is approved\n` +
            `• On your chosen date, you will be reminded to post in <#${AWARENESS_CHANNEL_ID}>\n` +
            `• Once posted, click the **I've Posted** button in the reminder message\n\n` +
            `**This Month's Submissions:**\n\n` +
            lines
        )
        .setColor(0x9B59B6)
        .setFooter({ text: `Kavià Café — Awareness Schedule • ${getMonthName()}` })
        .setTimestamp();
}

function buildScheduleRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('awareness_submit')
            .setLabel('📋 Submit Awareness Request')
            .setStyle(ButtonStyle.Primary)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('awareness')
        .setDescription('Post the monthly awareness schedule'),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
            if (!guild) return await interaction.editReply('❌ Guild not found.');

            const channel = await client.channels.fetch(AWARENESS_CHANNEL_ID).catch(() => null);
            if (!channel) return await interaction.editReply('❌ Awareness channel not found.');

            const monthKey = getMonthKey();
            let schedule = await AwarenessSchedule.findOne({ monthKey });
            if (!schedule) {
                schedule = await AwarenessSchedule.create({ monthKey, entries: [], messageId: null });
            }

            const embed = buildScheduleEmbed(schedule);
            const row = buildScheduleRow();

            if (schedule.messageId) {
                try {
                    const existing = await channel.messages.fetch(schedule.messageId);
                    await existing.edit({ embeds: [embed], components: [row] });
                    await interaction.editReply('✅ Awareness schedule refreshed!');
                    return;
                } catch {
                    // Message deleted, post new one
                }
            }

            const msg = await channel.send({ embeds: [embed], components: [row] });
            schedule.messageId = msg.id;
            await schedule.save();

            await interaction.editReply('✅ Awareness schedule posted!');
        } catch (err) {
            console.error('Error executing awareness:', err);
            await interaction.editReply('❌ There was an error.');
        }
    },

    async handleButton(interaction, client) {
        const customId = interaction.customId;

        // ── Submit button — open modal ──
        if (customId === 'awareness_submit') {
            const monthKey = getMonthKey();
            const schedule = await AwarenessSchedule.findOne({ monthKey });

            if (schedule) {
                const existing = schedule.entries.find(e => e.userId === interaction.user.id);
                if (existing) {
                    return interaction.reply({
                        content: '❌ You have already submitted an awareness request this month.',
                        ephemeral: true
                    });
                }
            }

            const modal = new ModalBuilder()
                .setCustomId('awareness_modal')
                .setTitle('Awareness Request');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('awareness_date')
                        .setLabel('Date (e.g. April 15)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Enter the date you plan to post')
                        .setRequired(true)
                        .setMaxLength(20)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('awareness_title')
                        .setLabel('Title of Awareness')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. Mental Health Awareness')
                        .setRequired(true)
                        .setMaxLength(100)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('awareness_description')
                        .setLabel('What do you plan to post?')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Briefly describe what you plan to post...')
                        .setRequired(true)
                        .setMaxLength(500)
                )
            );

            await interaction.showModal(modal);
        }

        // ── Approve button ──
        if (customId.startsWith('awareness_approve_')) {
            const entryId = customId.replace('awareness_approve_', '');

            const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
            if (!member?.roles.cache.has(STAFF_ROLE_ID)) {
                return interaction.reply({ content: '❌ You do not have permission to approve awareness requests.', ephemeral: true });
            }

            const monthKey = getMonthKey();
            const schedule = await AwarenessSchedule.findOne({ monthKey });
            if (!schedule) return interaction.reply({ content: '❌ No active schedule found.', ephemeral: true });

            const entry = schedule.entries.find(e => e.entryId === entryId);
            if (!entry) return interaction.reply({ content: '❌ Entry not found.', ephemeral: true });

            entry.approved = true;
            entry.approvedBy = interaction.user.tag;
            schedule.markModified('entries');
            await schedule.save();

            // Update approval message
            await interaction.update({
                embeds: [EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('Green')
                    .setTitle('✅ Awareness Request — Approved')],
                components: []
            });

            // Update schedule embed
            await refreshScheduleEmbed(client, schedule);

            // DM the user
            try {
                const user = await client.users.fetch(entry.userId);
                await user.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('✅ Awareness Request Approved!')
                        .setDescription(
                            `Hey <@${entry.userId}>! 🎉\n\n` +
                            `Your awareness request has been **approved** by PR Leadership!\n\n` +
                            `**Title:** ${entry.title}\n` +
                            `**Date:** ${entry.date}\n\n` +
                            `You will be reminded on your chosen date to post in <#${AWARENESS_CHANNEL_ID}>. Make sure to have it ready! 💜`
                        )
                        .setColor(0x9B59B6)
                        .setFooter({ text: 'Kavià Café — Awareness Schedule' })
                        .setTimestamp()]
                });
            } catch (err) {
                console.error('Failed to DM user on approval:', err);
            }
        }

        // ── Deny button ──
        if (customId.startsWith('awareness_deny_')) {
            const entryId = customId.replace('awareness_deny_', '');

            const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
            if (!member?.roles.cache.has(STAFF_ROLE_ID)) {
                return interaction.reply({ content: '❌ You do not have permission to deny awareness requests.', ephemeral: true });
            }

            const monthKey = getMonthKey();
            const schedule = await AwarenessSchedule.findOne({ monthKey });
            if (!schedule) return interaction.reply({ content: '❌ No active schedule found.', ephemeral: true });

            const entryIndex = schedule.entries.findIndex(e => e.entryId === entryId);
            if (entryIndex === -1) return interaction.reply({ content: '❌ Entry not found.', ephemeral: true });

            const entry = schedule.entries[entryIndex];
            schedule.entries.splice(entryIndex, 1);
            schedule.markModified('entries');
            await schedule.save();

            await interaction.update({
                embeds: [EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('Red')
                    .setTitle('❌ Awareness Request — Denied')],
                components: []
            });

            await refreshScheduleEmbed(client, schedule);

            // DM the user
            try {
                const user = await client.users.fetch(entry.userId);
                await user.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Awareness Request Denied')
                        .setDescription(
                            `Hey <@${entry.userId}>,\n\n` +
                            `Unfortunately your awareness request has been **denied** by PR Leadership.\n\n` +
                            `**Title:** ${entry.title}\n` +
                            `**Date:** ${entry.date}\n\n` +
                            `Please feel free to submit a new request with a different topic or date. If you have any questions, reach out to PR Leadership. 💜`
                        )
                        .setColor('Red')
                        .setFooter({ text: 'Kavià Café — Awareness Schedule' })
                        .setTimestamp()]
                });
            } catch (err) {
                console.error('Failed to DM user on denial:', err);
            }
        }

        // ── Posted button ──
        if (customId.startsWith('awareness_posted_')) {
            const entryId = customId.replace('awareness_posted_', '');
            const monthKey = getMonthKey();
            const schedule = await AwarenessSchedule.findOne({ monthKey });
            if (!schedule) return interaction.reply({ content: '❌ No active schedule found.', ephemeral: true });

            const entry = schedule.entries.find(e => e.entryId === entryId);
            if (!entry) return interaction.reply({ content: '❌ Entry not found.', ephemeral: true });
            if (entry.userId !== interaction.user.id) return interaction.reply({ content: '❌ This button is not for you.', ephemeral: true });

            entry.completed = true;
            schedule.markModified('entries');
            await schedule.save();

            await interaction.update({ components: [] });
            await interaction.followUp({ content: '✅ Marked as posted! Great work! 🌟', ephemeral: true });

            await refreshScheduleEmbed(client, schedule);
        }
    },

    async handleModal(interaction, client) {
        if (interaction.customId !== 'awareness_modal') return;

        const date = interaction.fields.getTextInputValue('awareness_date');
        const title = interaction.fields.getTextInputValue('awareness_title');
        const description = interaction.fields.getTextInputValue('awareness_description');
        const monthKey = getMonthKey();

        await interaction.deferReply({ ephemeral: true });

        try {
            let schedule = await AwarenessSchedule.findOne({ monthKey });
            if (!schedule) {
                schedule = await AwarenessSchedule.create({ monthKey, entries: [], messageId: null });
            }

            const existing = schedule.entries.find(e => e.userId === interaction.user.id);
            if (existing) {
                return await interaction.editReply('❌ You have already submitted an awareness request this month.');
            }

            const entryId = `${interaction.user.id}_${Date.now()}`;
            schedule.entries.push({
                entryId,
                userId: interaction.user.id,
                displayName: interaction.member?.displayName || interaction.user.username,
                date,
                title,
                description,
                approved: false,
                completed: false,
                submittedAt: new Date().toISOString()
            });
            schedule.markModified('entries');
            await schedule.save();

            // Send to approval channel
            const approvalChannel = await client.channels.fetch(APPROVAL_CHANNEL_ID).catch(() => null);
            if (approvalChannel) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`awareness_approve_${entryId}`)
                        .setLabel('✅ Approve')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`awareness_deny_${entryId}`)
                        .setLabel('❌ Deny')
                        .setStyle(ButtonStyle.Danger)
                );

                await approvalChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('📋 Awareness Request — Awaiting Approval')
                        .setColor(0x9B59B6)
                        .addFields(
                            { name: 'Submitted By', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Date', value: date, inline: true },
                            { name: 'Title', value: title, inline: false },
                            { name: 'What They Plan to Post', value: description, inline: false },
                            { name: 'Submitted At', value: new Date().toLocaleString(), inline: false }
                        )
                        .setFooter({ text: 'Kavià Café — Awareness Schedule' })
                        .setTimestamp()],
                    components: [row]
                });
            }

            await refreshScheduleEmbed(client, schedule);
            await interaction.editReply('✅ Your awareness request has been submitted and is awaiting approval!');

        } catch (err) {
            console.error('Error handling awareness modal:', err);
            await interaction.editReply('❌ There was an error submitting your request.');
        }
    },

    getMonthKey,
    AWARENESS_CHANNEL_ID,
    APPROVAL_CHANNEL_ID,
    GUILD_ID
};

async function refreshScheduleEmbed(client, schedule) {
    try {
        const channel = await client.channels.fetch('1498323009453166745').catch(() => null);
        if (!channel || !schedule.messageId) return;
        const msg = await channel.messages.fetch(schedule.messageId).catch(() => null);
        if (!msg) return;
        await msg.edit({
            embeds: [buildScheduleEmbed(schedule)],
            components: [buildScheduleRow()]
        });
    } catch (err) {
        console.error('Failed to refresh awareness schedule embed:', err);
    }
}