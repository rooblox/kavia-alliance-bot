require('dotenv').config();
const fs = require('fs');
const { Client, Collection, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { connectDB, DisciplinePending, StrikePending, QotdSchedule, AwarenessSchedule, TopostSession, TrainingInvite } = require('./db');

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
const UNVERIFIED_ROLE_ID = '1571285634264604802';
const KAVIA_DISCORD = 'https://discord.gg/rMtv4smu36';
const KAVIA_ROBLOX = 'https://www.roblox.com/communities/13827902/Kavi-Cafe#!/about';
const QOTD_GUILD_ID = '1370892833182974035';
const KAVIA_ROBLOX_GROUP_ID = 13827902;
const ALLOWED_GUILD_IDS = [
    '1385081586285940796',
    '1313780438061420584',
    '1370892833182974035'
];

let verificationWelcomeMessageId = null;
let bannerMessageId = null;
let activeVerificationChannelId = '1417865773271224350'; // updated at runtime if new channel created
const pendingVerifications = new Map();   // messageId → session (old text-based, kept for staff modal logic)
const verifyProofPending = new Map();     // userId → { sessionKey, allianceName, robloxUsername, robloxUserId, userTag, messageIds[] }

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

function getBannerDateString() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const day = days[now.getDay()];
    const month = months[now.getMonth()];
    const date = now.getDate();
    const year = String(now.getFullYear()).slice(-2);
    // ordinal suffix
    const s = date % 10, t = date % 100;
    const suffix = (t >= 11 && t <= 13) ? 'th' : (s === 1 ? 'st' : s === 2 ? 'nd' : s === 3 ? 'rd' : 'th');
    return `${day}, ${month} ${date}${suffix}, '${year}`;
}

function buildBannerEmbed() {
    return new EmbedBuilder()
        .setDescription(
            `📅 **${getBannerDateString()}**\n\n` +
            `To gain access to this hub, you must verify yourself as an **Allied Representative**.\n` +
            `Click **✨ Verify Me** below to begin the verification process.`
        )
        .setImage('attachment://banner_source.png')
        .setColor(0x9B59B6)
        .setFooter({ text: 'Kavià Café — Public Relations Department' });
}

async function ensureBannerMessage(client) {
    try {
        const channel = await client.channels.fetch(activeVerificationChannelId).catch(() => null);
        if (!channel) return;

        // Try to find existing banner message
        if (bannerMessageId) {
            const existing = await channel.messages.fetch(bannerMessageId).catch(() => null);
            if (existing) return; // already there, daily loop will edit it
        }

        const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
        if (messages) {
            const botMsg = messages.find(m =>
                m.author.id === client.user.id &&
                m.embeds.length > 0 &&
                m.embeds[0]?.image != null &&
                m.components?.length === 0
            );
            if (botMsg) {
                bannerMessageId = botMsg.id;
                console.log('✅ Found existing banner message');
                return;
            }
        }

        const bannerPath = require('path').join(__dirname, 'banner_source.png');
        const { AttachmentBuilder } = require('discord.js');
        const attachment = new AttachmentBuilder(bannerPath, { name: 'banner_source.png' });
        const msg = await channel.send({ embeds: [buildBannerEmbed()], files: [attachment] });
        await msg.pin().catch(() => {});
        bannerMessageId = msg.id;
        console.log('✅ Banner message posted');
    } catch (err) {
        console.error('Failed to post banner message:', err);
    }
}

function startBannerDailyRefresh(client) {
    const scheduleNextMidnight = () => {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const midnight = new Date(now);
        midnight.setDate(midnight.getDate() + 1);
        midnight.setHours(0, 0, 5, 0); // 12:00:05 AM ET
        const msUntil = midnight - now;
        setTimeout(async () => {
            try {
                const channel = await client.channels.fetch(activeVerificationChannelId).catch(() => null);
                if (channel && bannerMessageId) {
                    const msg = await channel.messages.fetch(bannerMessageId).catch(() => null);
                    if (msg) {
                        const bannerPath = require('path').join(__dirname, 'banner_source.png');
                        const { AttachmentBuilder } = require('discord.js');
                        const attachment = new AttachmentBuilder(bannerPath, { name: 'banner_source.png' });
                        await msg.edit({ embeds: [buildBannerEmbed()], files: [attachment] });
                        console.log('✅ Banner date refreshed');
                    }
                }
            } catch (err) {
                console.error('Failed to refresh banner:', err);
            }
            scheduleNextMidnight(); // reschedule for the next day
        }, msUntil);
        console.log(`🕛 Banner refresh scheduled in ${Math.round(msUntil / 60000)} minutes`);
    };
    scheduleNextMidnight();
}

async function ensureVerificationWelcome(client) {
    try {
        const guild = await client.guilds.fetch(ALLIANCE_GUILD_ID).catch(() => null);
        if (!guild) return;

        // Try to find an existing bot-managed verification channel
        await guild.channels.fetch();
        let channel = guild.channels.cache.find(c =>
            c.name === 'verify-here' && c.isTextBased()
        );

        // If not found, create a fresh one
        if (!channel) {
            const { ChannelType, PermissionFlagsBits } = require('discord.js');
            channel = await guild.channels.create({
                name: 'verify-here',
                type: ChannelType.GuildText,
                topic: 'Verify yourself as an Allied Representative to gain access to the hub.',
                permissionOverwrites: [
                    {
                        // everyone cannot see the channel
                        id: guild.roles.everyone,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        // unverified role can see and send
                        id: UNVERIFIED_ROLE_ID,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                    {
                        // bot can do everything it needs
                        id: client.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory],
                    }
                ]
            });
            console.log(`✅ Created new verification channel: ${channel.id}`);
        }

        activeVerificationChannelId = channel.id;

        // Check if our welcome message already exists
        if (verificationWelcomeMessageId) {
            const existing = await channel.messages.fetch(verificationWelcomeMessageId).catch(() => null);
            if (existing) return;
        }

        // Scan for existing bot verify embed
        const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
        if (messages) {
            const botMsg = messages.find(m =>
                m.author.id === client.user.id &&
                m.embeds.length > 0 &&
                m.components?.length > 0
            );
            if (botMsg) {
                verificationWelcomeMessageId = botMsg.id;
                return;
            }
        }

        // Post the verify embed with button
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('💜 Welcome to Kavià | Alliance Hub')
            .setDescription(
                `We're so glad you're here! Before you gain access to the hub, you'll need to **verify yourself** as an Allied Representative.\n\n` +
                `**What to expect:**\n` +
                `> 🤝 Select your alliance from a dropdown\n` +
                `> 🎮 Confirm your Roblox username\n` +
                `> 📸 Upload proof of your invite\n\n` +
                `The whole process takes just a couple of minutes. Once submitted, our PR team will review and approve you. 💜\n\n` +
                `**Click the button below to begin!**`
            )
            .setColor(0x9B59B6)
            .setFooter({ text: 'Kavià Café — Public Relations Department' })
            .setTimestamp();

        const verifyButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('verify_start')
                .setLabel('✨ Verify Me')
                .setStyle(ButtonStyle.Primary)
        );

        const msg = await channel.send({ embeds: [welcomeEmbed], components: [verifyButton] });
        await msg.pin().catch(() => {});
        verificationWelcomeMessageId = msg.id;
        console.log(`✅ Verification welcome message posted in ${channel.id}`);
    } catch (err) {
        console.error('Failed to set up verification channel:', err);
    }
}

// 24-hour reminder loop — ping unverified members once per day, delete the ping after 30s
async function startVerificationReminderLoop(client) {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const run = async () => {
        try {
            const guild = await client.guilds.fetch(ALLIANCE_GUILD_ID).catch(() => null);
            if (!guild) return;

            await guild.members.fetch();
            const unverifiedMembers = guild.members.cache.filter(m =>
                m.roles.cache.has(UNVERIFIED_ROLE_ID) && !m.user.bot
            );

            if (unverifiedMembers.size === 0) return;

            const channel = await client.channels.fetch(activeVerificationChannelId).catch(() => null);
            if (!channel) return;

            for (const [, member] of unverifiedMembers) {
                try {
                    const ping = await channel.send({
                        content: `👋 Hey <@${member.id}>! Just a friendly reminder — you still haven't completed verification. Click the **✨ Verify Me** button above to get started! 💜`
                    });
                    // Delete the ping after 30 seconds to keep the channel clean
                    setTimeout(() => ping.delete().catch(() => {}), 30_000);
                } catch (err) {
                    console.error(`Failed to ping unverified member ${member.id}:`, err);
                }
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (err) {
            console.error('Verification reminder loop error:', err);
        }
    };

    // Run once shortly after startup (1 min), then every 24 hours
    setTimeout(run, 60_000);
    setInterval(run, TWENTY_FOUR_HOURS);
}

// Helper: bulk-delete all non-pinned messages in verification channel from a specific user
async function cleanVerificationChannelForUser(client, userId) {
    try {
        const channel = await client.channels.fetch(activeVerificationChannelId).catch(() => null);
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (!messages) return;

        const toDelete = messages.filter(m => m.author.id === userId && !m.pinned);
        for (const [, msg] of toDelete) {
            await msg.delete().catch(() => {});
            await new Promise(r => setTimeout(r, 300));
        }
    } catch (err) {
        console.error(`Failed to clean verify channel for ${userId}:`, err);
    }
}


async function handleVerificationPass(interaction, client, userId, messageId, allianceName, robloxUsername, robloxUserId, allianceNameClaim = null, invitedBy = null) {
    const verifyLogChannel = await client.channels.fetch(VERIFICATION_LOG_CHANNEL_ID).catch(() => null);
    const isNotFound = allianceName === '__NOT FOUND__' || allianceName.includes('NOT FOUND') || allianceName === '__NOT_FOUND__';

    let components;
    if (isNotFound) {
        components = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`verify_create_alliance_${userId}_${messageId}`)
                    .setLabel('✅ Verify + Create Alliance')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`verify_accept_${userId}_${messageId}`)
                    .setLabel('✅ Verify Only')
                    .setStyle(ButtonStyle.Primary),
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
                    ...(invitedBy ? [{ name: '👤 Invited By', value: invitedBy, inline: true }] : []),
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

    try {
        const topostSessions = await TopostSession.find({});
        const topostCmd = client.commands.get('topost');
        if (topostCmd?.activeToposts) {
            const { loadAlliances } = require('./utils/allianceStorage');
            const alliances = await loadAlliances().catch(() => []);
            for (const doc of topostSessions) {
                // Skip sessions older than 48 hours — they've already expired
                const age = Date.now() - doc.startedAt;
                if (age >= 48 * 60 * 60 * 1000) {
                    await TopostSession.deleteOne({ key: doc.key }).catch(() => {});
                    continue;
                }
                topostCmd.activeToposts.set(doc.key, {
                    groupName: doc.groupName,
                    channelId: doc.channelId,
                    userId: doc.userId,
                    responded: doc.responded,
                    confirmed: doc.confirmed,
                    noResponse: doc.noResponse,
                    reminder24Sent: doc.reminder24Sent,
                    startedAt: doc.startedAt,
                    trackingMessageId: doc.trackingMessageId || null,
                    alliances // re-fetched fresh so tracking embed still works
                });
            }
            console.log(`✅ Reloaded ${topostCmd.activeToposts.size} active topost session(s) from MongoDB`);
        }
    } catch (err) {
        console.error('❌ Failed to reload topost sessions:', err);
    }

    for (const guild of client.guilds.cache.values()) {
        await deployToGuild(guild.id);
    }

    await ensureVerificationWelcome(client);  // creates channel first, sets activeVerificationChannelId
    await ensureBannerMessage(client);         // then posts banner into that channel
    startBannerDailyRefresh(client);
    startVerificationReminderLoop(client);

    // ── Ensure team log channels exist ──
    try {
        const { getOrCreateTeamLogChannel } = require('./utils/teamLog');
        for (let t = 1; t <= 5; t++) {
            await getOrCreateTeamLogChannel(client, t);
        }
        console.log('✅ Team log channels verified/created');
    } catch (err) {
        console.error('❌ Failed to create team log channels:', err);
    }

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
                                `• Have them verify in <#${activeVerificationChannelId}>\n` +
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
                            // Persist the updated reminder24Sent flag
                            await TopostSession.findOneAndUpdate(
                                { key },
                                { reminder24Sent: true },
                                { new: true }
                            ).catch(() => {});
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
                            await TopostSession.deleteOne({ key }).catch(() => {});
                        }
                    }
                }

            } catch (err) {
                console.error('Failed to process checkin/topost reminders:', err);
            }

        } catch (err) {
            console.error('Scheduler error:', err);
        }

        // Weekly stats report check
        checkWeeklyReport(client);

    }, 60 * 1000);

    // ── One-time team roster message on startup ──
    try {
        const TEAM_ROLE_IDS = {
            1: '1536084366080610414',
            2: '1536084453234053221',
            3: '1536084519650598944',
            4: '1536084475669254305',
            5: '1536084576043147385'
        };
        const ROSTER_CHANNEL_ID = '1417981861178904677';

        // Use a simple in-memory flag so it only posts once per process start
        if (!client._teamRosterPosted) {
            client._teamRosterPosted = true;

            const rosterChannel = await client.channels.fetch(ROSTER_CHANNEL_ID).catch(() => null);
            if (rosterChannel) {
                const mainGuild = await client.guilds.fetch(ALLIANCE_GUILD_ID).catch(() => null);
                if (mainGuild) {
                    await mainGuild.members.fetch(); // Cache all members

                    const lines = [];
                    for (const [teamNum, roleId] of Object.entries(TEAM_ROLE_IDS)) {
                        const role = mainGuild.roles.cache.get(roleId);
                        if (!role) {
                            lines.push(`**Team ${teamNum}:** *(role not found)*`);
                            continue;
                        }
                        const members = mainGuild.members.cache.filter(m => m.roles.cache.has(roleId));
                        const names = members.map(m => m.displayName).sort().join(', ') || 'Nobody';
                        lines.push(`**Team ${teamNum}:** ${names}`);
                    }

                    await rosterChannel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('👥 Team Roster — Bot Startup')
                            .setDescription(lines.join('\n\n'))
                            .setColor(0x9B59B6)
                            .setFooter({ text: `Posted on bot startup — ${new Date().toLocaleString()}` })
                            .setTimestamp()]
                    });
                }
            }
        }
    } catch (err) {
        console.error('Failed to post team roster:', err);
    }
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
const { stats, checkWeeklyReport } = require('./utils/weeklyStats');

client.on('guildMemberAdd', async (member) => {
    if (member.guild.id !== ALLIANCE_GUILD_ID) return;

    // Weekly stats
    stats.memberJoined();

    const channel = await client.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle('☕ Welcome to Kavià | Alliance Hub!')
        .setDescription(
            `Hey there, <@${member.id}>! We're so glad to have you here. 💜\n\n` +
            `**Kavià Alliance Hub** is the home of our allied representatives and partnerships.\n\n` +
            `**Here's what to do next:**\n` +
            `• ✅ Head over to <#${activeVerificationChannelId}> and verify yourself\n` +
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

    // Assign the unverified role so we can track who hasn't verified
    try {
        await member.roles.add(UNVERIFIED_ROLE_ID);
    } catch (err) {
        console.error(`Failed to assign unverified role to ${member.id}:`, err);
    }
});

client.on('guildMemberRemove', (member) => {
    if (member.guild.id !== ALLIANCE_GUILD_ID) return;
    stats.memberLeft();
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
    // Route channel and user select menus for sendteamlinks
    if (interaction.isChannelSelectMenu() || interaction.isUserSelectMenu()) {
        if (interaction.customId.startsWith('sendteamlinks_channel_') ||
            interaction.customId.startsWith('sendteamlinks_user_')) {
            const sendTeamLinks = client.commands.get('sendteamlinks');
            if (sendTeamLinks) await sendTeamLinks.handleSelectMenu(interaction, client);
        }
        return;
    }

    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId.startsWith('sendteamlinks_team_')) {
        const sendTeamLinks = client.commands.get('sendteamlinks');
        if (sendTeamLinks) await sendTeamLinks.handleSelectMenu(interaction, client);
        return;
    }

    if (interaction.customId.startsWith('pay_deduction_pick_')) {
        const payCalc = client.commands.get('pay-calculate');
        if (payCalc) await payCalc.handleSelectMenu(interaction, client);
        return;
    }

    if (interaction.customId.startsWith('training_category_select_')) {
        const starttraining = client.commands.get('starttraining');
        if (starttraining) await starttraining.handleSelectMenu(interaction, client);
        return;
    }

    if (interaction.customId.startsWith('bt_cat_select_')) {
        const starttraining = client.commands.get('starttraining');
        if (starttraining?.handleBotTrainingSelectMenu) await starttraining.handleBotTrainingSelectMenu(interaction, client);
        return;
    }

if (interaction.customId.startsWith('discipline_kick_select_')) {
        const discipline = client.commands.get('alliance-discipline');
        if (discipline) await discipline.handleSelectMenu(interaction, client);
        return;
    }

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
            const sessionKey = interaction.customId.replace('verify_alliance_select_', '');
            const selectedAlliance = interaction.values[0];
            const isStaff = selectedAlliance === '__STAFF__';
            const isNotFound = selectedAlliance === '__NOT_FOUND__';

            // Staff path — go straight to staff log, ask for proof too
            if (isStaff) {
                // Show Roblox username modal for staff too (they may be in the group)
                const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
                const modal = new ModalBuilder()
                    .setCustomId(`verify_username_modal_${interaction.user.id}_${sessionKey}_${selectedAlliance}`)
                    .setTitle('Staff Verification');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('roblox_username')
                            .setLabel('Your Roblox Username')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('e.g. RobloxUser123')
                            .setRequired(true)
                            .setMaxLength(50)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('staff_role_note')
                            .setLabel('What role/department are you?')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('e.g. PR Staff, Team Lead, etc.')
                            .setRequired(false)
                            .setMaxLength(100)
                    )
                );
                await interaction.showModal(modal);
                return;
            }

            // Build the Roblox username modal
            const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
            const modal = new ModalBuilder()
                .setCustomId(`verify_username_modal_${interaction.user.id}_${sessionKey}_${isNotFound ? '__NOT_FOUND__' : selectedAlliance.replace(/\s+/g, '_')}`)
                .setTitle('Step 2 — Roblox Username');

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
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('invited_by')
                            .setLabel('Who invited you? (staff member name)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('e.g. Nina')
                            .setRequired(false)
                            .setMaxLength(100)
                    )
                );
            }

            modal.addComponents(...modalComponents);
            await interaction.showModal(modal);

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

    // ── Verify Me button — start the new step-by-step flow ──
    if (interaction.customId === 'verify_start') {
        try {
            const { loadAlliances } = require('./utils/allianceStorage');
            const alliances = await loadAlliances().catch(() => []);

            const sessionKey = `${interaction.user.id}_${Date.now()}`;

            // Build alliance dropdown options
            const options = alliances.slice(0, 23).map(a => ({
                label: a.groupName.length > 100 ? a.groupName.substring(0, 97) + '...' : a.groupName,
                value: a.groupName
            }));
            options.push({ label: '👤 Staff Member (not an alliance rep)', value: '__STAFF__' });
            options.push({ label: '❓ My alliance isn\'t listed', value: '__NOT_FOUND__' });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`verify_alliance_select_${sessionKey}`)
                .setPlaceholder('Start typing or scroll to find your alliance...')
                .addOptions(options.slice(0, 25));

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle('🤝 Step 1 of 3 — Select Your Alliance')
                .setDescription(
                    `Welcome, <@${interaction.user.id}>! Let's get you verified. 💜\n\n` +
                    `**Please select the alliance you represent** from the dropdown below.\n\n` +
                    `> If you're a Kavià staff member, select **Staff Member**.\n` +
                    `> If your alliance isn't listed, select **My alliance isn't listed**.\n\n` +
                    `*Only you can see this message.*`
                )
                .setColor(0x9B59B6)
                .setFooter({ text: 'Kavià Café — Alliance Hub Verification • Step 1 of 3' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        } catch (err) {
            console.error('Error handling verify_start:', err);
            await interaction.reply({ content: '❌ Something went wrong. Please try again!', ephemeral: true }).catch(() => {});
        }
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
            const rawAlliancePart = withoutPrefix.substring(secondUnderscore + 1);

            // Detect not-found path before any replace
            const isNotFound = rawAlliancePart === '__NOT_FOUND__' || rawAlliancePart === '___NOT_FOUND__' || rawAlliancePart.includes('NOT_FOUND');
            const allianceName = isNotFound ? '__NOT_FOUND__' : rawAlliancePart.replace(/_/g, ' ');

            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ This is not your verification session.', ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId(`verify_username_modal_${userId}_${messageId}_${isNotFound ? '__NOT_FOUND__' : allianceName.replace(/\s+/g, '_')}`)
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
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('invited_by')
                            .setLabel('Who invited you? (staff member name)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('e.g. Nina')
                            .setRequired(false)
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
                            `Please post in <#${activeVerificationChannelId}> again to restart your verification.`
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

            // Passed — advance to proof of invite step
            const verifyChannel = await client.channels.fetch(activeVerificationChannelId).catch(() => null);
            let stepMsgId = null;
            if (verifyChannel) {
                const stepMsg = await verifyChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('📸 Step 3 of 3 — Proof of Invite')
                        .setDescription(
                            `Almost done, <@${userId}>! 💜\n\n` +
                            `Please **send a screenshot or image link** in this channel as proof that you were invited.\n\n` +
                            `> You can attach an image directly, or paste an image URL.`
                        )
                        .setColor(0x9B59B6)
                        .setFooter({ text: 'Kavià Café — Alliance Hub Verification • Step 3 of 3' })
                        .setTimestamp()]
                });
                stepMsgId = stepMsg.id;
            }

            verifyProofPending.set(userId, {
                userId,
                userTag: interaction.user.tag,
                sessionKey: messageId,
                allianceName,
                allianceNameClaim: null,
                invitedBy: null,
                robloxUsername,
                robloxUserId,
                inKaviaGroup,
                stepMessageId: stepMsgId,
                messageIds: [stepMsgId].filter(Boolean),
                proofUrl: null
            });

            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('✅ Step 2 Complete — Roblox Verified!')
                    .setDescription(
                        `**${robloxUsername}** is now verified in the Kavià Café Roblox group! ✅\n\n` +
                        `**Head to <#${activeVerificationChannelId}>** and send your proof of invite to complete verification. 💜`
                    )
                    .setColor(0x9B59B6)
                    .setFooter({ text: 'Kavià Café — Alliance Hub Verification' })
                    .setTimestamp()],
                components: []
            });

        } catch (err) {
            console.error('Error handling verify_recheck:', err);
        }
        return;
    }
    // ── Verify + Create Alliance ──
    if (interaction.customId.startsWith('verify_create_alliance_')) {
        try {
            const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
            const withoutPrefix = interaction.customId.replace('verify_create_alliance_', '');
            const firstUnderscore = withoutPrefix.indexOf('_');
            const userId = withoutPrefix.substring(0, firstUnderscore);
            const messageId = withoutPrefix.substring(firstUnderscore + 1);

            const modal = new ModalBuilder()
                .setCustomId(`verify_create_alliance_modal_${userId}_${messageId}`)
                .setTitle('Create Alliance & Verify Rep');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('alliance_name')
                        .setLabel('Alliance Name (exact)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. Sakura Cafe')
                        .setRequired(true)
                        .setMaxLength(100)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('team_number')
                        .setLabel('Team Number (1-5)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. 3')
                        .setRequired(true)
                        .setMaxLength(1)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('discord_link')
                        .setLabel('Discord Link (optional)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('https://discord.gg/...')
                        .setRequired(false)
                        .setMaxLength(200)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('roblox_link')
                        .setLabel('Roblox Link (optional)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('https://www.roblox.com/communities/...')
                        .setRequired(false)
                        .setMaxLength(200)
                )
            );

            await interaction.showModal(modal);
        } catch (err) {
            console.error('Error handling verify_create_alliance button:', err);
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

            // Remove the unverified role now that they're accepted
            await member.roles.remove(UNVERIFIED_ROLE_ID).catch(() => {});

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

                    // Team log for new verified rep
                    const { postTeamLog } = require('./utils/teamLog');
                    const verifyEmbed = new EmbedBuilder()
                        .setTitle('✅ New Rep Verified')
                        .setColor(0x9B59B6)
                        .addFields(
                            { name: 'New Rep', value: `<@${userId}> (${member.user.tag})`, inline: true },
                            { name: 'Accepted By', value: interaction.user.tag, inline: true }
                        )
                        .setTimestamp();
                    await postTeamLog(client, alliance.team, allianceName, verifyEmbed);
                    stats.repVerified(interaction.user.tag);
                }

                pendingVerifications.delete(messageId);
            }

            // Clean all user messages from the verification channel
            await cleanVerificationChannelForUser(client, userId);
            pendingVerifications.delete(messageId);

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

            const pendingData = client._disciplinePending?.get(groupName);
            const shouldKick = pendingData?.pendingKicks?.has(userId) ?? false;

            await interaction.reply({
                content: shouldKick
                    ? '✅ Thank you for acknowledging. You will now be removed from the server.'
                    : '✅ Thank you for acknowledging.',
                ephemeral: true
            });

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

            if (shouldKick) {
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
            }

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

    // ── Pay system buttons ──
    if (interaction.customId.startsWith('pay_override_') ||
        interaction.customId.startsWith('pay_loa_') ||
        interaction.customId.startsWith('pay_deduction_') ||
        interaction.customId === 'pay_finalize' ||
        interaction.customId === 'pay_mark_paid' ||
        interaction.customId === 'pay_mark_paid_confirm' ||
        interaction.customId === 'pay_mark_paid_cancel') {
        const payCalc = client.commands.get('pay-calculate');
        if (payCalc) await payCalc.handleButton(interaction, client);
        return;
    }

    if (interaction.customId.startsWith('training_') || interaction.customId.startsWith('bt_') ||
        interaction.customId.startsWith('blast_yes_') || interaction.customId.startsWith('blast_no_')) {
        const starttraining = client.commands.get('starttraining');
        if (starttraining) await starttraining.handleButton(interaction, client);
        return;
    }
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
            const rawAlliancePart = withoutPrefix.substring(secondUnderscore + 1);

            // Detect not-found BEFORE replacing underscores
            const isNotFound = rawAlliancePart === '__NOT_FOUND__' || rawAlliancePart.includes('NOT_FOUND');
            const allianceName = isNotFound ? '__NOT_FOUND__' : rawAlliancePart.replace(/_/g, ' ');

            const robloxUsername = interaction.fields.getTextInputValue('roblox_username').trim();
            const allianceNameClaim = isNotFound
                ? (interaction.fields.getTextInputValue('alliance_name_claim')?.trim() || null)
                : null;
            const invitedBy = isNotFound
                ? (interaction.fields.getTextInputValue('invited_by')?.trim() || null)
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
                            `Once you've joined, please post in <#${activeVerificationChannelId}> again to restart. 💜`
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
                            `Please double-check your username and post in <#${activeVerificationChannelId}> again to restart. 💜`
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

            // Extract the session key — it's the second segment of the customId
            // Format: verify_username_modal_<userId>_<sessionKey>_<alliancePart>
            // sessionKey may contain underscores (it's a userId_timestamp), so we need to re-derive
            // We already have userId (firstUnderscore), so sessionKey = messageId (which is actually the sessionKey)
            const sessionKey = messageId; // messageId variable holds the sessionKey from parsing above

            if (!inKaviaGroup) {
                const recheckRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`verify_recheck_${userId}_${sessionKey}_${robloxUsername}_${allianceName.replace(/\s+/g, '_')}`)
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

            // ── All checks passed — Step 3: Proof of Invite ──
            // Post a message in the verification channel prompting them to upload proof
            const verifyChannel = await client.channels.fetch(activeVerificationChannelId).catch(() => null);
            let stepMsgId = null;
            if (verifyChannel) {
                const stepMsg = await verifyChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('📸 Step 3 of 3 — Proof of Invite')
                        .setDescription(
                            `Almost done, <@${userId}>! 💜\n\n` +
                            `Please **send a screenshot or image link** in this channel as proof that you were invited to the Alliance Hub.\n\n` +
                            `> You can attach an image directly, or paste an image URL.\n\n` +
                            `*Only your next message will be captured — anything else will be deleted automatically.*`
                        )
                        .setColor(0x9B59B6)
                        .setFooter({ text: 'Kavià Café — Alliance Hub Verification • Step 3 of 3' })
                        .setTimestamp()],
                    components: []
                });
                stepMsgId = stepMsg.id;
            }

            // Store session so messageCreate can capture their proof
            verifyProofPending.set(userId, {
                userId,
                userTag: interaction.user.tag,
                sessionKey,
                allianceName,
                allianceNameClaim: allianceNameClaim || null,
                invitedBy: invitedBy || null,
                robloxUsername,
                robloxUserId,
                inKaviaGroup,
                stepMessageId: stepMsgId,
                messageIds: [stepMsgId].filter(Boolean),
                proofUrl: null
            });

            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('✅ Step 2 Complete — Roblox Verified!')
                    .setDescription(
                        `Great news! **${robloxUsername}** is verified as a Kavià Café Roblox group member. ✅\n\n` +
                        `**Head to <#${activeVerificationChannelId}>** and send your proof of invite (a screenshot or image link) to complete your verification. 💜`
                    )
                    .setColor(0x9B59B6)
                    .setFooter({ text: 'Kavià Café — Alliance Hub Verification' })
                    .setTimestamp()],
                components: []
            });

        } catch (err) {
            console.error('Error handling verify_username_modal:', err);
        }
    }
    // ── Verify + Create Alliance Modal ──
    if (interaction.customId.startsWith('verify_create_alliance_modal_')) {
        try {
            const withoutPrefix = interaction.customId.replace('verify_create_alliance_modal_', '');
            const firstUnderscore = withoutPrefix.indexOf('_');
            const userId = withoutPrefix.substring(0, firstUnderscore);
            const messageId = withoutPrefix.substring(firstUnderscore + 1);

            const allianceName = interaction.fields.getTextInputValue('alliance_name').trim();
            const teamNum = parseInt(interaction.fields.getTextInputValue('team_number').trim());
            const discordLink = interaction.fields.getTextInputValue('discord_link')?.trim() || 'N/A';
            const robloxLink = interaction.fields.getTextInputValue('roblox_link')?.trim() || 'N/A';

            if (isNaN(teamNum) || teamNum < 1 || teamNum > 5) {
                return await interaction.reply({ content: '❌ Team number must be between 1 and 5.', ephemeral: true });
            }

            await interaction.deferUpdate();

            const TEAM_CATEGORY_MAP = {
                1: '1451290397086060705', 2: '1451292986557337761',
                3: '1451294316000579848', 4: '1536082175475195976',
                5: '1536082236653178910'
            };
            const TEAM_ROLE_MAP_LOCAL = {
                1: '1536084366080610414', 2: '1536084453234053221',
                3: '1536084519650598944', 4: '1536084475669254305',
                5: '1536084576043147385'
            };
            const VIEWER_ROLE_ID_LOCAL = '1449021407282593937';

            const guild = await client.guilds.fetch(ALLIANCE_GUILD_ID).catch(() => null);
            if (!guild) return;

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return;

            const { findAlliance, saveAlliance } = require('./utils/allianceStorage');
            const { refreshAllianceList } = require('./utils/refreshAllianceList');
            const { postTeamLog } = require('./utils/teamLog');

            // Check alliance doesn't already exist
            const existing = await findAlliance(allianceName).catch(() => null);
            if (existing) {
                // Alliance exists — just verify the rep into it
                await member.roles.add(ALLIED_REPS_ROLE_ID).catch(console.error);
                if (existing.repRoleId) await member.roles.add(existing.repRoleId).catch(console.error);
                if (!existing.theirRepIds.includes(userId)) {
                    existing.theirRepIds.push(userId);
                    existing.theirReps = existing.theirRepIds.map(id => `<@${id}>`).join(' ');
                    existing.markModified('theirRepIds');
                    existing.markModified('theirReps');
                    await saveAlliance(existing).catch(console.error);
                }
            } else {
                // Create the alliance
                const categoryId = TEAM_CATEGORY_MAP[teamNum];
                const teamRoleId = TEAM_ROLE_MAP_LOCAL[teamNum];

                const theirRole = await guild.roles.create({
                    name: allianceName,
                    reason: `Alliance role for ${allianceName} — created via verification`
                });

                // Fetch team members for our reps
                await guild.members.fetch();
                const teamMembers = guild.members.cache.filter(m => m.roles.cache.has(teamRoleId));
                const ourRepIds = [...teamMembers.values()].map(m => m.id);
                const ourRepsStr = ourRepIds.map(id => `<@${id}>`).join(' ') || 'N/A';

                // Create channel
                const channel = await guild.channels.create({
                    name: allianceName.toLowerCase().replace(/\s+/g, '-'),
                    type: 0, // GuildText
                    parent: categoryId,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: theirRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: teamRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: VIEWER_ROLE_ID_LOCAL, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] }
                    ]
                });

                // Assign roles to the new rep
                await member.roles.add(ALLIED_REPS_ROLE_ID).catch(console.error);
                await member.roles.add(theirRole).catch(console.error);

                // Save alliance
                await saveAlliance({
                    groupName: allianceName,
                    ourReps: ourRepsStr,
                    theirReps: `<@${userId}>`,
                    discordLink,
                    robloxLink,
                    repRoleId: theirRole.id,
                    ourRepRoleId: null,
                    welcomeChannelId: channel.id,
                    team: teamNum,
                    strikes: [],
                    theirRepIds: [userId],
                    ourRepIds
                });

                await refreshAllianceList(client);

                // Send welcome message
                const teamMemberLines = [...teamMembers.values()].map(m => `**• <@${m.id}>**`).join('\n') || '**• TBD**';
                await channel.send({
                    content: `:tada: **Welcome New Alliance! | Kavi Café x ${allianceName}** :tada:\n\nWe're thrilled to officially welcome your community into an alliance with Kavi Café! :star2:\n\n:speech_balloon: **Questions & Support**\nIf you have any questions, concerns, or suggestions, this is the perfect place to share them.\n\n:busts_in_silhouette: **Your Representative Pair**\nPlease meet your Kavi Café representatives:\n\n${teamMemberLines}\n\n:handshake: **Looking Ahead**\nWe're so excited to be working together and building a strong relationship.\n\n:coffee::sparkles: Here's to a successful partnership between **Kavi Café** and **${allianceName}**! :sparkles::coffee:`
                });

                // Team log
                const createEmbed = new EmbedBuilder()
                    .setTitle(`✨ New Alliance Created via Verification: ${allianceName}`)
                    .setColor('Blue')
                    .addFields(
                        { name: 'Created By', value: interaction.user.tag, inline: true },
                        { name: 'First Rep', value: `<@${userId}>`, inline: true },
                        { name: 'Channel', value: `<#${channel.id}>`, inline: false }
                    )
                    .setTimestamp();
                await postTeamLog(client, teamNum, allianceName, createEmbed);

                // Welcome DM
                try {
                    await member.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('✅ Verification Accepted!')
                            .setDescription(`Hey <@${userId}>! 🎉\n\nYour verification has been **accepted** and your alliance **${allianceName}** has been created in the hub!\n\nYou now have access to <#${channel.id}>. Welcome! ☕💜`)
                            .setColor(0x9B59B6)
                            .setFooter({ text: 'Kavià Café — Alliance Hub' })
                            .setTimestamp()]
                    });
                } catch {}

                // Update the staff log message
                await interaction.message.edit({
                    embeds: [EmbedBuilder.from(interaction.message.embeds[0])
                        .setTitle('✅ Verification — Accepted + Alliance Created')
                        .setColor('Green')
                        .addFields(
                            { name: 'Alliance Created', value: allianceName, inline: true },
                            { name: 'Team', value: `Team ${teamNum}`, inline: true },
                            { name: 'Reviewed By', value: interaction.user.tag, inline: true }
                        )],
                    components: []
                }).catch(console.error);

                // Delete original verification messages
                const verifyChannel = await client.channels.fetch(activeVerificationChannelId).catch(() => null);
                if (verifyChannel) {
                    const originalMsg = await verifyChannel.messages.fetch(messageId).catch(() => null);
                    if (originalMsg) await originalMsg.delete().catch(console.error);
                    const pending = pendingVerifications.get(messageId);
                    if (pending?.promptMessageId) {
                        const promptMsg = await verifyChannel.messages.fetch(pending.promptMessageId).catch(() => null);
                        if (promptMsg) await promptMsg.delete().catch(console.error);
                    }
                }
                pendingVerifications.delete(messageId);
                return;
            }
        } catch (err) {
            console.error('Error handling verify_create_alliance_modal:', err);
        }
    }

    // ── Pay system modals ──
    if (interaction.customId.startsWith('pay_override_modal_') ||
        interaction.customId.startsWith('pay_deduction_modal_')) {
        const payCalc = client.commands.get('pay-calculate');
        if (payCalc) await payCalc.handleModal(interaction, client);
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

            pendingVerifications.delete(messageId);

            // Clean all user messages from verification channel
            await cleanVerificationChannelForUser(client, userId);

            // Remove the unverified role if still present (they may re-verify)
            try {
                const guild = await client.guilds.fetch(ALLIANCE_GUILD_ID).catch(() => null);
                if (guild) {
                    const member = await guild.members.fetch(userId).catch(() => null);
                    // Keep unverified role — they were denied and need to re-verify
                    // (don't remove it on deny so the 24hr reminder still pings them)
                }
            } catch {}

            try {
                const user = await client.users.fetch(userId);
                await user.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Verification Denied')
                        .setDescription(
                            `Hey <@${userId}>,\n\n` +
                            `Unfortunately your verification submission was **denied**.\n\n` +
                            `**Reason:** ${reason}\n\n` +
                            `Please click the **✨ Verify Me** button in <#${activeVerificationChannelId}> to restart your verification. 💜`
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

    // Track hub messages for weekly stats
    if (message.guild?.id === ALLIANCE_GUILD_ID) {
        stats.hubMessage(message.author.id);
    }

    // ── Proof-of-invite capture in verification channel ──
    // When a user is in the verifyProofPending Map, their next message with an attachment or link is their proof
    if (message.guild?.id === ALLIANCE_GUILD_ID && message.channel.id === activeVerificationChannelId) {
        const proofSession = verifyProofPending.get(message.author.id);
        if (proofSession) {
            const imageUrl = message.attachments.first()?.url || null;
            const textContent = message.content.trim();
            const hasProof = imageUrl || textContent.startsWith('http');

            if (!hasProof) {
                // Not a valid proof — delete and prompt again
                await message.delete().catch(() => {});
                try {
                    const channel = await client.channels.fetch(activeVerificationChannelId).catch(() => null);
                    if (channel) {
                        const warn = await channel.send({
                            content: `<@${message.author.id}> Please attach a **screenshot** or paste an **image link** as your proof of invite. 💜`
                        });
                        setTimeout(() => warn.delete().catch(() => {}), 8_000);
                    }
                } catch {}
                return;
            }

            proofSession.proofUrl = imageUrl || textContent;
            proofSession.messageIds.push(message.id);
            verifyProofPending.delete(message.author.id);

            // Delete the proof message from the channel after capturing it
            await message.delete().catch(() => {});

            // Send to verification log
            const verifyLogChannel = await client.channels.fetch(VERIFICATION_LOG_CHANNEL_ID).catch(() => null);
            if (!verifyLogChannel) return;

            const sessionKey = proofSession.sessionKey;
            const isNotFound = proofSession.allianceName === '__NOT_FOUND__';

            const embed = new EmbedBuilder()
                .setTitle('📋 New Verification Submission')
                .setColor(0x9B59B6)
                .addFields(
                    { name: 'User', value: `<@${proofSession.userId}> (${proofSession.userTag})`, inline: true },
                    { name: 'Submitted At', value: new Date().toLocaleString(), inline: true },
                    { name: 'Alliance', value: isNotFound
                        ? `❓ Not Listed — "${proofSession.allianceNameClaim || 'Unknown'}"` 
                        : proofSession.allianceName, inline: false },
                    { name: 'Roblox Username', value: proofSession.robloxUsername, inline: true },
                    { name: 'In Roblox Group?', value: proofSession.inKaviaGroup ? '✅ Yes' : '❌ No', inline: true }
                )
                .setFooter({ text: 'Kavià Café — Alliance Hub Verification' })
                .setTimestamp();

            if (proofSession.invitedBy) embed.addFields({ name: 'Invited By', value: proofSession.invitedBy, inline: true });
            if (proofSession.proofUrl) embed.setImage(proofSession.proofUrl);

            const components = [];
            if (isNotFound) {
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`verify_create_alliance_${proofSession.userId}_${sessionKey}`)
                        .setLabel('✅ Verify + Create Alliance')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`verify_accept_${proofSession.userId}_${sessionKey}`)
                        .setLabel('✅ Verify Only')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`verify_deny_${proofSession.userId}_${sessionKey}`)
                        .setLabel('❌ Deny')
                        .setStyle(ButtonStyle.Danger)
                ));
            } else {
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`verify_accept_${proofSession.userId}_${sessionKey}`)
                        .setLabel('✅ Accept')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`verify_deny_${proofSession.userId}_${sessionKey}`)
                        .setLabel('❌ Deny')
                        .setStyle(ButtonStyle.Danger)
                ));
            }

            await verifyLogChannel.send({
                content: `<@&${ALLOWED_ROLE_ID}>`,
                embeds: [embed],
                components,
                allowedMentions: { roles: [ALLOWED_ROLE_ID] }
            });

            // Store in pendingVerifications for accept/deny handlers
            pendingVerifications.set(sessionKey, {
                userId: proofSession.userId,
                userTag: proofSession.userTag,
                selectedAlliance: proofSession.allianceName,
                allianceNameClaim: proofSession.allianceNameClaim || null,
                invitedBy: proofSession.invitedBy || null,
                robloxUsername: proofSession.robloxUsername,
                robloxUserId: proofSession.robloxUserId,
                proofUrl: proofSession.proofUrl,
                messageIds: proofSession.messageIds
            });

            // Update the step message to show submitted
            if (proofSession.stepMessageId) {
                const channel = await client.channels.fetch(activeVerificationChannelId).catch(() => null);
                if (channel) {
                    const stepMsg = await channel.messages.fetch(proofSession.stepMessageId).catch(() => null);
                    if (stepMsg) {
                        await stepMsg.edit({
                            embeds: [new EmbedBuilder()
                                .setTitle('✅ Verification Submitted!')
                                .setDescription(
                                    `Your verification has been submitted and is now being reviewed by our PR team. You'll receive a DM once a decision has been made. 💜\n\n` +
                                    `*Please don't send any more messages here — this channel will be cleaned up once your verification is processed.*`
                                )
                                .setColor('Green')
                                .setFooter({ text: 'Kavià Café — Alliance Hub Verification' })
                                .setTimestamp()],
                            components: []
                        }).catch(() => {});
                    }
                }
            }
            return;
        }

        // Any other message in the verify channel from a non-pending user — delete it
        // (keep bots and pinned messages alone)
        await message.delete().catch(() => {});
        return;
    }

    if (message.guild) {
        const checkin = client.commands.get('checkin');
        if (checkin) await checkin.handleCheckinReply(message, client);

        const topost = client.commands.get('topost');
        if (topost) await topost.handleTopostReply(message, client);
        return;
    }

    // ── Pay system: capture Roblox username replies in DMs ──
    const payCalc = client.commands.get('pay-calculate');
    if (payCalc?.handleDM) await payCalc.handleDM(message, client);

    const starttraining = client.commands.get('starttraining');
    if (starttraining) await starttraining.handleMessage(message, client);
});


client.login(process.env.TOKEN);