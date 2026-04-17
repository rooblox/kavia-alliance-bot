const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { QotdSchedule } = require('../db');

const SCHEDULE_CHANNEL_ID = '1457224221024587909';
const REMINDER_CHANNEL_ID = '1494499243136647208';
const LOG_CHANNEL_ID = '1494502239119736922';
const GUILD_ID = '1313780438061420584';
const QOTD_ROLE_ID = '1419644380444098694';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
}

function buildEmbed(schedule) {
    const lines = DAYS.map(day => {
        const entry = schedule.days[day];
        if (!entry || !entry.userId) return `**${day}** — *No one has claimed this day yet*`;
        if (entry.completed) return `**${day}** — <@${entry.userId}> ✅ Posted`;
        if (entry.posted) return `**${day}** — <@${entry.userId}> ⏳ Awaiting confirmation`;
        return `**${day}** — <@${entry.userId}> 🎯 Claimed`;
    });

    return new EmbedBuilder()
        .setTitle('📅 Weekly QOTD Schedule')
        .setDescription(
            `Welcome to the **Question of the Day** schedule! 🌟\n\n` +
            `**Rules:**\n` +
            `• Every member must claim and complete **at least one day per week**\n` +
            `• You may claim **multiple days** if you'd like\n` +
            `• Click a day button below to claim it — only you can unclaim your own day\n` +
            `• The schedule resets every **Sunday at 11PM EST**\n\n` +
            `**This Week's Schedule:**\n\n` +
            lines.join('\n')
        )
        .setColor(0x9B59B6)
        .setFooter({ text: 'Kavià Café — QOTD Schedule • Resets every Sunday at 11PM EST' })
        .setTimestamp();
}

function buildButtons(schedule) {
    const rows = [];
    const row1 = new ActionRowBuilder();
    const row2 = new ActionRowBuilder();

    DAYS.slice(0, 4).forEach(day => {
        const entry = schedule.days[day];
        const claimed = entry?.userId;
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId(`qotd_claim_${day}`)
                .setLabel(claimed ? `${day.slice(0, 3)} — ${entry.displayName}` : day)
                .setStyle(claimed ? (entry.completed ? ButtonStyle.Success : ButtonStyle.Primary) : ButtonStyle.Secondary)
        );
    });

    DAYS.slice(4).forEach(day => {
        const entry = schedule.days[day];
        const claimed = entry?.userId;
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(`qotd_claim_${day}`)
                .setLabel(claimed ? `${day.slice(0, 3)} — ${entry.displayName}` : day)
                .setStyle(claimed ? (entry.completed ? ButtonStyle.Success : ButtonStyle.Primary) : ButtonStyle.Secondary)
        );
    });

    return [row1, row2];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('qotd')
        .setDescription('Post or refresh the weekly QOTD schedule'),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
            if (!guild) return await interaction.editReply('❌ QOTD guild not found.');

            const channel = await client.channels.fetch(SCHEDULE_CHANNEL_ID).catch(() => null);
            if (!channel) return await interaction.editReply('❌ Schedule channel not found.');

            const weekStart = getWeekStart();

            let schedule = await QotdSchedule.findOne({ weekStart });
            if (!schedule) {
                schedule = await QotdSchedule.create({
                    weekStart,
                    days: {},
                    messageId: null
                });
            }

            const embed = buildEmbed(schedule);
            const buttons = buildButtons(schedule);

            if (schedule.messageId) {
                try {
                    const existing = await channel.messages.fetch(schedule.messageId);
                    await existing.edit({ embeds: [embed], components: buttons });
                    await interaction.editReply('✅ QOTD schedule refreshed!');

                    // Log refresh
                    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                    if (logChannel) {
                        await logChannel.send({
                            embeds: [new EmbedBuilder()
                                .setTitle('🔄 QOTD Schedule Refreshed')
                                .setColor('Blue')
                                .addFields(
                                    { name: 'Refreshed By', value: interaction.user.tag, inline: true },
                                    { name: 'Date', value: new Date().toLocaleString(), inline: true }
                                )
                                .setTimestamp()]
                        });
                    }
                    return;
                } catch {
                    // Message deleted, post new one
                }
            }

            const msg = await channel.send({
                content: `<@&${QOTD_ROLE_ID}>`,
                embeds: [embed],
                components: buttons,
                allowedMentions: { roles: [QOTD_ROLE_ID] }
            });
            schedule.messageId = msg.id;
            await schedule.save();

            await interaction.editReply('✅ QOTD schedule posted!');

            // Log post
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                await logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('📅 QOTD Schedule Posted')
                        .setColor('Green')
                        .addFields(
                            { name: 'Posted By', value: interaction.user.tag, inline: true },
                            { name: 'Channel', value: `<#${SCHEDULE_CHANNEL_ID}>`, inline: true },
                            { name: 'Date', value: new Date().toLocaleString(), inline: true }
                        )
                        .setTimestamp()]
                });
            }
        } catch (err) {
            console.error('Error executing qotd:', err);
            await interaction.editReply('❌ There was an error.');
        }
    },

    async handleButton(interaction, client) {
        if (!interaction.customId.startsWith('qotd_claim_') && !interaction.customId.startsWith('qotd_posted_')) return;

        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

        // ── Claim/Unclaim button ──
        if (interaction.customId.startsWith('qotd_claim_')) {
            const day = interaction.customId.replace('qotd_claim_', '');
            const weekStart = getWeekStart();

            const schedule = await QotdSchedule.findOne({ weekStart });
            if (!schedule) return interaction.reply({ content: '❌ No active schedule found.', ephemeral: true });

            const entry = schedule.days[day];

            // Unclaim if already claimed by this user
            if (entry?.userId === interaction.user.id) {
                const displayName = entry.displayName;
                schedule.days[day] = {};
                schedule.markModified('days');
                await schedule.save();

                const embed = buildEmbed(schedule);
                const buttons = buildButtons(schedule);
                await interaction.update({ embeds: [embed], components: buttons });

                // Log unclaim
                if (logChannel) {
                    await logChannel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('🔓 QOTD Day Unclaimed')
                            .setColor('Orange')
                            .addFields(
                                { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
                                { name: 'Day', value: day, inline: true },
                                { name: 'Date', value: new Date().toLocaleString(), inline: true }
                            )
                            .setTimestamp()]
                    });
                }
                return;
            }

            // Already claimed by someone else
            if (entry?.userId && entry.userId !== interaction.user.id) {
                return interaction.reply({ content: `❌ **${day}** has already been claimed by <@${entry.userId}>.`, ephemeral: true });
            }

            // Claim it
            schedule.days[day] = {
                userId: interaction.user.id,
                displayName: interaction.member?.displayName || interaction.user.username,
                claimed: true,
                completed: false,
                posted: false,
                claimedAt: new Date().toISOString()
            };
            schedule.markModified('days');
            await schedule.save();

            const embed = buildEmbed(schedule);
            const buttons = buildButtons(schedule);
            await interaction.update({ embeds: [embed], components: buttons });

            // Log claim
            if (logChannel) {
                await logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🎯 QOTD Day Claimed')
                        .setColor('Green')
                        .addFields(
                            { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Day', value: day, inline: true },
                            { name: 'Date', value: new Date().toLocaleString(), inline: true }
                        )
                        .setTimestamp()]
                });
            }
        }

        // ── Posted button ──
        if (interaction.customId.startsWith('qotd_posted_')) {
            const day = interaction.customId.replace('qotd_posted_', '');
            const weekStart = getWeekStart();

            const schedule = await QotdSchedule.findOne({ weekStart });
            if (!schedule) return interaction.reply({ content: '❌ No active schedule found.', ephemeral: true });

            const entry = schedule.days[day];
            if (!entry?.userId) return interaction.reply({ content: '❌ No one claimed this day.', ephemeral: true });
            if (entry.userId !== interaction.user.id) return interaction.reply({ content: '❌ This button is not for you.', ephemeral: true });

            schedule.days[day].completed = true;
            schedule.days[day].posted = true;
            schedule.markModified('days');
            await schedule.save();

            await interaction.update({ components: [] });

            // Update schedule embed
            const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
            if (guild) {
                const channel = await client.channels.fetch(SCHEDULE_CHANNEL_ID).catch(() => null);
                if (channel && schedule.messageId) {
                    const msg = await channel.messages.fetch(schedule.messageId).catch(() => null);
                    if (msg) {
                        await msg.edit({
                            embeds: [buildEmbed(schedule)],
                            components: buildButtons(schedule)
                        }).catch(console.error);
                    }
                }
            }

            await interaction.followUp({ content: `✅ Marked **${day}** as posted! Great work! 🌟`, ephemeral: true });

            // Log posted
            if (logChannel) {
                await logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('✅ QOTD Marked as Posted')
                        .setColor('Green')
                        .addFields(
                            { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Day', value: day, inline: true },
                            { name: 'Date', value: new Date().toLocaleString(), inline: true }
                        )
                        .setTimestamp()]
                });
            }
        }
    },

    getWeekStart,
    buildEmbed,
    buildButtons,
    DAYS,
    SCHEDULE_CHANNEL_ID,
    REMINDER_CHANNEL_ID,
    LOG_CHANNEL_ID,
    GUILD_ID,
    QOTD_ROLE_ID
};