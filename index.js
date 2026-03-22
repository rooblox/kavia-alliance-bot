require('dotenv').config();
const fs = require('fs');
const { Client, Collection, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const { connectDB } = require('./db');

const ALLOWED_ROLE_ID = '1485100238715883720';
const CLIENT_ID = process.env.CLIENT_ID;
const LOG_CHANNEL_ID = '1462580398935642144';
const TERMINATED_CATEGORY_ID = '1428837884252786819';

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
        console.error(`❌ Failed to deploy to guild ${guildId}:`, err);
    }
}

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    await connectDB();
    for (const guild of client.guilds.cache.values()) {
        await deployToGuild(guild.id);
    }
});

client.on('guildCreate', async (guild) => {
    console.log(`Joined new guild: ${guild.name}`);
    await deployToGuild(guild.id);
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

    // ── Strike acknowledgement ──
    if (interaction.customId.startsWith('strike_understood_')) {
        try {
            const parts = interaction.customId.replace('strike_understood_', '').split('_');
            const userId = parts[0];
            const groupName = parts.slice(1, -1).join(' ');
            const actionLabel = parts[parts.length - 1];

            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ This button is not for you.', ephemeral: true });
            }

            await interaction.reply({ content: '✅ Thank you for acknowledging the strike.', ephemeral: true });

            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                await logChannel.send({
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

            await interaction.reply({
                content: '✅ Thank you for acknowledging. You will now be removed from the server.',
                ephemeral: true
            });

            const pendingData = client._disciplinePending?.get(groupName);
            if (pendingData) pendingData.pendingKicks.delete(userId);

            const guild = await client.guilds.fetch(interaction.guildId).catch(() => null);
            if (!guild) return;

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return;

            // DM before kick
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

            // Kick
            await member.kick(`Alliance ${actionLabel} acknowledged`).catch(console.error);

            // If all reps acknowledged — delete roles and archive channel
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
                client._disciplinePending.delete(groupName);
            }

            // Log
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                await logChannel.send({
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