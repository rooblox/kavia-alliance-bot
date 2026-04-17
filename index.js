require('dotenv').config();
const fs = require('fs');
const { Client, Collection, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { connectDB, DisciplinePending, StrikePending, QotdSchedule } = require('./db');

const ALLOWED_ROLE_ID = '1485100238715883720';
const CLIENT_ID = process.env.CLIENT_ID;
const LOG_CHANNEL_ID = '1462580398935642144';
const DISCIPLINE_LOG_CHANNEL_ID = '1456389041770467370';
const TERMINATED_CATEGORY_ID = '1428837884252786819';
const WELCOME_CHANNEL_ID = '1385081586873008231';
const VERIFICATION_CHANNEL_ID = '1417865773271224350';

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

// Load commands
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

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    await connectDB();

    // Reload discipline pending from MongoDB
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

    // Reload strike pending from MongoDB
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

    // ── QOTD Scheduler ──
    const qotdCmd = client.commands.get('qotd');

    setInterval(async () => {
        try {
            const now = new Date();
            const estOffset = -5 * 60;
            const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
            const estMinutes = (utcMinutes + estOffset + 1440) % 1440;
            const estHour = Math.floor(estMinutes / 60);
            const estMin = estMinutes % 60;
            const estDay = now.getUTCDay();
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const todayName = dayNames[estDay];

            // Sunday 11PM EST reset
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

                            const postedLines = posted.length > 0
                                ? posted.map(d => `✅ **${d}** — <@${lastSchedule.days[d].userId}>`).join('\n')
                                : 'None';
                            const notPostedLines = notPosted.length > 0
                                ? notPosted.map(d => `❌ **${d}** — <@${lastSchedule.days[d].userId}>`).join('\n')
                                : 'None';
                            const unclaimedLines = unclaimed.length > 0
                                ? unclaimed.map(d => `⚪ **${d}**`).join('\n')
                                : 'None';

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

                        const newSchedule = await QotdSchedule.create({ weekStart, days: {}, messageId: null });
                        console.log('✅ QOTD schedule reset for new week');
                    }
                } catch (err) {
                    console.error('Failed to reset QOTD:', err);
                }
            }

            // 9AM EST daily reminder
            if (estHour === 9 && estMin === 0) {
                try {
                    const weekStart = qotdCmd.getWeekStart();
                    const schedule = await QotdSchedule.findOne({ weekStart });
                    if (!schedule) return;

                    const entry = schedule.days[todayName];
                    if (!entry?.userId) return;

                    const reminderChannel = await client.channels.fetch(qotdCmd.REMINDER_CHANNEL_ID).catch(() => null);
                    if (!reminderChannel) return;

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

                } catch (err) {
                    console.error('Failed to send QOTD reminder:', err);
                }
            }

            // 9PM EST follow-up reminder
            if (estHour === 21 && estMin === 0) {
                try {
                    const weekStart = qotdCmd.getWeekStart();
                    const schedule = await QotdSchedule.findOne({ weekStart });
                    if (!schedule) return;

                    const entry = schedule.days[todayName];
                    if (!entry?.userId || entry.completed) return;

                    const reminderChannel = await client.channels.fetch(qotdCmd.REMINDER_CHANNEL_ID).catch(() => null);
                    if (!reminderChannel) return;

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
                } catch (err) {
                    console.error('Failed to send QOTD follow-up reminder:', err);
                }
            }

        } catch (err) {
            console.error('QOTD scheduler error:', err);
        }
    }, 60 * 1000);
});

client.on('guildCreate', async (guild) => {
    console.log(`Joined new guild: ${guild.name}`);
    await deployToGuild(guild.id);
});

// Welcome message
client.on('guildMemberAdd', async (member) => {
    if (member.guild.id !== '1385081586285940796') return;
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

    // ── Strike acknowledgement ──
    if (interaction.customId.startsWith('strike_understood_')) {
        try {
            const parts = interaction.customId.replace('strike_understood_', '').split('_');
            const userId = parts[0];
            const actionLabel = parts[parts.length - 1];
            const groupName = parts.slice(1, -1).join(' ');

            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ This button is not for you.', ephemeral: true });
            }

            client._strikePending = client._strikePending || new Map();
            const key = `${groupName}_${actionLabel}`;
            if (!client._strikePending.has(key)) {
                client._strikePending.set(key, { acknowledged: new Set() });
            }
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

                await interaction.message.edit({
                    components: [new ActionRowBuilder().addComponents(...newButtons)]
                });
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

            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ This button is not for you.', ephemeral: true });
            }

            client._disciplineAcks = client._disciplineAcks || new Map();
            if (!client._disciplineAcks.has(groupName)) {
                client._disciplineAcks.set(groupName, new Set());
            }
            client._disciplineAcks.get(groupName).add(userId);

            await interaction.reply({
                content: '✅ Thank you for acknowledging. You will now be removed from the server.',
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

                await interaction.message.edit({
                    components: [new ActionRowBuilder().addComponents(...newButtons)]
                });
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
                            `**Regards,**\n` +
                            `**${pendingData?.staffName || 'PR Staff'}**\n` +
                            `**${pendingData?.rank || 'PR Staff'}**\n` +
                            `**Kavià || Public Relations Team**`
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
});

// Handle messages
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

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