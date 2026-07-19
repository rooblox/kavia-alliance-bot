require('dotenv').config();
const fs = require('fs');
const { Client, Collection, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { connectDB, DisciplinePending, StrikePending, QotdSchedule, AwarenessSchedule } = require('./db');

const ALLOWED_ROLE_ID = '1485100238715883720';
const CLIENT_ID = process.env.CLIENT_ID;
const LOG_CHANNEL_ID = '1462580398935642144';
const DISCIPLINE_LOG_CHANNEL_ID = '1456389041770467370';
const TERMINATED_CATEGORY_ID = '1428837884252786819';
const WELCOME_CHANNEL_ID = '1385081586873008231';
const VERIFICATION_CHANNEL_ID = '1417865773271224350';
const VERIFICATION_LOG_CHANNEL_ID = '1500612010189127891';
const ALLIED_REPS_ROLE_ID = '1417866883750957188';
const ALLIANCE_GUILD_ID = '1385081586285940796';
const KAVIA_DISCORD = 'https://discord.gg/rMtv4smu36';
const KAVIA_ROBLOX = 'https://www.roblox.com/communities/13827902/Kavi-Cafe#!/about';
const QOTD_GUILD_ID = '1370892833182974035';
const KAVIA_ROBLOX_GROUP_ID = 13827902;
const ALLOWED_GUILD_IDS = [
    '1385081586285940796',
    '1313780438061420584',
    '1370892833182974035'
];

let verificationFormatMessageId = null;
const pendingVerifications = new Map();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: ['CHANNEL', 'MESSAGE']
});

client.commands = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if (!command.data || !command.execute) continue;
    client.commands.set(command.data.name, command);
    console.log(`Loaded command: ${command.data.name}`);
}

async function deployToGuild(guildId) {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const commandData = [...client.commands.values()].map(c => c.data.toJSON());
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: commandData });
        console.log(`✅ Commands deployed to guild: ${guildId}`);
    } catch (err) {
        console.error(`❌ Failed to deploy to guild ${guildId}:`, err.message);
    }
}

async function ensureVerificationFormat(client) {
    try {
        const channel = await client.channels.fetch(VERIFICATION_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        if (verificationFormatMessageId) {
            const existing = await channel.messages.fetch(verificationFormatMessageId).catch(() => null);
            if (existing) return;
        }

        const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
        if (messages) {
            const botMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0]?.title?.includes('Verification Format'));
            if (botMsg) {
                verificationFormatMessageId = botMsg.id;
                return;
            }
        }

        const formatEmbed = new EmbedBuilder()
            .setTitle('✅ Alliance Rep Verification Format')
            .setDescription(
                `Welcome to **Kavià | Alliance Hub**! 💜\n\n` +
                `To gain access as an **Allied Representative**, please post your verification using the format below.\n\n` +
                `**Copy and fill in the following:**\n\n` +
                `**Discord Username:**\n` +
                `**Roblox Username:**\n` +
                `**Group Representing:**\n` +
                `**Proof of Invite:** *(attach a screenshot or image link)*\n\n` +
                `Once submitted, a staff member will review your verification and you will be notified via DM. 💜\n\n` +
                `*Please do not DM staff to ask about your verification status — it will be reviewed as soon as possible.*`
            )
            .setColor(0x9B59B6)
            .setFooter({ text: 'Kavià Café — Alliance Hub Verification' })
            .setTimestamp();

        const msg = await channel.send({ embeds: [formatEmbed] });
        await msg.pin().catch(err => console.error('Failed to pin verification format message:', err));
        verificationFormatMessageId = msg.id;
        console.log('✅ Verification format message posted and pinned');
    } catch (err) {
        console.error('Failed to post verification format:', err);
    }
}

async function handleVerificationPass(interaction, client, userId, messageId, allianceName, robloxUsername, robloxUserId, allianceNameClaim = null) {
    const verifyLogChannel = await client.channels.fetch(VERIFICATION_LOG_CHANNEL_ID).catch(() => null);
    const isNotFound = allianceName === '__NOT FOUND__' || allianceName.includes('NOT FOUND') || allianceName === '__NOT_FOUND__';

    let components;
    if (isNotFound) {
        const { loadAlliances } = require('./utils/allianceStorage');
        const alliances = await loadAlliances().catch(() => []);
        const options = alliances.slice(0, 25).map(a => ({ label: a.groupName, value: a.groupName }));
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`verify_staff_pick_alliance_${userId}_${messageId}`)
            .setPlaceholder('Select the correct alliance for this user...')
            .addOptions(options);
        components = [
            new ActionRowBuilder().addComponents(selectMenu),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`verify_deny_${userId}_${messageId}`)
                    .setLabel('❌ Deny')
                    .setStyle(ButtonStyle.Danger)
            )
        ];
    } else {
        components = [new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`verify_accept_${userId}_${messageId}`)
                .setLabel('✅ Accept')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`verify_deny_${userId}_${messageId}`)
                .setLabel('❌ Deny')
                .setStyle(ButtonStyle.Danger)
        )];
    }

    if (verifyLogChannel) {
        await verifyLogChannel.send({
            content: `<@&${ALLOWED_ROLE_ID}>`,
            embeds: [new EmbedBuilder()
                .setTitle(isNotFound ? '⚠️ Verification — Alliance Not Found' : '📋 New Verification Submission')
                .setColor(isNotFound ? 'Yellow' : 0x9B59B6)
                .addFields(
                    { name: 'User', value: `<@${userId}>`, inline: true },
                    { name: 'Alliance', value: isNotFound ? `⚠️ Not found — claims: **${allianceNameClaim || 'Unknown'}**` : allianceName, inline: true },
                    { name: 'Roblox Username', value: robloxUsername, inline: true },
                    { name: 'Roblox Profile', value: `https://www.roblox.com/users/${robloxUserId}/profile`, inline: false },
                    { name: '✅ In Main Discord', value: 'Yes', inline: true },
                    { name: '✅ In Kavià Roblox Group', value: 'Yes', inline: true },
                    { name: 'Submitted At', value: new Date().toLocaleString(), inline: false }
                )
                .setFooter({ text: isNotFound ? 'Kavià Café — Please select the correct alliance below to assign roles' : 'Kavià Café — Alliance Hub Verification • Accepting will auto-assign all roles' })
                .setTimestamp()],
            components,
            allowedMentions: { roles: [ALLOWED_ROLE_ID] }
        });
    }

    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('✅ Verification Submitted!')
            .setDescription(
                `All checks passed! 🎉\n\n` +
                `Your verification has been forwarded to PR Leadership for review. You'll be notified via DM once a decision has been made.\n\n` +
                `**Summary:**\n` +
                `• Alliance: **${isNotFound ? (allianceNameClaim || 'Not listed') : allianceName}**\n` +
                `• Roblox Username: **${robloxUsername}**\n` +
                `• In Main Kavià Discord: ✅\n` +
                `• In Kavià Roblox Group: ✅\n\n` +
                `Please be patient — staff will review your submission as soon as possible. 💜`
            )
            .setColor('Green')
            .setFooter({ text: 'Kavià Café — Alliance Hub Verification' })
            .setTimestamp()],
        components: []
    });
}
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    client.user.setPresence({
        activities: [{ name: 'Watching over Kavià Café Alliances', type: 3 }],
        status: 'online'
    });
    console.log('✅ Status set to: Watching over Kavià Café Alliances');

    await connectDB();
// Leave any unauthorized guilds
    for (const guild of client.guilds.cache.values()) {
        if (!ALLOWED_GUILD_IDS.includes(guild.id)) {
            console.log(`❌ Leaving unauthorized guild: ${guild.name} (${guild.id})`);
            await guild.leave();
        }
    }
    try {
        const pendingDisciplines = await DisciplinePending.find({});
        client._disciplinePending = client._disciplinePending || new Map();
        for (const doc of pendingDisciplines) {
            client._disciplinePending.set(doc.groupName, {
                pendingKicks: new Set(doc.pendingKicks),
                alliance: doc.allianceData,
                actionLabel: doc.actionLabel,
                actionColor: doc.actionColor,
                reason: doc.reason,
                rank: doc.rank,
                staffName: doc.staffName,
                guildId: doc.guildId,
                isStrike: doc.isStrike
            });
        }
        console.log(`✅ Reloaded ${pendingDisciplines.length} pending discipline(s) from MongoDB`);
    } catch (err) {
        console.error('❌ Failed to reload pending disciplines:', err);
    }

    try {
        const pendingStrikes = await StrikePending.find({});
        client._strikePending = client._strikePending || new Map();
        for (const doc of pendingStrikes) {
            client._strikePending.set(doc.key, {
                acknowledged: new Set(doc.acknowledged)
            });
        }
        console.log(`✅ Reloaded ${pendingStrikes.length} pending strike(s) from MongoDB`);
    } catch (err) {
        console.error('❌ Failed to reload pending strikes:', err);
    }

    for (const guild of client.guilds.cache.values()) {
        await deployToGuild(guild.id);
    }

    await ensureVerificationFormat(client);

    const qotdCmd = client.commands.get('qotd');
    const awarenessCmd = client.commands.get('awareness');

    setInterval(async () => {
        try {
            const now = new Date();
            const estString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
            const estDate = new Date(estString);
            const estHour = estDate.getHours();
            const estMin = estDate.getMinutes();
            const estDay = estDate.getDay();
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const todayName = dayNames[estDay];

            if (estDay === 0 && estHour === 23 && estMin === 0) {
                try {
                    const weekStart = qotdCmd.getWeekStart();
                    const existing = await QotdSchedule.findOne({ weekStart });
                    if (!existing) {
                        const reminderChannel = await client.channels.fetch(qotdCmd.REMINDER_CHANNEL_ID).catch(() => null);
                        const logChannel = await client.channels.fetch(qotdCmd.LOG_CHANNEL_ID).catch(() => null);
                        const lastSchedule = await QotdSchedule.findOne({}).sort({ createdAt: -1 });

                        if (lastSchedule && reminderChannel) {
                            const posted = qotdCmd.DAYS.filter(d => lastSchedule.days[d]?.completed);
                            const notPosted = qotdCmd.DAYS.filter(d => lastSchedule.days[d]?.userId && !lastSchedule.days[d]?.completed);
                            const unclaimed = qotdCmd.DAYS.filter(d => !lastSchedule.days[d]?.userId);

                            const postedLines = posted.length > 0 ? posted.map(d => `✅ **${d}** — <@${lastSchedule.days[d].userId}>`).join('\n') : 'None';
                            const notPostedLines = notPosted.length > 0 ? notPosted.map(d => `❌ **${d}** — <@${lastSchedule.days[d].userId}>`).join('\n') : 'None';
                            const unclaimedLines = unclaimed.length > 0 ? unclaimed.map(d => `⚪ **${d}**`).join('\n') : 'None';

                            await reminderChannel.send({
                                content: `<@&${qotdCmd.QOTD_ROLE_ID}>`,
                                embeds: [new EmbedBuilder()
                                    .setTitle('📊 Weekly QOTD Summary')
                                    .setDescription(
                                        `The week has come to an end! Here's how we did this week. 💜\n\n` +
                                        `**✅ Posted:**\n${postedLines}\n\n` +
                                        `**❌ Claimed but not posted:**\n${notPostedLines}\n\n` +
                                        `**⚪ Unclaimed:**\n${unclaimedLines}\n\n` +
                                        `${posted.length > 0 ? `Amazing work to everyone who posted this week — you're all stars! 🌟\n\n` : ''}` +
                                        `The schedule will reset shortly. A staff member will post the new schedule soon — make sure to claim your days! 📅`
                                    )
                                    .setColor(0x9B59B6)
                                    .setFooter({ text: 'Kavià Café — QOTD System' })
                                    .setTimestamp()],
                                allowedMentions: { roles: [qotdCmd.QOTD_ROLE_ID] }
                            });

                            if (logChannel) {
                                await logChannel.send({
                                    embeds: [new EmbedBuilder()
                                        .setTitle('🔄 QOTD Weekly Auto-Reset')
                                        .setColor('Purple')
                                        .addFields(
                                            { name: 'Posted', value: postedLines, inline: false },
                                            { name: 'Not Posted', value: notPostedLines, inline: false },
                                            { name: 'Unclaimed', value: unclaimedLines, inline: false },
                                            { name: 'Date', value: new Date().toLocaleString(), inline: false }
                                        )
                                        .setTimestamp()]
                                });
                            }
                        }

                        await QotdSchedule.create({ weekStart, days: {}, messageId: null });
                        console.log('✅ QOTD schedule reset for new week');
                    }
                } catch (err) {
                    console.error('Failed to reset QOTD:', err);
                }
            }

            if (estHour === 9 && estMin === 0) {
                try {
                    const weekStart = qotdCmd.getWeekStart();
                    const schedule = await QotdSchedule.findOne({ weekStart });
                    if (schedule) {
                        const entry = schedule.days[todayName];
                        if (entry?.userId) {
                            const reminderChannel = await client.channels.fetch(qotdCmd.REMINDER_CHANNEL_ID).catch(() => null);
                            if (reminderChannel) {
                                const row = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`qotd_posted_${todayName}`)
                                        .setLabel('✅ I\'ve Posted My QOTD!')
                                        .setStyle(ButtonStyle.Success)
                                );
                                await reminderChannel.send({
                                    content: `<@${entry.userId}>`,
                                    embeds: [new EmbedBuilder()
                                        .setTitle('📅 QOTD Reminder!')
                                        .setDescription(
                                            `Hey <@${entry.userId}>! 👋\n\n` +
                                            `You have claimed **${todayName}** for QOTD this week!\n\n` +
                                            `Please make sure to post your Question of the Day today. Once you've posted it, click the button below to mark it as complete! ✨\n\n` +
                                            `Remember — completing your QOTD is **required** at least once a week! 💜`
                                        )
                                        .setColor(0x9B59B6)
                                        .setFooter({ text: 'Kavià Café — QOTD System' })
                                        .setTimestamp()],
                                    components: [row]
                                });
                                schedule.days[todayName].reminderSent = true;
                                schedule.markModified('days');
                                await schedule.save();
                            }
                        }
                    }
                } catch (err) {
                    console.error('Failed to send QOTD reminder:', err);
                }

                try {
                    if (awarenessCmd) {
                        const monthKey = awarenessCmd.getMonthKey();
                        const awarenessSchedule = await AwarenessSchedule.findOne({ monthKey });
                        if (awarenessSchedule) {
                            const todayString = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric' });
                            const awarenessChannel = await client.channels.fetch(awarenessCmd.AWARENESS_CHANNEL_ID).catch(() => null);
                            if (awarenessChannel) {
                                for (const entry of awarenessSchedule.entries) {
                                    if (!entry.approved || entry.completed) continue;
                                    if (entry.date.toLowerCase().includes(todayString.toLowerCase()) || todayString.toLowerCase().includes(entry.date.toLowerCase())) {
                                        const row = new ActionRowBuilder().addComponents(
                                            new ButtonBuilder()
                                                .setCustomId(`awareness_posted_${entry.entryId}`)
                                                .setLabel('✅ I\'ve Posted My Awareness!')
                                                .setStyle(ButtonStyle.Success)
                                        );
                                        await awarenessChannel.send({
                                            content: `<@${entry.userId}>`,
                                            embeds: [new EmbedBuilder()
                                                .setTitle('📢 Awareness Reminder!')
                                                .setDescription(
                                                    `Hey <@${entry.userId}>! 👋\n\n` +
                                                    `Today is your day to post your awareness!\n\n` +
                                                    `**Title:** ${entry.title}\n\n` +
                                                    `Please make sure to get it posted today. Once you have, click the button below to mark it as complete! ✨💜`
                                                )
                                                .setColor(0x9B59B6)
                                                .setFooter({ text: 'Kavià Café — Awareness Schedule' })
                                                .setTimestamp()],
                                            components: [row]
                                        });
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('Failed to send awareness reminder:', err);
                }
            }

            if (estHour === 21 && estMin === 0) {
                try {
                    const weekStart = qotdCmd.getWeekStart();
                    const schedule = await QotdSchedule.findOne({ weekStart });
                    if (schedule) {
                        const entry = schedule.days[todayName];
                        if (entry?.userId && !entry.completed) {
                            const reminderChannel = await client.channels.fetch(qotdCmd.REMINDER_CHANNEL_ID).catch(() => null);
                            if (reminderChannel) {
                                const row = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`qotd_posted_${todayName}`)
                                        .setLabel('✅ I\'ve Posted My QOTD!')
                                        .setStyle(ButtonStyle.Success)
                                );
                                await reminderChannel.send({
                                    content: `<@${entry.userId}>`,
                                    embeds: [new EmbedBuilder()
                                        .setTitle('⏰ QOTD Follow-Up Reminder!')
                                        .setDescription(
                                            `Hey <@${entry.userId}>! 👋\n\n` +
                                            `Just a follow-up — we haven't seen your **${todayName}** QOTD posted yet!\n\n` +
                                            `Please make sure to get it posted before the day ends. Click the button below once you have! 💜`
                                        )
                                        .setColor('Orange')
                                        .setFooter({ text: 'Kavià Café — QOTD System' })
                                        .setTimestamp()],
                                    components: [row]
                                });
                            }
                        }
                    }
                } catch (err) {
                    console.error('Failed to send QOTD follow-up reminder:', err);
                }
            }

            // ── Missing rep check every 48 hours ──
            try {
                const { loadAlliances } = require('./utils/allianceStorage');
                client._missingRepNotices = client._missingRepNotices || new Map();
                const now48 = Date.now();
                const alliances = await loadAlliances();

                for (const alliance of alliances) {
                    if (!alliance.welcomeChannelId) continue;
                    const theirRepIds = alliance.theirRepIds || [];
                    if (theirRepIds.length >= 2) continue;

                    const lastSent = client._missingRepNotices.get(alliance.groupName) || 0;
                    if (now48 - lastSent < 48 * 60 * 60 * 1000) continue;

                    const allianceChannel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
                    if (!allianceChannel) continue;

                    await allianceChannel.send({
                        content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                        embeds: [new EmbedBuilder()
                            .setTitle('👥 Missing Representative')
                            .setDescription(
                                `Hey there! 👋\n\n` +
                                `We noticed that **${alliance.groupName}** currently only has **${theirRepIds.length === 0 ? 'no representatives' : '1 representative'}** registered in our Alliance Hub.\n\n` +
                                `All alliances are required to have **2 representatives** in the hub at all times.\n\n` +
                                `**What to do:**\n` +
                                `• Have your second representative join the **Kavià Alliance Hub**\n` +
                                `• Have them verify in <#${VERIFICATION_CHANNEL_ID}>\n` +
                                `• A PR staff member will then assign them the correct roles\n\n` +
                                `If you have any questions or need assistance, please reach out to **PR Leadership**. 💜\n\n` +
                                `🔗 [Discord Server](${KAVIA_DISCORD}) • [Roblox Group](${KAVIA_ROBLOX})`
                            )
                            .setColor('Yellow')
                            .setFooter({ text: 'Kavià Café — Alliance Hub • This notice sends every 48 hours until resolved' })
                            .setTimestamp()],
                        allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                    });

                    client._missingRepNotices.set(alliance.groupName, now48);
                }
            } catch (err) {
                console.error('Failed to check missing reps:', err);
            }

// ── Checkin + Topost interval-based reminders ──
            try {
                const checkinCmd = client.commands.get('checkin');
                const topostCmd = client.commands.get('topost');
                const now = Date.now();
                const HOUR_24 = 24 * 60 * 60 * 1000;
                const HOUR_48 = 48 * 60 * 60 * 1000;

                // ── Checkin reminders ──
                if (checkinCmd?.activeCheckins) {
                    for (const [channelId, c] of checkinCmd.activeCheckins.entries()) {
                        if (c.responded || c.confirmed || c.noResponse) continue;
                        const elapsed = now - c.startedAt;

                        if (elapsed >= HOUR_24 && !c.reminder24Sent) {
                            c.reminder24Sent = true;
                            try {
                                const ch = await client.channels.fetch(channelId).catch(() => null);
                                if (ch) {
                                    await ch.send({
                                        content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                                        embeds: [new EmbedBuilder()
                                            .setDescription(
                                                `⏰ **Friendly Reminder!**\n\n` +
                                                `You still have a pending **alliance check-in** that needs to be completed.\n\n` +
                                                `You have **24 hours** remaining to respond to the 5 questions. Please make sure to do so as soon as possible!\n\n` +
                                                `Failure to respond may result in a **strike** against your alliance.`
                                            )
                                            .setColor('Yellow')
                                            .setFooter({ text: 'Kavià Café — Public Relations Department' })
                                            .setTimestamp()],
                                        allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                                    });
                                }
                            } catch (err) {
                                console.error('Failed to send checkin 24hr reminder:', err);
                            }
                        }

                        if (elapsed >= HOUR_48) {
                            c.noResponse = true;
                            try {
                                const ch = await client.channels.fetch(channelId).catch(() => null);
                                const logCh = await client.channels.fetch('1482430133561196625').catch(() => null);

                                if (ch) {
                                    await ch.send({
                                        content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                                        embeds: [new EmbedBuilder()
                                            .setDescription(
                                                `⚠️ **Check-In Deadline Passed**\n\n` +
                                                `The 48 hour check-in window has passed without a response. PR Leadership has been notified.\n\n` +
                                                `If you have a valid reason for the delay, please reach out to **PR Leadership** immediately.`
                                            )
                                            .setColor('Red')
                                            .setFooter({ text: 'Kavià Café — Public Relations Department' })
                                            .setTimestamp()],
                                        allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                                    });
                                }

                                if (logCh) {
                                    await logCh.send({
                                        embeds: [new EmbedBuilder()
                                            .setTitle('⚠️ Check-In — No Response')
                                            .setColor('Red')
                                            .addFields(
                                                { name: 'Alliance', value: c.groupName, inline: true },
                                                { name: 'Status', value: '❌ No response within 48 hours', inline: true },
                                                { name: 'Channel', value: `<#${channelId}>`, inline: true },
                                                { name: 'Date', value: new Date().toLocaleString(), inline: false }
                                            )
                                            .setTimestamp()]
                                    });
                                }
                            } catch (err) {
                                console.error('Failed to send checkin 48hr deadline:', err);
                            }
                            checkinCmd.activeCheckins.delete(channelId);
                        }
                    }
                }

                // ── Topost reminders ──
                if (topostCmd?.activeToposts) {
                    for (const [key, t] of topostCmd.activeToposts.entries()) {
                        if (t.responded || t.confirmed || t.noResponse) continue;
                        const elapsed = now - t.startedAt;

                        if (elapsed >= HOUR_24 && !t.reminder24Sent) {
                            t.reminder24Sent = true;
                            try {
                                const ch = await client.channels.fetch(t.channelId).catch(() => null);
                                if (ch) {
                                    await ch.send({
                                        content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                                        embeds: [new EmbedBuilder()
                                            .setDescription(
                                                `⏰ **Friendly Reminder!**\n\n` +
                                                `You still have a pending post that needs to be shared in your server.\n\n` +
                                                `You have **24 hours** remaining before the deadline. Please make sure to get this posted as soon as possible.\n\n` +
                                                `If you need assistance or require an extension, please reach out to **PR Leadership** right away.`
                                            )
                                            .setColor('Yellow')
                                            .setFooter({ text: 'Kavià Café — Public Relations Department' })
                                            .setTimestamp()],
                                        allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                                    });
                                }
                            } catch (err) {
                                console.error('Failed to send topost 24hr reminder:', err);
                            }
                        }

                        if (elapsed >= HOUR_48) {
                            t.noResponse = true;
                            try {
                                const ch = await client.channels.fetch(t.channelId).catch(() => null);
                                const logCh = await client.channels.fetch('1482430133561196625').catch(() => null);

                                if (ch) {
                                    await ch.send({
                                        content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                                        embeds: [new EmbedBuilder()
                                            .setDescription(
                                                `⚠️ **Deadline Passed**\n\n` +
                                                `The 48 hour posting deadline has passed without confirmation. PR Leadership has been notified.\n\n` +
                                                `If you have a valid reason for the delay, please reach out to **PR Leadership** immediately.`
                                            )
                                            .setColor('Red')
                                            .setFooter({ text: 'Kavià Café — Public Relations Department' })
                                            .setTimestamp()],
                                        allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                                    });
                                }

                                if (logCh) {
                                    await logCh.send({
                                        embeds: [new EmbedBuilder()
                                            .setTitle('⚠️ To Post — No Confirmation')
                                            .setColor('Red')
                                            .addFields(
                                                { name: 'Alliance', value: t.groupName, inline: true },
                                                { name: 'Status', value: '❌ No confirmation within 48 hours', inline: true },
                                                { name: 'Channel', value: `<#${t.channelId}>`, inline: true },
                                                { name: 'Date', value: new Date().toLocaleString(), inline: false }
                                            )
                                            .setTimestamp()]
                                    });
                                }
                            } catch (err) {
                                console.error('Failed to send topost 48hr deadline:', err);
                            }
                            topostCmd.activeToposts.delete(key);
                        }
                    }
                }

            } catch (err) {
                console.error('Failed to process checkin/topost reminders:', err);
            }

        } catch (err) {
            console.error('Scheduler error:', err);
        }
    }, 60 * 1000);
});

client.on('guildCreate', async (guild) => {
    console.log(`Joined new guild: ${guild.name}`);
    if (!ALLOWED_GUILD_IDS.includes(guild.id)) {
        console.log(`❌ Unauthorized guild ${guild.name} (${guild.id}) — leaving.`);
        await guild.leave();
        return;
    }
    await deployToGuild(guild.id);
});

// Welcome message
client.on('guildMemberAdd', async (member) => {
    if (member.guild.id !== ALLIANCE_GUILD_ID) return;
    const channel = await client.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle('☕ Welcome to Kavià | Alliance Hub!')
        .setDescription(
            `Hey there, <@${member.id}>! We're so glad to have you here. 💜\n\n` +
            `**Kavià Alliance Hub** is the home of our allied representatives and partnerships.\n\n` +
            `**Here's what to do next:**\n` +
            `• ✅ Head over to <#${VERIFICATION_CHANNEL_ID}> and verify yourself\n` +
            `• 👥 Make sure you're an **Allied Representative** — if you're unsure, reach out to a member of PR Leadership\n` +
            `• ⚠️ Please note that members who are not Allied Representatives may be removed\n\n` +
            `If you have any questions, don't hesitate to reach out. We're happy to help!\n\n` +
            `**— Kavià Café | PR Leadership** ☕`
        )
        .setColor(0x9B59B6)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Kavià Café — Public Relations Department' })
        .setTimestamp();

    await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
});

// Role restriction + command handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

if (!ALLOWED_GUILD_IDS.includes(interaction.guildId)) {
        return interaction.reply({ content: '❌ This bot is not authorized for this server.', ephemeral: true });
    }

    const role = interaction.guild?.roles.cache.get(ALLOWED_ROLE_ID);
    if (role) {
        const member = interaction.member;
        if (!member?.roles.cache.has(ALLOWED_ROLE_ID)) {
            return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
        }
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction, client);
    } catch (err) {
        console.error(`Error executing ${interaction.commandName}:`, err);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('❌ There was an error executing this command.');
        } else {
            await interaction.reply({ content: '❌ There was an error executing this command.', ephemeral: true });
        }
    }
});

// Handle autocomplete
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isAutocomplete()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command?.autocomplete) return;

    try {
        await command.autocomplete(interaction);
    } catch (err) {
        console.error(`Error handling autocomplete for ${interaction.commandName}:`, err);
    }
});

// Handle select menus
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;

if (interaction.customId.startsWith('sendsome_select_')) {
        const sendsome = client.commands.get('sendsome');
        if (sendsome) await sendsome.handleSelectMenu(interaction, client);
        return;
    }
  if (interaction.customId.startsWith('verify_staff_pick_alliance_')) {
        try {
            const withoutPrefix = interaction.customId.replace('verify_staff_pick_alliance_', '');
            const firstUnderscore = withoutPrefix.indexOf('_');
            const userId = withoutPrefix.substring(0, firstUnderscore);
            const messageId = withoutPrefix.substring(firstUnderscore + 1);
            const selectedAlliance = interaction.values[0];

            let pending = pendingVerifications.get(messageId);
            if (!pending) {
                pending = { userId, selectedAlliance: null };
                pendingVerifications.set(messageId, pending);
            }
            pending.selectedAlliance = selectedAlliance;

            await interaction.update({
                embeds: [EmbedBuilder.from(interaction.message.embeds[0])
                    .setTitle('📋 Verification — Alliance Identified by Staff')
                    .setColor(0x9B59B6)
                    .setFooter({ text: `Alliance set to: ${selectedAlliance} • by ${interaction.user.tag}` })],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`verify_accept_${userId}_${messageId}`)
                        .setLabel('✅ Accept')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`verify_deny_${userId}_${messageId}`)
                        .setLabel('❌ Deny')
                        .setStyle(ButtonStyle.Danger)
                )]
            });
        } catch (err) {
            console.error('Error handling verify_staff_pick_alliance:', err);
        }
        return;
    }

  if (interaction.customId.startsWith('verify_alliance_select_')) {
        try {
            const messageId = interaction.customId.replace('verify_alliance_select_', '');
            const selectedAlliance = interaction.values[0];
            const pending = pendingVerifications.get(messageId);

            if (!pending) {
                return interaction.update({ content: '❌ This verification session has expired. Please resubmit your verification.', components: [] });
            }

            pending.selectedAlliance = selectedAlliance;
            const isStaff = selectedAlliance === '__STAFF__';

            // Staff path — skip Roblox checks, go straight to staff log as before
            if (isStaff) {
                await interaction.update({
                    content: `✅ Got it! You've selected **Staff Member**. Your verification is now being reviewed by staff — you'll be notified via DM once a decision has been made. 💜`,
                    components: []
                });

                const verifyLogChannel = await client.channels.fetch(VERIFICATION_LOG_CHANNEL_ID).catch(() => null);
                if (!verifyLogChannel) return;

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`verify_accept_${pending.userId}_${messageId}`)
                        .setLabel('✅ Accept')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`verify_deny_${pending.userId}_${messageId}`)
                        .setLabel('❌ Deny')
                        .setStyle(ButtonStyle.Danger)
                );

                const embed = new EmbedBuilder()
                    .setTitle('📋 New Verification Submission')
                    .setColor(0x9B59B6)
                    .addFields(
                        { name: 'User', value: `<@${pending.userId}> (${pending.userTag})`, inline: true },
                        { name: 'Submitted At', value: new Date().toLocaleString(), inline: true },
                        { name: 'Alliance Selected', value: '👤 Staff Member', inline: false },
                        { name: 'Staff Role', value: `<@&1417981534421520515>`, inline: true },
                        { name: 'Message Content', value: pending.content || '*No text*', inline: false }
                    )
                    .setFooter({ text: 'Kavià Café — Staff Verification • Remember to add any additional roles needed' })
                    .setTimestamp();

                if (pending.imageUrl) embed.setImage(pending.imageUrl);

                await verifyLogChannel.send({
                    content: `<@&${ALLOWED_ROLE_ID}>`,
                    embeds: [embed],
                    components: [row],
                    allowedMentions: { roles: [ALLOWED_ROLE_ID] }
                });

                try { await interaction.message.delete().catch(() => {}); } catch {}

               return;
            }

            // Not found path
            if (selectedAlliance === '__NOT_FOUND__') {
                const notFoundRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`verify_enter_username_${pending.userId}_${messageId}___NOT_FOUND__`)
                        .setLabel('Enter Roblox Username')
                        .setStyle(ButtonStyle.Primary)
                );

                await interaction.update({
                    embeds: [new EmbedBuilder()
                        .setTitle('❓ Alliance Not Listed')
                        .setDescription(
                            `No worries! Click the button below to enter your Roblox username and tell us your alliance name — a staff member will manually assign your roles. 💜\n\n` +
                            `*Only you can see this message.*`
                        )
                        .setColor('Yellow')
                        .setFooter({ text: 'Kavià Café — Alliance Hub Verification' })
                        .setTimestamp()],
                    components: [notFoundRow],
                    content: ''
                });
                return;
            }

            // Alliance path — show Roblox username button
            const enterUsernameRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`verify_enter_username_${pending.userId}_${messageId}_${selectedAlliance.replace(/\s+/g, '_')}`)
                    .setLabel('Enter Roblox Username')
                    .setStyle(ButtonStyle.Primary)
            );

           await interaction.update({
                embeds: [new EmbedBuilder()
                    .setTitle('✅ Alliance Selected')
                    .setDescription(
                        `You selected **${selectedAlliance}**.\n\n` +
                        `Click the button below to enter your Roblox username so we can verify your eligibility. 💜\n\n` +
                        `*Only you can see this message.*`
                    )
                    .setColor(0x9B59B6)
                    .setFooter({ text: 'Kavià Café — Alliance Hub Verification' })
                    .setTimestamp()],
                components: [enterUsernameRow],
                content: ''
            });



        } catch (err) {
            console.error('Error handling alliance verify select:', err);
        }
        return;
    }
});

// Handle buttons
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'claim_rep') {
        try {
            const originalEmbed = interaction.message.embeds[0];
            const updatedEmbed = EmbedBuilder.from(originalEmbed)
                .setColor('Grey')
                .setTitle('📥 Rep Request — Claimed')
                .addFields({ name: 'Claimed By', value: `${interaction.user}`, inline: false });
            await interaction.update({ embeds: [updatedEmbed], components: [] });
        } catch (err) {
            console.error('Error handling claim_rep button:', err);
        }
        return;
    }

    if (interaction.customId === 'prev_post' || interaction.customId === 'next_post') {
        const allianceListPost = client.commands.get('alliance-list-post');
        if (allianceListPost) await allianceListPost.handlePageButton(interaction);
        return;
    }

    if (interaction.customId.startsWith('checkin_confirm_')) {
        const checkin = client.commands.get('checkin');
        if (checkin) await checkin.handleButton(interaction, client);
        return;
    }

    if (interaction.customId.startsWith('topost_')) {
        const topost = client.commands.get('topost');
        if (topost) await topost.handleButton(interaction, client);
        return;
    }

    if (interaction.customId.startsWith('qotd_')) {
        const qotd = client.commands.get('qotd');
        if (qotd) await qotd.handleButton(interaction, client);
        return;
    }

    if (interaction.customId.startsWith('awareness_')) {
        const awareness = client.commands.get('awareness');
        if (awareness) await awareness.handleButton(interaction, client);
        return;
    }

    if (interaction.customId.startsWith('appeal_')) {
        const appeal = require('./commands/appeal');
        await appeal.handleButton(interaction, client);
        return;
    }

    if (interaction.customId.startsWith('sendall_poll_vote_')) {
        const sendall = client.commands.get('sendall');
        if (sendall) await sendall.handleButton(interaction, client);
        return;
    }

    if (interaction.customId.startsWith('sendsome_compose_')) {
        const sendsome = client.commands.get('sendsome');
        if (sendsome) await sendsome.handleButton(interaction, client);
        return;
    }
    if (interaction.customId.startsWith('healthcheck_alert_') ||
        interaction.customId.startsWith('healthcheck_addlink_')) {
        const healthCheck = client.commands.get('health-check');
        if (healthCheck) await healthCheck.handleButton(interaction, client);
        return;
    }
    if (interaction.customId.startsWith('sendall_poll_close_')) {
        const sendall = client.commands.get('sendall');
        if (sendall) await sendall.handleButton(interaction, client);
        return;
    }

    if (interaction.customId.startsWith('sendsome_poll_close_')) {
        const sendsome = client.commands.get('sendsome');
        if (sendsome) await sendsome.handleButton(interaction, client);
        return;
    }
    if (interaction.customId.startsWith('sendsome_poll_vote_')) {
        const sendsome = client.commands.get('sendsome');
        if (sendsome) await sendsome.handleButton(interaction, client);
        return;
    }
    if (interaction.customId.startsWith('event_attend_') ||
        interaction.customId.startsWith('event_decline_') ||
        interaction.customId.startsWith('event_reschedule_')) {
        const eventRequest = client.commands.get('event-request');
        if (eventRequest) await eventRequest.handleButton(interaction, client);
        return;
    }

    // ── Verification enter username button ──
    if (interaction.customId.startsWith('verify_enter_username_')) {
        try {
            const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
            const withoutPrefix = interaction.customId.replace('verify_enter_username_', '');
            const firstUnderscore = withoutPrefix.indexOf('_');
            const secondUnderscore = withoutPrefix.indexOf('_', firstUnderscore + 1);
            const userId = withoutPrefix.substring(0, firstUnderscore);
            const messageId = withoutPrefix.substring(firstUnderscore + 1, secondUnderscore);
            const allianceName = withoutPrefix.substring(secondUnderscore + 1).replace(/_/g, ' ');

            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ This is not your verification session.', ephemeral: true });
            }

            const isNotFound = allianceName.trim() === '__NOT FOUND__' || allianceName.trim() === '__NOT_FOUND__';

            const modal = new ModalBuilder()
                .setCustomId(`verify_username_modal_${userId}_${messageId}_${allianceName.replace(/\s+/g, '_')}`)
                .setTitle('Roblox Username Verification');

            const modalComponents = [
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('roblox_username')
                        .setLabel('Your Roblox Username')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. RobloxUser123')
                        .setRequired(true)
                        .setMaxLength(50)
                )
            ];

            if (isNotFound) {
                modalComponents.push(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('alliance_name_claim')
                            .setLabel('What alliance do you represent?')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('e.g. Sakura Cafe')
                            .setRequired(true)
                            .setMaxLength(100)
                    )
                );
            }

            modal.addComponents(...modalComponents);
            await interaction.showModal(modal);
        } catch (err) {
            console.error('Error handling verify_enter_username:', err);
        }
        return;
    }

    // ── Verification recheck button ──
    if (interaction.customId.startsWith('verify_recheck_')) {
        try {
            const withoutPrefix = interaction.customId.replace('verify_recheck_', '');
            const firstUnderscore = withoutPrefix.indexOf('_');
            const secondUnderscore = withoutPrefix.indexOf('_', firstUnderscore + 1);
            const thirdUnderscore = withoutPrefix.indexOf('_', secondUnderscore + 1);
            const userId = withoutPrefix.substring(0, firstUnderscore);
            const messageId = withoutPrefix.substring(firstUnderscore + 1, secondUnderscore);
            const robloxUsername = withoutPrefix.substring(secondUnderscore + 1, thirdUnderscore);
            const allianceName = withoutPrefix.substring(thirdUnderscore + 1).replace(/_/g, ' ');

            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ This is not your verification session.', ephemeral: true });
            }

            await interaction.deferUpdate();

            const axios = require('axios');

            let robloxUserId = null;
            try {
                const userRes = await axios.post('https://users.roblox.com/v1/usernames/users', {
                    usernames: [robloxUsername],
                    excludeBannedUsers: false
                });
                robloxUserId = userRes.data?.data?.[0]?.id || null;
            } catch (err) {
                console.error('Roblox username lookup failed:', err);
            }

            if (!robloxUserId) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Roblox Username Not Found')
                        .setDescription(
                            `We couldn't find a Roblox account with the username **${robloxUsername}**.\n\n` +
                            `Please post in <#${VERIFICATION_CHANNEL_ID}> again to restart your verification.`
                        )
                        .setColor('Red')
                        .setFooter({ text: 'Kavià Café — Alliance Hub Verification' })
                        .setTimestamp()],
                    components: []
                });
            }

            let inKaviaGroup = false;
            try {
                const groupRes = await axios.get(`https://groups.roblox.com/v1/users/${robloxUserId}/groups/roles`);
                const groups = groupRes.data?.data || [];
                inKaviaGroup = groups.some(g => g.group?.id === KAVIA_ROBLOX_GROUP_ID);
            } catch (err) {
                console.error('Roblox group check failed:', err);
            }

            if (!inKaviaGroup) {
                const recheckRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`verify_recheck_${userId}_${messageId}_${robloxUsername}_${allianceName.replace(/\s+/g, '_')}`)
                        .setLabel('🔄 Re-check Eligibility')
                        .setStyle(ButtonStyle.Primary)
                );

                return interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Not in Kavià Roblox Group')
                        .setDescription(
                            `**${robloxUsername}** is still not a member of the **Kavià Café** Roblox group.\n\n` +
                            `👉 **[Join the Kavià Café Roblox Group](https://www.roblox.com/communities/${KAVIA_ROBLOX_GROUP_ID})**\n\n` +
                            `Once you've joined, click the button below to re-check. 💜`
                        )
                        .setColor('Red')
                        .setFooter({ text: 'Kavià Café — Alliance Hub Verification' })
                        .setTimestamp()],
                    components: [recheckRow]
                });
            }

            await handleVerificationPass(interaction, client, userId, messageId, allianceName, robloxUsername, robloxUserId);

        } catch (err) {
            console.error('Error handling verify_recheck:', err);
        }
        return;
    }
    // ── Verification Accept ──
    if (interaction.customId.startsWith('verify_accept_')) {
        try {
            const parts = interaction.customId.replace('verify_accept_', '').split('_');
            const userId = parts[0];
            const messageId = parts[1];

            const guild = await client.guilds.fetch(ALLIANCE_GUILD_ID).catch(() => null);
            if (!guild) return interaction.reply({ content: '❌ Guild not found.', ephemeral: true });

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return interaction.reply({ content: '❌ Member not found — they may have left the server.', ephemeral: true });

            const pending = pendingVerifications.get(messageId);
            let allianceName = null;
            let allianceChannel = null;
            let isStaffVerification = pending?.selectedAlliance === '__STAFF__';

            if (isStaffVerification) {
                await member.roles.add('1417981534421520515').catch(console.error);
            } else {
                // Give Allied Reps role
                await member.roles.add(ALLIED_REPS_ROLE_ID).catch(console.error);
            }

            if (pending?.selectedAlliance && !isStaffVerification) {
                const { findAlliance, saveAlliance } = require('./utils/allianceStorage');
                const alliance = await findAlliance(pending.selectedAlliance).catch(() => null);

                if (alliance) {
                    allianceName = alliance.groupName;

                    // Give alliance rep role
                    if (alliance.repRoleId) {
                        await member.roles.add(alliance.repRoleId).catch(console.error);
                    }

                    // Add to theirRepIds in MongoDB
                    if (!alliance.theirRepIds.includes(userId)) {
                        alliance.theirRepIds.push(userId);
                        alliance.theirReps = alliance.theirRepIds.map(id => `<@${id}>`).join(' ');
                        alliance.markModified('theirRepIds');
                        alliance.markModified('theirReps');
                        await saveAlliance(alliance).catch(console.error);
                    }

                    // Send welcome message in alliance channel
                    if (alliance.welcomeChannelId) {
                        allianceChannel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
                        if (allianceChannel) {
                            await allianceChannel.send({
                                content: `<@&${alliance.repRoleId || ALLIED_REPS_ROLE_ID}>`,
                                embeds: [new EmbedBuilder()
                                    .setTitle('🎉 New Representative Verified!')
                                    .setDescription(
                                        `Hey everyone! 👋 Please welcome your newest verified representative — <@${userId}>! 🎊\n\n` +
                                        `<@${userId}> has been verified by PR Leadership and now has full access as an **Allied Representative** for **${allianceName}**.\n\n` +
                                        `We're so glad to have you here — welcome to the Kavià Alliance Hub! ☕💜`
                                    )
                                    .setColor(0x9B59B6)
                                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                                    .setFooter({ text: 'Kavià Café — Alliance Hub' })
                                    .setTimestamp()],
                                allowedMentions: { roles: [alliance.repRoleId || ALLIED_REPS_ROLE_ID] }
                            });
                        }
                    }
                }

                pendingVerifications.delete(messageId);
            }

        // Delete original verification message and prompt message
            if (messageId) {
                const verifyChannel = await client.channels.fetch(VERIFICATION_CHANNEL_ID).catch(() => null);
                if (verifyChannel) {
                    const originalMsg = await verifyChannel.messages.fetch(messageId).catch(() => null);
                    if (originalMsg) await originalMsg.delete().catch(console.error);
                    if (pending?.promptMessageId) {
                        const promptMsg = await verifyChannel.messages.fetch(pending.promptMessageId).catch(() => null);
                        if (promptMsg) await promptMsg.delete().catch(console.error);
                    }
                }
            }

            // Update the log message
            await interaction.update({
                embeds: [EmbedBuilder.from(interaction.message.embeds[0])
                    .setTitle('✅ Verification — Accepted')
                    .setColor('Green')
                    .addFields({ name: 'Reviewed By', value: interaction.user.tag, inline: true })],
                components: []
            });

            // DM the user
            try {
                await member.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('✅ Verification Accepted!')
                        .setDescription(
                            isStaffVerification ?
                            (`Hey <@${userId}>! 🎉\n\n` +
                            `Your verification has been **accepted** by PR Leadership!\n\n` +
                            `You have been given the **Staff** role. If you require any additional roles, please reach out to PR Leadership.\n\n` +
                            `Welcome to the team! ☕💜`)
                            :
                            (`Hey <@${userId}>! 🎉\n\n` +
                            `Your verification has been **accepted** by PR Leadership!\n\n` +
                            `You have been given the following:\n` +
                            `• ✅ **Allied Representative** role\n` +
                            `${allianceName ? `• ✅ **${allianceName}** representative role\n` : ''}` +
                            `${allianceChannel ? `• ✅ Access to <#${allianceChannel.id}>\n` : ''}\n` +
                            `You now have full access to your alliance channel. If you have any questions, feel free to reach out to PR Leadership.\n\n` +
                            `Welcome to the hub! ☕💜`)
                        )
                        .setColor(0x9B59B6)
                        .setFooter({ text: 'Kavià Café — Alliance Hub' })
                        .setTimestamp()]
                });
            } catch (err) {
                console.error(`Failed to DM ${userId} on verify accept:`, err);
            }

            // Remind staff to add additional roles if this was a staff verification
            if (isStaffVerification) {
                try {
                    const verifyLogChannel = await client.channels.fetch(VERIFICATION_LOG_CHANNEL_ID).catch(() => null);
                    if (verifyLogChannel) {
                        await verifyLogChannel.send({
                            content: `<@${interaction.user.id}> reminder: <@${userId}> was verified as **Staff** and given the staff role. Please make sure to add any other roles they may need (department roles, rank roles, etc.) manually. 💜`
                        });
                    }
                } catch (err) {
                    console.error('Failed to send staff role reminder:', err);
                }
            }

        } catch (err) {
            console.error('Error handling verify_accept button:', err);
        }
        return;
    }

    // ── Verification Deny ──
    if (interaction.customId.startsWith('verify_deny_')) {
        try {
            const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
            const parts = interaction.customId.replace('verify_deny_', '').split('_');
            const userId = parts[0];
            const messageId = parts[1];

            const modal = new ModalBuilder()
                .setCustomId(`verify_deny_modal_${userId}_${messageId}`)
                .setTitle('Deny Verification');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('deny_reason')
                        .setLabel('Reason for denial')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('e.g. Missing proof of invite, incorrect format, etc.')
                        .setRequired(true)
                        .setMaxLength(500)
                )
            );

            await interaction.showModal(modal);
        } catch (err) {
            console.error('Error handling verify_deny button:', err);
        }
        return;
    }

    // ── Alliance edit kick prompt ──
    if (interaction.customId.startsWith('edit_kick_yes_')) {
        try {
            const withoutPrefix = interaction.customId.replace('edit_kick_yes_', '');
            const parts = withoutPrefix.split('_');
            const repIdsRaw = parts[parts.length - 1];
            const repIds = repIdsRaw.split('-');

            const guild = await client.guilds.fetch(interaction.guildId).catch(() => null);
            if (!guild) return interaction.reply({ content: '❌ Guild not found.', ephemeral: true });

            let kicked = 0;
            let failed = 0;
            for (const repId of repIds) {
                const member = await guild.members.fetch(repId).catch(() => null);
                if (member) {
                    await member.kick('Removed as alliance rep').catch(console.error);
                    kicked++;
                } else {
                    failed++;
                }
            }

            await interaction.update({
                content: `✅ Done! Kicked **${kicked}** rep(s)${failed > 0 ? ` — **${failed}** could not be found` : ''}.`,
                components: []
            });
        } catch (err) {
            console.error('Error handling edit_kick_yes button:', err);
        }
        return;
    }

    if (interaction.customId.startsWith('edit_kick_no_')) {
        await interaction.update({
            content: '✅ Alliance updated. Removed reps were kept in the server.',
            components: []
        });
        return;
    }

    // ── Strike acknowledgement ──
    if (interaction.customId.startsWith('strike_understood_')) {
        try {
            const parts = interaction.customId.replace('strike_understood_', '').split('_');
            const userId = parts[0];
            const actionLabel = parts[parts.length - 1];
            const groupName = parts.slice(1, -1).join(' ');

            if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This button is not for you.', ephemeral: true });

            client._strikePending = client._strikePending || new Map();
            const key = `${groupName}_${actionLabel}`;
            if (!client._strikePending.has(key)) client._strikePending.set(key, { acknowledged: new Set() });
            client._strikePending.get(key).acknowledged.add(userId);

            await StrikePending.findOneAndUpdate(
                { key },
                { key, acknowledged: [...client._strikePending.get(key).acknowledged] },
                { upsert: true, new: true }
            ).catch(console.error);

            await interaction.reply({ content: '✅ Thank you for acknowledging the strike.', ephemeral: true });

            try {
                const guild = await client.guilds.fetch(interaction.guildId).catch(() => null);
                if (guild) {
                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (member) {
                        const STRIKE_1_ROLE_ID = '1433165486258127062';
                        const STRIKE_2_ROLE_ID = '1433165562531545141';
                        const roleId = actionLabel === 'strike1' ? STRIKE_1_ROLE_ID : STRIKE_2_ROLE_ID;
                        await member.roles.add(roleId).catch(console.error);
                    }
                }
            } catch (err) {
                console.error('Failed to add strike role on acknowledgement:', err);
            }

            try {
                const oldComponents = interaction.message.components[0]?.components || [];
                const newButtons = oldComponents.map(btn => {
                    const btnUserId = btn.customId.replace('strike_understood_', '').split('_')[0];
                    const acknowledged = client._strikePending.get(key)?.acknowledged.has(btnUserId);
                    return new ButtonBuilder()
                        .setCustomId(btn.customId)
                        .setLabel(acknowledged ? btn.label.replace('✅ I Understand', '✅ Understood') : btn.label)
                        .setStyle(acknowledged ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setDisabled(acknowledged);
                });
                await interaction.message.edit({ components: [new ActionRowBuilder().addComponents(...newButtons)] });
            } catch (err) {
                console.error('Failed to update strike message:', err);
            }

            const disciplineLogChannel = await client.channels.fetch(DISCIPLINE_LOG_CHANNEL_ID).catch(() => null);
            if (disciplineLogChannel) {
                await disciplineLogChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('✅ Strike Acknowledged')
                        .setColor('Orange')
                        .addFields(
                            { name: 'User', value: `<@${userId}>`, inline: true },
                            { name: 'Alliance', value: groupName, inline: true },
                            { name: 'Strike', value: actionLabel === 'strike1' ? 'Strike 1' : 'Strike 2', inline: true },
                            { name: 'Acknowledged By', value: interaction.user.tag, inline: true },
                            { name: 'Date', value: new Date().toLocaleString(), inline: false }
                        )
                        .setTimestamp()]
                });
            }
        } catch (err) {
            console.error('Error handling strike_understood button:', err);
        }
        return;
    }

    // ── Termination/Blacklist acknowledgement ──
    if (interaction.customId.startsWith('discipline_understood_')) {
        try {
            const parts = interaction.customId.replace('discipline_understood_', '').split('_');
            const userId = parts[0];
            const actionLabel = parts[parts.length - 1];
            const groupName = parts.slice(1, -1).join(' ');

            if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This button is not for you.', ephemeral: true });

            client._disciplineAcks = client._disciplineAcks || new Map();
            if (!client._disciplineAcks.has(groupName)) client._disciplineAcks.set(groupName, new Set());
            client._disciplineAcks.get(groupName).add(userId);

            await interaction.reply({ content: '✅ Thank you for acknowledging. You will now be removed from the server.', ephemeral: true });

            try {
                const oldComponents = interaction.message.components[0]?.components || [];
                const newButtons = oldComponents.map(btn => {
                    const btnUserId = btn.customId.replace('discipline_understood_', '').split('_')[0];
                    const acknowledged = client._disciplineAcks.get(groupName)?.has(btnUserId);
                    return new ButtonBuilder()
                        .setCustomId(btn.customId)
                        .setLabel(acknowledged ? btn.label.replace('✅ I Understand', '✅ Understood') : btn.label)
                        .setStyle(acknowledged ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setDisabled(acknowledged);
                });
                await interaction.message.edit({ components: [new ActionRowBuilder().addComponents(...newButtons)] });
            } catch (err) {
                console.error('Failed to update discipline message:', err);
            }

            const pendingData = client._disciplinePending?.get(groupName);
            if (pendingData) pendingData.pendingKicks.delete(userId);

            await DisciplinePending.findOneAndUpdate(
                { groupName },
                { pendingKicks: [...(pendingData?.pendingKicks || [])] },
                { new: true }
            ).catch(console.error);

            const guild = await client.guilds.fetch(interaction.guildId).catch(() => null);
            if (!guild) return;

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return;

            try {
                await member.send({
                    embeds: [new EmbedBuilder()
                        .setTitle(`${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} Notice`)
                        .setDescription(
                            `Greetings, <@${userId}>\n\n` +
                            `I'm unfortunately saddened to inform you that your alliance with **Kavià Café** has been **${actionLabel}d**, effective immediately.\n\n` +
                            `This decision was made after careful consideration and was not made lightly.\n\n` +
                            `🗒️ **Reason:** ${pendingData?.reason || 'N/A'}\n\n` +
                            `We appreciate the time and effort you've contributed during your time as an alliance with **Kavià Café**.\n\n` +
                            `If you believe this decision was made in error, please feel free to DM me for clarification or open a ticket.\n\n` +
                            `**Regards,**\n**${pendingData?.staffName || 'PR Staff'}**\n**${pendingData?.rank || 'PR Staff'}**\n**Kavià || Public Relations Team**`
                        )
                        .setColor(actionLabel === 'blacklist' ? 0x000000 : 'Red')
                        .setFooter({ text: 'Kavià Café — Public Relations Department' })
                        .setTimestamp()]
                });
            } catch (err) {
                console.error(`Failed to DM ${userId}:`, err);
            }

            await member.kick(`Alliance ${actionLabel} acknowledged`).catch(console.error);

            if (pendingData && pendingData.pendingKicks.size === 0) {
                const g = await client.guilds.fetch(pendingData.guildId).catch(() => null);
                if (g) {
                    if (pendingData.alliance.repRoleId) {
                        const theirRole = g.roles.cache.get(pendingData.alliance.repRoleId);
                        if (theirRole) await theirRole.delete().catch(console.error);
                    }
                    if (pendingData.alliance.ourRepRoleId) {
                        const ourRole = g.roles.cache.get(pendingData.alliance.ourRepRoleId);
                        if (ourRole) await ourRole.delete().catch(console.error);
                    }
                    if (pendingData.alliance.welcomeChannelId) {
                        const ch = await client.channels.fetch(pendingData.alliance.welcomeChannelId).catch(() => null);
                        if (ch) await ch.setParent(TERMINATED_CATEGORY_ID, { lockPermissions: false }).catch(console.error);
                    }
                }
                await DisciplinePending.findOneAndDelete({ groupName }).catch(console.error);
                client._disciplinePending.delete(groupName);
                client._disciplineAcks.delete(groupName);
            }

            const disciplineLogChannel = await client.channels.fetch(DISCIPLINE_LOG_CHANNEL_ID).catch(() => null);
            if (disciplineLogChannel) {
                await disciplineLogChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('✅ Discipline Notice Acknowledged')
                        .setColor('Green')
                        .addFields(
                            { name: 'User', value: `<@${userId}>`, inline: true },
                            { name: 'Alliance', value: groupName, inline: true },
                            { name: 'Action', value: actionLabel, inline: true },
                            { name: 'Acknowledged By', value: interaction.user.tag, inline: true },
                            { name: 'Date', value: new Date().toLocaleString(), inline: false }
                        )
                        .setTimestamp()]
                });
            }
        } catch (err) {
            console.error('Error handling discipline_understood button:', err);
        }
        return;
    }

    const starttraining = client.commands.get('starttraining');
    if (starttraining) await starttraining.handleButton(interaction, client);
});

// Handle modals
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId.startsWith('topost_modal_')) {
        const topost = client.commands.get('topost');
        if (topost) await topost.handleModal(interaction, client);
    }

    if (interaction.customId === 'awareness_modal') {
        const awareness = client.commands.get('awareness');
        if (awareness) await awareness.handleModal(interaction, client);
    }

    if (interaction.customId.startsWith('ageverify_deny_modal_')) {
        const starttraining = client.commands.get('starttraining');
        if (starttraining) await starttraining.handleModal(interaction, client);
    }

    if (interaction.customId.startsWith('appeal_modal_') ||
        interaction.customId.startsWith('appeal_deny_modal_') ||
        interaction.customId.startsWith('appeal_moreinfo_modal_') ||
        interaction.customId.startsWith('appeal_resubmit_modal_')) {
        const appeal = require('./commands/appeal');
        await appeal.handleModal(interaction, client);
    }

    if (interaction.customId.startsWith('healthcheck_link_modal_')) {
        const healthCheck = client.commands.get('health-check');
        if (healthCheck) await healthCheck.handleModal(interaction, client);
    }
    if (interaction.customId.startsWith('sendall_message_modal_') ||
        interaction.customId.startsWith('sendall_poll_modal_')) {
        const sendall = client.commands.get('sendall');
        if (sendall) await sendall.handleModal(interaction, client);
    }

    if (interaction.customId.startsWith('sendsome_message_modal_') ||
        interaction.customId.startsWith('sendsome_poll_modal_')) {
        const sendsome = client.commands.get('sendsome');
        if (sendsome) await sendsome.handleModal(interaction, client);
    }
    if (interaction.customId.startsWith('event_request_modal_') ||
        interaction.customId.startsWith('event_reschedule_modal_')) {
        const eventRequest = client.commands.get('event-request');
        if (eventRequest) await eventRequest.handleModal(interaction, client);
    }

    // ── Verification username modal ──
    if (interaction.customId.startsWith('verify_username_modal_')) {
        try {
            const withoutPrefix = interaction.customId.replace('verify_username_modal_', '');
            const firstUnderscore = withoutPrefix.indexOf('_');
            const secondUnderscore = withoutPrefix.indexOf('_', firstUnderscore + 1);
            const userId = withoutPrefix.substring(0, firstUnderscore);
            const messageId = withoutPrefix.substring(firstUnderscore + 1, secondUnderscore);
            const allianceName = withoutPrefix.substring(secondUnderscore + 1).replace(/_/g, ' ');
            const robloxUsername = interaction.fields.getTextInputValue('roblox_username').trim();
            const allianceNameClaim = allianceName.includes('NOT_FOUND')
                ? (interaction.fields.getTextInputValue('alliance_name_claim')?.trim() || null)
                : null;

            await interaction.deferReply({ ephemeral: true });

            const axios = require('axios');

            // ── Check main Kavià Discord ──
            const qotdGuild = await client.guilds.fetch(QOTD_GUILD_ID).catch(() => null);
            const inMainDiscord = qotdGuild
                ? !!(await qotdGuild.members.fetch(userId).catch(() => null))
                : false;

        if (!inMainDiscord) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Not in Main Kavià Discord')
                        .setDescription(
                            `It looks like you're not currently in the **main Kavià Café Discord server**.\n\n` +
                            `You must be in our main server to verify as an Allied Representative.\n\n` +
                            `Once you've joined, please post in <#${VERIFICATION_CHANNEL_ID}> again to restart. 💜`
                        )
                        .setColor('Red')
                        .setFooter({ text: 'Kavià Café — Alliance Hub Verification' })
                        .setTimestamp()],
                    components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('Join Kavià Café Discord')
                            .setURL('https://discord.gg/EFumGubjaQ')
                            .setStyle(ButtonStyle.Link)
                    )]
                });
            }

            // ── Lookup Roblox user ID ──
            let robloxUserId = null;
            try {
                const userRes = await axios.post('https://users.roblox.com/v1/usernames/users', {
                    usernames: [robloxUsername],
                    excludeBannedUsers: false
                });
                robloxUserId = userRes.data?.data?.[0]?.id || null;
            } catch (err) {
                console.error('Roblox username lookup failed:', err);
            }

            if (!robloxUserId) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Roblox Username Not Found')
                        .setDescription(
                            `We couldn't find a Roblox account with the username **${robloxUsername}**.\n\n` +
                            `Please double-check your username and post in <#${VERIFICATION_CHANNEL_ID}> again to restart. 💜`
                        )
                        .setColor('Red')
                        .setFooter({ text: 'Kavià Café — Alliance Hub Verification' })
                        .setTimestamp()]
                });
            }

            // ── Check Kavià Roblox group ──
            let inKaviaGroup = false;
            try {
                const groupRes = await axios.get(`https://groups.roblox.com/v1/users/${robloxUserId}/groups/roles`);
                const groups = groupRes.data?.data || [];
                inKaviaGroup = groups.some(g => g.group?.id === KAVIA_ROBLOX_GROUP_ID);
            } catch (err) {
                console.error('Roblox group check failed:', err);
            }

            if (!inKaviaGroup) {
                const recheckRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`verify_recheck_${userId}_${messageId}_${robloxUsername}_${allianceName.replace(/\s+/g, '_')}`)
                        .setLabel('🔄 Re-check Eligibility')
                        .setStyle(ButtonStyle.Primary)
                );

                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Not in Kavià Roblox Group')
                        .setDescription(
                            `**${robloxUsername}** is not currently a member of the **Kavià Café** Roblox group.\n\n` +
                            `👉 **[Join the Kavià Café Roblox Group](https://www.roblox.com/communities/${KAVIA_ROBLOX_GROUP_ID})**\n\n` +
                            `Once you've joined, click the button below to re-check your eligibility. 💜`
                        )
                        .setColor('Red')
                        .setFooter({ text: 'Kavià Café — Alliance Hub Verification' })
                        .setTimestamp()],
                    components: [recheckRow]
                });
            }

            // ── All checks passed ──
            await handleVerificationPass(interaction, client, userId, messageId, allianceName, robloxUsername, robloxUserId, allianceNameClaim);

        } catch (err) {
            console.error('Error handling verify_username_modal:', err);
        }
    }
    if (interaction.customId.startsWith('verify_deny_modal_')) {
        try {
            const withoutPrefix = interaction.customId.replace('verify_deny_modal_', '');
            const underscoreIndex = withoutPrefix.indexOf('_');
            const userId = withoutPrefix.substring(0, underscoreIndex);
            const messageId = withoutPrefix.substring(underscoreIndex + 1);
            const reason = interaction.fields.getTextInputValue('deny_reason');

            await interaction.update({
                embeds: [EmbedBuilder.from(interaction.message.embeds[0])
                    .setTitle('❌ Verification — Denied')
                    .setColor('Red')
                    .addFields(
                        { name: 'Reviewed By', value: interaction.user.tag, inline: true },
                        { name: 'Reason', value: reason, inline: false }
                    )],
                components: []
            });

           if (messageId) {
                const verifyChannel = await client.channels.fetch(VERIFICATION_CHANNEL_ID).catch(() => null);
                if (verifyChannel) {
                    const originalMsg = await verifyChannel.messages.fetch(messageId).catch(() => null);
                    if (originalMsg) await originalMsg.delete().catch(console.error);
                    const pendingEntry = pendingVerifications.get(messageId);
                    if (pendingEntry?.promptMessageId) {
                        const promptMsg = await verifyChannel.messages.fetch(pendingEntry.promptMessageId).catch(() => null);
                        if (promptMsg) await promptMsg.delete().catch(console.error);
                    }
                }
            }

            pendingVerifications.delete(messageId);

            try {
                const user = await client.users.fetch(userId);
                await user.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Verification Denied')
                        .setDescription(
                            `Hey <@${userId}>,\n\n` +
                            `Unfortunately your verification submission was **denied**.\n\n` +
                            `**Reason:** ${reason}\n\n` +
                            `Please resubmit your verification in <#${VERIFICATION_CHANNEL_ID}> making sure to follow the format correctly and include all required information. 💜`
                        )
                        .setColor('Red')
                        .setFooter({ text: 'Kavià Café — Alliance Hub' })
                        .setTimestamp()]
                });
            } catch (err) {
                console.error(`Failed to DM ${userId} on verify deny:`, err);
            }
        } catch (err) {
            console.error('Error handling verify_deny_modal:', err);
        }
    }
});

// Handle messages
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.guild?.id === ALLIANCE_GUILD_ID && message.channel.id === VERIFICATION_CHANNEL_ID) {
        try {
            await message.react('⏳').catch(console.error);

            const { loadAlliances } = require('./utils/allianceStorage');
            const alliances = await loadAlliances().catch(() => []);

            pendingVerifications.set(message.id, {
                userId: message.author.id,
                userTag: message.author.tag,
                content: message.content,
                imageUrl: message.attachments.first()?.url || null,
                selectedAlliance: null,
                messageId: message.id
            });

            if (alliances.length === 0) {
                const verifyLogChannel = await client.channels.fetch(VERIFICATION_LOG_CHANNEL_ID).catch(() => null);
                if (!verifyLogChannel) return;

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`verify_accept_${message.author.id}_${message.id}`)
                        .setLabel('✅ Accept')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`verify_deny_${message.author.id}_${message.id}`)
                        .setLabel('❌ Deny')
                        .setStyle(ButtonStyle.Danger)
                );

                const embed = new EmbedBuilder()
                    .setTitle('📋 New Verification Submission')
                    .setColor(0x9B59B6)
                    .addFields(
                        { name: 'User', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
                        { name: 'Submitted At', value: new Date().toLocaleString(), inline: true },
                        { name: 'Message Content', value: message.content || '*No text*', inline: false }
                    )
                    .setFooter({ text: 'Kavià Café — Alliance Hub Verification' })
                    .setTimestamp();

                const imageUrl = message.attachments.first()?.url || null;
                if (imageUrl) embed.setImage(imageUrl);

                await verifyLogChannel.send({
                    content: `<@&${ALLOWED_ROLE_ID}>`,
                    embeds: [embed],
                    components: [row],
                    allowedMentions: { roles: [ALLOWED_ROLE_ID] }
                });
                return;
            }

            const options = alliances.slice(0, 25).map(a => ({
                label: a.groupName,
                value: a.groupName
            }));

            options.push({ label: '👤 Staff Member (Not an Alliance Rep)', value: '__STAFF__' });
            options.push({ label: '❓ My alliance isn\'t listed', value: '__NOT_FOUND__' });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`verify_alliance_select_${message.id}`)
                .setPlaceholder('Select the alliance you represent...')
                .addOptions(options.slice(0, 25));

            const row = new ActionRowBuilder().addComponents(selectMenu);

           const verifyPrompt = await message.reply({
                content: `Hey <@${message.author.id}>! 👋 Thanks for submitting your verification.\n\nPlease select which alliance you represent from the dropdown below so we can assign you the correct roles automatically! 💜`,
                components: [row]
            });

            // Store the prompt message ID so we can delete it later
            const pending = pendingVerifications.get(message.id);
            if (pending) pending.promptMessageId = verifyPrompt.id;

        } catch (err) {
            console.error('Error handling verification message:', err);
        }
        return;
    }

    if (message.guild) {
        const checkin = client.commands.get('checkin');
        if (checkin) await checkin.handleCheckinReply(message, client);

        const topost = client.commands.get('topost');
        if (topost) await topost.handleTopostReply(message, client);
        return;
    }

    const starttraining = client.commands.get('starttraining');
    if (starttraining) await starttraining.handleMessage(message, client);
});

client.login(process.env.TOKEN);