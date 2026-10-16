const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, ModalBuilder,
    TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const { QotdSchedule } = require('../db');

// ── Constants ──
const PR_MEMBER_ROLE_ID     = '1417981534421520515';
const PR_LEADERSHIP_ROLE_ID = '1449021407282593937';
const REVIEW_LOG_CHANNEL_ID = '1560760489070432256';
const OVERSEER_USER_ID      = '576954029016481802';
const LEADERSHIP_ROLE_ID    = '1449021407282593937';
const ALLIANCE_GUILD_ID     = '1385081586285940796';

const BASE_PAY = {
    leadership: 85,
    member: 50
};

const DEDUCTION_QOTD_MISSED  = 5;
const DEDUCTION_QUOTA_MISSED = 10;

// ── In-memory pay session ──
// paySession = { memberId: { base, deductions: [{label, amount}], finalPay, isLOA, overrideBy, overrideReason, role } }
let paySession = null;
let paySessionInitiator = null;

// ── QOTD miss counter: scans last 4 weeks of QotdSchedule for a userId ──
async function countMissedQotd(userId) {
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    // Get last 4 schedules (roughly one month)
    const schedules = await QotdSchedule.find({}).sort({ createdAt: -1 }).limit(4).catch(() => []);
    let missed = 0;
    for (const sched of schedules) {
        // Did this user have a claimed day this week?
        const claimed = DAYS.find(d => sched.days?.[d]?.userId === userId);
        if (claimed && !sched.days[claimed].completed) {
            missed++; // Claimed but didn't post = missed
        }
        // If they had a day and completed it → fine; if they had no day → not their week to post
    }
    return missed;
}

// ── Count team channel messages this month from weeklyStats ──
function getMemberMessageCount(userId) {
    try {
        const { stats } = require('../utils/weeklyStats');
        // weeklyStats tracks current week; combine current + last week as rough monthly proxy
        const cur = stats._getCurrentRaw?.()?.memberMessages?.[userId] || 0;
        const last = stats._getLastRaw?.()?.memberMessages?.[userId] || 0;
        return cur + last;
    } catch {
        return 0;
    }
}

// ── Build per-member pay record ──
async function buildMemberRecord(member, guild) {
    const isLeadership = member.roles.cache.has(PR_LEADERSHIP_ROLE_ID);
    const base = isLeadership ? BASE_PAY.leadership : BASE_PAY.member;
    const role = isLeadership ? 'PR Leadership' : 'PR Member';

    const deductions = [];

    // QOTD misses
    const qotdMissed = await countMissedQotd(member.id);
    if (qotdMissed > 0) {
        deductions.push({
            label: `Missed QOTD (${qotdMissed} week${qotdMissed > 1 ? 's' : ''})`,
            amount: qotdMissed * DEDUCTION_QOTD_MISSED
        });
    }

    // Monthly quota (topost/checkin) — tracked by weeklyStats sendsomeMessages/sendallMessages
    // We can't easily per-member quota track without more infra, so mark as N/A unless staff manually notes
    // Placeholder: quota miss must be set manually via override for now
    // (Enhancement: if you later add per-member topost tracking, hook it here)

    const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
    const finalPay = Math.max(0, base - totalDeductions);
    const msgCount = getMemberMessageCount(member.id);

    return {
        userId: member.id,
        displayName: member.displayName,
        tag: member.user.tag,
        role,
        base,
        deductions,
        finalPay,
        isLOA: false,
        overrideBy: null,
        overrideReason: null,
        msgCount
    };
}

// ── Build review embed for one member ──
function buildReviewEmbed(record, index, total) {
    const deductionLines = record.deductions.length
        ? record.deductions.map(d => `• ${d.label}: **−${d.amount} R$**`).join('\n')
        : '• None';

    const payDisplay = record.isLOA
        ? '**0 R$** *(LOA — payment withheld)*'
        : record.overrideBy
        ? `**${record.finalPay} R$** *(manually adjusted by ${record.overrideBy})*`
        : `**${record.finalPay} R$**`;

    const embed = new EmbedBuilder()
        .setTitle(`💰 Pay Review — ${record.displayName}`)
        .setColor(record.isLOA ? 0x888888 : record.overrideBy ? 0xFF9900 : 0x9B59B6)
        .addFields(
            { name: '👤 Member', value: `<@${record.userId}> (${record.tag})`, inline: true },
            { name: '🏷️ Role', value: record.role, inline: true },
            { name: '💵 Base Pay', value: `${record.base} R$`, inline: true },
            { name: '📉 Deductions', value: deductionLines, inline: false },
            { name: '💬 Messages in Hub (this month)', value: `${record.msgCount}`, inline: true },
            { name: '✅ Final Pay', value: payDisplay, inline: false }
        )
        .setFooter({ text: `Member ${index + 1} of ${total} • React buttons below to adjust` })
        .setTimestamp();

    if (record.overrideReason) {
        embed.addFields({ name: '📝 Override Reason', value: record.overrideReason, inline: false });
    }

    return embed;
}

// ── Build buttons for a review embed ──
function buildReviewButtons(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pay_override_${userId}`)
            .setLabel('✏️ Override Pay')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`pay_loa_${userId}`)
            .setLabel('🏖️ Set LOA (0 Pay)')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`pay_deduction_${userId}`)
            .setLabel('➕ Add Deduction')
            .setStyle(ButtonStyle.Secondary)
    );
}

// ── Build finalize button row ──
function buildFinalizeRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('pay_finalize')
            .setLabel('✅ Finalize & Send DMs')
            .setStyle(ButtonStyle.Success)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pay-calculate')
        .setDescription('Calculate monthly pay for all PR team members and post for review'),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const guild = await client.guilds.fetch(ALLIANCE_GUILD_ID).catch(() => null);
        if (!guild) return interaction.editReply('❌ Could not fetch alliance guild.');

        await guild.members.fetch();

        const prMembers = guild.members.cache.filter(m =>
            !m.user.bot &&
            (m.roles.cache.has(PR_MEMBER_ROLE_ID) || m.roles.cache.has(PR_LEADERSHIP_ROLE_ID))
        );

        if (!prMembers.size) {
            return interaction.editReply('❌ No PR members or leadership found in the guild.');
        }

        await interaction.editReply(`⏳ Calculating pay for **${prMembers.size}** PR team member(s)... This may take a moment.`);

        // Build all records
        paySession = {};
        paySessionInitiator = interaction.user.tag;

        for (const [, member] of prMembers) {
            const record = await buildMemberRecord(member, guild);
            paySession[member.id] = record;
        }

        const records = Object.values(paySession);
        const reviewChannel = await client.channels.fetch(REVIEW_LOG_CHANNEL_ID).catch(() => null);
        if (!reviewChannel) return interaction.editReply('❌ Review channel not found.');

        // Post header
        await reviewChannel.send({
            embeds: [new EmbedBuilder()
                .setTitle('💰 Monthly Pay Review — Kavià PR Team')
                .setDescription(
                    `Pay has been calculated for **${records.length}** member(s).\n\n` +
                    `<@&${LEADERSHIP_ROLE_ID}> — please review each member's pay below.\n\n` +
                    `• Use **✏️ Override Pay** to manually set a different amount\n` +
                    `• Use **🏖️ Set LOA (0 Pay)** if a member was on LOA for more than 2 weeks\n` +
                    `• Use **➕ Add Deduction** to add a missed quota or other deduction\n` +
                    `• Once all members are reviewed, click **✅ Finalize & Send DMs**`
                )
                .setColor(0x9B59B6)
                .addFields(
                    { name: '👑 Base Pay — PR Leadership', value: `${BASE_PAY.leadership} R$`, inline: true },
                    { name: '👥 Base Pay — PR Member', value: `${BASE_PAY.member} R$`, inline: true }
                )
                .setFooter({ text: `Initiated by ${interaction.user.tag}` })
                .setTimestamp()],
            allowedMentions: { roles: [LEADERSHIP_ROLE_ID] }
        });

        // Post each member embed
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            await reviewChannel.send({
                embeds: [buildReviewEmbed(record, i, records.length)],
                components: [buildReviewButtons(record.userId)]
            });
        }

        // Post finalize button
        await reviewChannel.send({
            embeds: [new EmbedBuilder()
                .setTitle('📋 All Members Listed Above')
                .setDescription('When you\'re satisfied with all entries, click the button below to send DMs to all members.')
                .setColor(0x2ECC71)],
            components: [buildFinalizeRow()]
        });

        await interaction.editReply(`✅ Pay review posted in <#${REVIEW_LOG_CHANNEL_ID}>! Review each member and click **Finalize & Send DMs** when ready.`);
    },

    async handleButton(interaction, client) {
        const id = interaction.customId;

        // ── Override Pay ──
        if (id.startsWith('pay_override_')) {
            const userId = id.replace('pay_override_', '');
            const modal = new ModalBuilder()
                .setCustomId(`pay_override_modal_${userId}`)
                .setTitle('✏️ Override Pay Amount');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('new_amount')
                        .setLabel('New Pay Amount (R$)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. 70')
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('override_reason')
                        .setLabel('Reason for override')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('e.g. Missed monthly quota, partial LOA, excellent performance...')
                        .setRequired(true)
                )
            );
            await interaction.showModal(modal);
            return;
        }

        // ── LOA — set to 0 ──
        if (id.startsWith('pay_loa_')) {
            const userId = id.replace('pay_loa_', '');
            if (!paySession?.[userId]) {
                return interaction.reply({ content: '❌ Session expired. Run `/pay-calculate` again.', ephemeral: true });
            }
            await interaction.deferUpdate();
            paySession[userId].isLOA = true;
            paySession[userId].finalPay = 0;
            paySession[userId].overrideBy = interaction.user.tag;
            paySession[userId].overrideReason = 'LOA longer than 2 weeks — payment withheld';

            const records = Object.values(paySession);
            const idx = records.findIndex(r => r.userId === userId);
            await interaction.message.edit({
                embeds: [buildReviewEmbed(paySession[userId], idx, records.length)],
                components: [buildReviewButtons(userId)]
            });
            return;
        }

        // ── Add deduction ──
        if (id.startsWith('pay_deduction_')) {
            const userId = id.replace('pay_deduction_', '');
            const modal = new ModalBuilder()
                .setCustomId(`pay_deduction_modal_${userId}`)
                .setTitle('➕ Add Deduction');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('deduction_label')
                        .setLabel('Reason for deduction')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. Missed monthly quota')
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('deduction_amount')
                        .setLabel('Amount to deduct (R$)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. 10')
                        .setRequired(true)
                )
            );
            await interaction.showModal(modal);
            return;
        }

        // ── Finalize & Send DMs ──
        if (id === 'pay_finalize') {
            if (!paySession) {
                return interaction.reply({ content: '❌ No active pay session. Run `/pay-calculate` again.', ephemeral: true });
            }
            await interaction.deferUpdate();

            const records = Object.values(paySession);
            const guild = await client.guilds.fetch(ALLIANCE_GUILD_ID).catch(() => null);
            let dmSuccess = 0;
            let dmFailed = 0;
            const logLines = [];

            for (const record of records) {
                const deductionLines = record.deductions.length
                    ? record.deductions.map(d => `• ${d.label}: −${d.amount} R$`).join('\n')
                    : 'None';

                const manualNote = record.overrideBy
                    ? `\n\n⚠️ **This amount was manually adjusted by ${record.overrideBy}.**\n📝 Reason: ${record.overrideReason}`
                    : '';

                const dmEmbed = new EmbedBuilder()
                    .setTitle('💰 Your Monthly Pay — Kavià Café PR Team')
                    .setColor(record.isLOA ? 0x888888 : 0x9B59B6)
                    .addFields(
                        { name: '🏷️ Role', value: record.role, inline: true },
                        { name: '💵 Base Pay', value: `${record.base} R$`, inline: true },
                        { name: '📉 Deductions', value: deductionLines, inline: false },
                        { name: '✅ Final Pay', value: `**${record.finalPay} R$**`, inline: false }
                    )
                    .setDescription(
                        `Hi <@${record.userId}>! Here is your pay breakdown for this month.${manualNote}\n\n` +
                        `Once leadership has confirmed payment, you'll receive a follow-up message. 💜`
                    )
                    .setFooter({ text: 'Kavià Café — Public Relations Department' })
                    .setTimestamp();

                try {
                    const user = await client.users.fetch(record.userId);
                    await user.send({ embeds: [dmEmbed] });
                    dmSuccess++;
                } catch {
                    dmFailed++;
                }

                const overrideTag = record.overrideBy ? ` [⚠️ Manual Override by ${record.overrideBy}: ${record.overrideReason}]` : '';
                const loaTag = record.isLOA ? ' [🏖️ LOA — 0 Pay]' : '';
                logLines.push(`• **${record.displayName}** (${record.role}): **${record.finalPay} R$**${loaTag}${overrideTag}`);
            }

            // DM overseer the full list
            try {
                const overseer = await client.users.fetch(OVERSEER_USER_ID);
                const overseerEmbed = new EmbedBuilder()
                    .setTitle('📋 Monthly Pay Summary — Kavià PR Team')
                    .setDescription(logLines.join('\n'))
                    .setColor(0x9B59B6)
                    .addFields(
                        { name: '✅ DMs Sent', value: `${dmSuccess}`, inline: true },
                        { name: '❌ DMs Failed', value: `${dmFailed}`, inline: true },
                        { name: 'Initiated By', value: paySessionInitiator || 'Unknown', inline: true }
                    )
                    .setFooter({ text: 'Kavià Café — Pay System' })
                    .setTimestamp();
                await overseer.send({ embeds: [overseerEmbed] });
            } catch (e) {
                console.error('Failed to DM overseer:', e);
            }

            // Post final log in channel with Mark as Paid button
            const reviewChannel = await client.channels.fetch(REVIEW_LOG_CHANNEL_ID).catch(() => null);
            if (reviewChannel) {
                await reviewChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('📋 Pay Finalized — Monthly Summary')
                        .setDescription(logLines.join('\n'))
                        .setColor(0x2ECC71)
                        .addFields(
                            { name: '✅ DMs Sent', value: `${dmSuccess}`, inline: true },
                            { name: '❌ DMs Failed (open DMs required)', value: `${dmFailed}`, inline: true }
                        )
                        .setFooter({ text: `Finalized by ${interaction.user.tag}` })
                        .setTimestamp()],
                    components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('pay_mark_paid')
                            .setLabel('📨 Mark as Paid')
                            .setStyle(ButtonStyle.Success)
                    )]
                });
            }

            await interaction.message.edit({ components: [] });
            return;
        }

        // ── Mark as Paid ──
        if (id === 'pay_mark_paid') {
            if (!paySession) {
                return interaction.reply({ content: '❌ No active pay session found. The bot may have restarted.', ephemeral: true });
            }

            // Confirm first
            await interaction.reply({
                content: `Are you sure you want to DM all **${Object.keys(paySession).length}** members that they have been paid?`,
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('pay_mark_paid_confirm')
                        .setLabel('✅ Yes, Mark All as Paid')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('pay_mark_paid_cancel')
                        .setLabel('❌ Cancel')
                        .setStyle(ButtonStyle.Secondary)
                )],
                ephemeral: true
            });
            return;
        }

        if (id === 'pay_mark_paid_confirm') {
            if (!paySession) {
                return interaction.reply({ content: '❌ Session expired.', ephemeral: true });
            }
            await interaction.deferUpdate();
            const records = Object.values(paySession);

            for (const record of records) {
                const deductionLines = record.deductions.length
                    ? record.deductions.map(d => `• ${d.label}: −${d.amount} R$`).join('\n')
                    : 'No deductions — full base pay!';

                const manualNote = record.overrideBy
                    ? `\n\n⚠️ *This amount was manually adjusted. Reason: ${record.overrideReason}*`
                    : '';

                const paidEmbed = new EmbedBuilder()
                    .setTitle('✅ You\'ve Been Paid! — Kavià Café PR Team')
                    .setColor(0x2ECC71)
                    .setDescription(
                        `Hi <@${record.userId}>! Your payment of **${record.finalPay} R$** has been processed for this month. 💜${manualNote}`
                    )
                    .addFields(
                        { name: '💵 Base Pay', value: `${record.base} R$`, inline: true },
                        { name: '✅ Amount Paid', value: `**${record.finalPay} R$**`, inline: true },
                        { name: '📉 Deductions', value: deductionLines, inline: false }
                    )
                    .setFooter({ text: 'Kavià Café — Public Relations Department' })
                    .setTimestamp();

                try {
                    const user = await client.users.fetch(record.userId);
                    await user.send({ embeds: [paidEmbed] });
                } catch { /* silent */ }
            }

            // Mark the button as used
            const reviewChannel = await client.channels.fetch(REVIEW_LOG_CHANNEL_ID).catch(() => null);
            if (reviewChannel) {
                await interaction.message.edit({
                    components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('pay_mark_paid_done')
                            .setLabel('✅ Paid — All Members Notified')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(true)
                    )]
                });
            }

            // Clear session
            paySession = null;
            paySessionInitiator = null;
            return;
        }

        if (id === 'pay_mark_paid_cancel') {
            await interaction.update({ content: '❌ Cancelled.', components: [] });
            return;
        }
    },

    async handleModal(interaction, client) {
        const id = interaction.customId;

        // ── Override modal ──
        if (id.startsWith('pay_override_modal_')) {
            const userId = id.replace('pay_override_modal_', '');
            if (!paySession?.[userId]) {
                return interaction.reply({ content: '❌ Session expired.', ephemeral: true });
            }
            await interaction.deferUpdate();

            const newAmount = parseInt(interaction.fields.getTextInputValue('new_amount'));
            const reason = interaction.fields.getTextInputValue('override_reason');

            if (isNaN(newAmount) || newAmount < 0) {
                return interaction.followUp({ content: '❌ Invalid amount.', ephemeral: true });
            }

            paySession[userId].finalPay = newAmount;
            paySession[userId].overrideBy = interaction.user.tag;
            paySession[userId].overrideReason = reason;
            paySession[userId].isLOA = false;

            const records = Object.values(paySession);
            const idx = records.findIndex(r => r.userId === userId);
            await interaction.message.edit({
                embeds: [buildReviewEmbed(paySession[userId], idx, records.length)],
                components: [buildReviewButtons(userId)]
            });
            return;
        }

        // ── Add deduction modal ──
        if (id.startsWith('pay_deduction_modal_')) {
            const userId = id.replace('pay_deduction_modal_', '');
            if (!paySession?.[userId]) {
                return interaction.reply({ content: '❌ Session expired.', ephemeral: true });
            }
            await interaction.deferUpdate();

            const label = interaction.fields.getTextInputValue('deduction_label');
            const amount = parseInt(interaction.fields.getTextInputValue('deduction_amount'));

            if (isNaN(amount) || amount <= 0) {
                return interaction.followUp({ content: '❌ Invalid deduction amount.', ephemeral: true });
            }

            paySession[userId].deductions.push({ label, amount });
            paySession[userId].finalPay = Math.max(0, paySession[userId].finalPay - amount);
            if (!paySession[userId].overrideBy) {
                paySession[userId].overrideBy = interaction.user.tag;
                paySession[userId].overrideReason = `Manual deduction added: ${label}`;
            }

            const records = Object.values(paySession);
            const idx = records.findIndex(r => r.userId === userId);
            await interaction.message.edit({
                embeds: [buildReviewEmbed(paySession[userId], idx, records.length)],
                components: [buildReviewButtons(userId)]
            });
            return;
        }
    }
};