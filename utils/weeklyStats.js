const { EmbedBuilder } = require('discord.js');
const { loadAlliances } = require('./allianceStorage');

const WEEKLY_REPORT_CHANNEL_ID = '1551046474266312754';
const ALLIANCE_GUILD_ID = '1385081586285940796';

// ── Stats store ──
let current = freshWeek();
let last = freshWeek();

function freshWeek() {
    return {
        alliancesAdded: 0,
        alliancesRemoved: 0,
        repsVerified: 0,
        repsStruck: 0,
        repsTerminated: 0,
        repsBlacklisted: 0,
        sendallMessages: 0,
        sendallPolls: 0,
        sendsomeMessages: 0,
        sendsomePolls: 0,
        eventRequests: 0,
        membersJoined: 0,
        membersLeft: 0,
        messagesInHub: 0,
        staffActions: {}, // staffTag -> count
        memberMessages: {} // userId -> count
    };
}

// ── Increment helpers ──
function inc(key, amount = 1) {
    current[key] = (current[key] || 0) + amount;
}

function incStaff(staffTag) {
    if (!current.staffActions[staffTag]) current.staffActions[staffTag] = 0;
    current.staffActions[staffTag]++;
}

function incMemberMessage(userId) {
    if (!current.memberMessages[userId]) current.memberMessages[userId] = 0;
    current.memberMessages[userId]++;
    inc('messagesInHub');
}

// ── Public increment functions ──
const stats = {
    allianceAdded: (staffTag) => { inc('alliancesAdded'); if (staffTag) incStaff(staffTag); },
    allianceRemoved: (staffTag) => { inc('alliancesRemoved'); if (staffTag) incStaff(staffTag); },
    repVerified: (staffTag) => { inc('repsVerified'); if (staffTag) incStaff(staffTag); },
    repStruck: (staffTag) => { inc('repsStruck'); if (staffTag) incStaff(staffTag); },
    repTerminated: (staffTag) => { inc('repsTerminated'); if (staffTag) incStaff(staffTag); },
    repBlacklisted: (staffTag) => { inc('repsBlacklisted'); if (staffTag) incStaff(staffTag); },
    sendallMessage: () => inc('sendallMessages'),
    sendallPoll: () => inc('sendallPolls'),
    sendsomeMessage: () => inc('sendsomeMessages'),
    sendsomePoll: () => inc('sendsomePolls'),
    eventRequest: (staffTag) => { inc('eventRequests'); if (staffTag) incStaff(staffTag); },
    memberJoined: () => inc('membersJoined'),
    memberLeft: () => inc('membersLeft'),
    hubMessage: (userId) => incMemberMessage(userId)
};

// ── Comparison helper ──
function diff(cur, prev) {
    const d = cur - prev;
    const arrow = d > 0 ? '📈' : d < 0 ? '📉' : '➡️';
    const sign = d > 0 ? '+' : '';
    return `${arrow} ${sign}${d}`;
}

// ── Build and post report ──
async function postWeeklyReport(client) {
    try {
        const guild = await client.guilds.fetch(ALLIANCE_GUILD_ID).catch(() => null);
        const channel = await client.channels.fetch(WEEKLY_REPORT_CHANNEL_ID).catch(() => null);
        if (!channel) return console.error('Weekly report channel not found');

        const alliances = await loadAlliances().catch(() => []);
        const total = alliances.length;
        const missingReps = alliances.filter(a => (a.theirRepIds?.length || 0) < 2).length;
        const brokenLinks = alliances.filter(a =>
            (!a.discordLink || a.discordLink === 'N/A') ||
            (!a.robloxLink || a.robloxLink === 'N/A')
        ).length;
        const healthy = total - missingReps;

        // Top staff member
        const staffEntries = Object.entries(current.staffActions).sort((a, b) => b[1] - a[1]);
        const topStaff = staffEntries[0] ? `${staffEntries[0][0]} (${staffEntries[0][1]} actions)` : 'No activity';

        // Top member by messages
        const msgEntries = Object.entries(current.memberMessages).sort((a, b) => b[1] - a[1]);
        let topMember = 'No activity';
        if (msgEntries[0]) {
            topMember = `<@${msgEntries[0][0]}> (${msgEntries[0][1]} messages)`;
        }

        const netAlliances = current.alliancesAdded - current.alliancesRemoved;
        const netMembers = current.membersJoined - current.membersLeft;
        const lastNetAlliances = last.alliancesAdded - last.alliancesRemoved;
        const lastNetMembers = last.membersJoined - last.membersLeft;

        const weekStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        // ── Embed 1: Alliance & Rep Activity ──
        const allianceEmbed = new EmbedBuilder()
            .setTitle(`📊 Weekly Stats Report — ${weekStr}`)
            .setColor(0x9B59B6)
            .addFields(
                { name: '━━━ 🏛️ Alliance Activity ━━━', value: '\u200b', inline: false },
                { name: '✨ Added', value: `${current.alliancesAdded} ${diff(current.alliancesAdded, last.alliancesAdded)}`, inline: true },
                { name: '❌ Removed', value: `${current.alliancesRemoved} ${diff(current.alliancesRemoved, last.alliancesRemoved)}`, inline: true },
                { name: '📊 Net Change', value: `${netAlliances >= 0 ? '+' : ''}${netAlliances} ${diff(netAlliances, lastNetAlliances)}`, inline: true },
                { name: '🌐 Total Alliances', value: `${total}`, inline: true },
                { name: '✅ Healthy', value: `${healthy}`, inline: true },
                { name: '⚠️ Missing Reps', value: `${missingReps}`, inline: true },
                { name: '🔗 Broken Links', value: `${brokenLinks}`, inline: true },
                { name: '\u200b', value: '\u200b', inline: false },
                { name: '━━━ 👥 Rep Activity ━━━', value: '\u200b', inline: false },
                { name: '✅ Verified', value: `${current.repsVerified} ${diff(current.repsVerified, last.repsVerified)}`, inline: true },
                { name: '⚠️ Struck', value: `${current.repsStruck} ${diff(current.repsStruck, last.repsStruck)}`, inline: true },
                { name: '🚫 Terminated', value: `${current.repsTerminated} ${diff(current.repsTerminated, last.repsTerminated)}`, inline: true },
                { name: '⛔ Blacklisted', value: `${current.repsBlacklisted} ${diff(current.repsBlacklisted, last.repsBlacklisted)}`, inline: true },
                { name: '🏆 Most Active Staff', value: topStaff, inline: false },
                { name: '\u200b', value: '\u200b', inline: false },
                { name: '━━━ 📢 Communication ━━━', value: '\u200b', inline: false },
                { name: '📨 Sendall Messages', value: `${current.sendallMessages} ${diff(current.sendallMessages, last.sendallMessages)}`, inline: true },
                { name: '📊 Sendall Polls', value: `${current.sendallPolls} ${diff(current.sendallPolls, last.sendallPolls)}`, inline: true },
                { name: '📨 Sendsome Messages', value: `${current.sendsomeMessages} ${diff(current.sendsomeMessages, last.sendsomeMessages)}`, inline: true },
                { name: '📊 Sendsome Polls', value: `${current.sendsomePolls} ${diff(current.sendsomePolls, last.sendsomePolls)}`, inline: true },
                { name: '📅 Event Requests', value: `${current.eventRequests} ${diff(current.eventRequests, last.eventRequests)}`, inline: true }
            )
            .setFooter({ text: 'Kavià Café — Weekly Stats Report' })
            .setTimestamp();

        // ── Embed 2: Discord Server Stats ──
        const serverEmbed = new EmbedBuilder()
            .setTitle('🖥️ Discord Server Stats')
            .setColor(0x5865F2)
            .addFields(
                { name: '📥 Members Joined', value: `${current.membersJoined} ${diff(current.membersJoined, last.membersJoined)}`, inline: true },
                { name: '📤 Members Left', value: `${current.membersLeft} ${diff(current.membersLeft, last.membersLeft)}`, inline: true },
                { name: '📊 Net Member Change', value: `${netMembers >= 0 ? '+' : ''}${netMembers} ${diff(netMembers, lastNetMembers)}`, inline: true },
                { name: '💬 Messages Sent', value: `${current.messagesInHub} ${diff(current.messagesInHub, last.messagesInHub)}`, inline: true },
                { name: '🏆 Most Active Member', value: topMember, inline: false }
            )
            .setFooter({ text: 'Stats reset weekly every Sunday at 9AM EST' })
            .setTimestamp();

        await channel.send({ embeds: [allianceEmbed, serverEmbed] });

        // ── Snapshot and reset ──
        last = JSON.parse(JSON.stringify(current));
        current = freshWeek();

        console.log('✅ Weekly stats report posted');
    } catch (err) {
        console.error('❌ Failed to post weekly stats report:', err);
    }
}

// ── Schedule checker (call this from index.js setInterval loop) ──
let lastReportDate = null;

function checkWeeklyReport(client) {
    const now = new Date();
    // Convert to EST (UTC-5 or UTC-4 during DST)
    const estOffset = isDST(now) ? -4 : -5;
    const est = new Date(now.getTime() + estOffset * 60 * 60 * 1000);

    const isSunday = est.getUTCDay() === 0;
    const isNineAM = est.getUTCHours() === 9 && est.getUTCMinutes() === 0;
    const dateKey = `${est.getUTCFullYear()}-${est.getUTCMonth()}-${est.getUTCDate()}`;

    if (isSunday && isNineAM && lastReportDate !== dateKey) {
        lastReportDate = dateKey;
        postWeeklyReport(client);
    }
}

function isDST(date) {
    const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
    const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
    return Math.max(jan, jul) !== date.getTimezoneOffset();
}

module.exports = { stats, checkWeeklyReport, postWeeklyReport };