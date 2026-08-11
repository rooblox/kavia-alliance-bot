const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { findAlliance, saveAlliance } = require('../utils/allianceStorage');
const { refreshAllianceList } = require('../utils/refreshAllianceList');
const { postTeamLog } = require('../utils/teamLog');

const TEAM_CATEGORY_MAP = {
    1: '1451290397086060705',
    2: '1451292986557337761',
    3: '1451294316000579848',
    4: '1536082175475195976',
    5: '1536082236653178910'
};

const TEAM_ROLE_MAP = {
    1: '1536084366080610414',
    2: '1536084453234053221',
    3: '1536084519650598944',
    4: '1536084475669254305',
    5: '1536084576043147385'
};

const ALLIED_REPS_ROLE_ID = '1417866883750957188';
const VIEWER_ROLE_ID = '1449021407282593937';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-add')
        .setDescription('Add a new alliance')
        .addStringOption(option =>
            option.setName('group_name')
                .setDescription('Name of the alliance group')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('team')
                .setDescription('Which team this alliance belongs to')
                .setRequired(true)
                .addChoices(
                    { name: 'Team 1', value: 1 },
                    { name: 'Team 2', value: 2 },
                    { name: 'Team 3', value: 3 },
                    { name: 'Team 4', value: 4 },
                    { name: 'Team 5', value: 5 }
                ))
        .addUserOption(option =>
            option.setName('their_rep_1')
                .setDescription('Their first rep')
                .setRequired(false))
        .addUserOption(option =>
            option.setName('their_rep_2')
                .setDescription('Their second rep')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('discord_link')
                .setDescription('Discord link of the alliance'))
        .addStringOption(option =>
            option.setName('roblox_link')
                .setDescription('Roblox link of the alliance')),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const groupName = interaction.options.getString('group_name');
            const team = interaction.options.getInteger('team');
            const discordLink = interaction.options.getString('discord_link') || 'N/A';
            const robloxLink = interaction.options.getString('roblox_link') || 'N/A';
            const theirRep1 = interaction.options.getMember('their_rep_1');
            const theirRep2 = interaction.options.getMember('their_rep_2');

            const existing = await findAlliance(groupName);
            if (existing) {
                return await interaction.editReply(`❌ Alliance **${groupName}** already exists.`);
            }

            const guild = interaction.guild;
            const categoryId = TEAM_CATEGORY_MAP[team];
            const teamRoleId = TEAM_ROLE_MAP[team];

            await interaction.editReply('⏳ Setting up alliance... creating roles and channel.');

            // ── Auto-fetch our reps from team role ──
            await guild.members.fetch();
            const teamMembers = guild.members.cache.filter(m => m.roles.cache.has(teamRoleId));
            const ourRepsArray = [...teamMembers.values()];
            const ourRepIds = ourRepsArray.map(m => m.id);
            const ourRepsStr = ourRepsArray.map(m => `<@${m.id}>`).join(' ') || 'N/A';

            // Build their rep strings
            const theirRepsStr = [theirRep1, theirRep2]
                .filter(Boolean)
                .map(m => `<@${m.id}>`)
                .join(' ') || 'N/A';

            // ── Create their rep role ──
            const theirRole = await guild.roles.create({
                name: groupName,
                reason: `Alliance role for ${groupName}`
            });

            // ── Assign roles to their reps (alliance role + allied reps role + team role) ──
            if (theirRep1) {
                await theirRep1.roles.add(theirRole).catch(console.error);
                await theirRep1.roles.add(ALLIED_REPS_ROLE_ID).catch(console.error);
                if (teamRoleId && !theirRep1.roles.cache.has(teamRoleId)) {
                    await theirRep1.roles.add(teamRoleId).catch(console.error);
                }
            }
            if (theirRep2) {
                await theirRep2.roles.add(theirRole).catch(console.error);
                await theirRep2.roles.add(ALLIED_REPS_ROLE_ID).catch(console.error);
                if (teamRoleId && !theirRep2.roles.cache.has(teamRoleId)) {
                    await theirRep2.roles.add(teamRoleId).catch(console.error);
                }
            }

            // ── Create channel ──
            const channel = await guild.channels.create({
                name: groupName.toLowerCase().replace(/\s+/g, '-'),
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: theirRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: teamRoleId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: VIEWER_ROLE_ID,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    }
                ],
                reason: `Alliance channel for ${groupName}`
            });

            // ── Send welcome message only if at least one their-rep is provided ──
            const hasAnyRep = !!(theirRep1 || theirRep2);
            if (hasAnyRep) {
                const repLines = ourRepsArray.length > 0
                    ? ourRepsArray.map(m => `**• <@${m.id}>**`).join('\n')
                    : '**• TBD**';

                const welcomeMessage = `:tada: **Welcome New Alliance! | Kavi Café x ${groupName}** :tada:

We're thrilled to officially welcome your community into an alliance with Kavi Café! :star2:

:speech_balloon: **Questions & Support**
If you have any questions, concerns, or suggestions, this is the perfect place to share them.

:busts_in_silhouette: **Your Representative Pair**
Please meet your Kavi Café representatives:

${repLines}

:handshake: **Looking Ahead**
We're so excited to be working together and building a strong relationship.

:coffee::sparkles: Here's to a successful partnership between **Kavi Café** and **${groupName}**! :sparkles::coffee:`;
                await channel.send({ content: welcomeMessage });
            }

            // ── Log embed ──
            const logEmbed = new EmbedBuilder()
                .setTitle(`✨ New Alliance Added: ${groupName}`)
                .setColor('Blue')
                .addFields(
                    { name: 'Their Reps', value: theirRepsStr },
                    { name: 'Our Reps (Team)', value: ourRepsStr },
                    { name: 'Discord Link', value: discordLink },
                    { name: 'Roblox Link', value: robloxLink },
                    { name: 'Channel', value: `<#${channel.id}>` },
                    { name: 'Their Role', value: `<@&${theirRole.id}>` },
                    { name: 'Added By', value: interaction.user.tag }
                )
                .setTimestamp();

            await postTeamLog(client, team, groupName, logEmbed);

            const logChannel = guild.channels.cache.find(ch => ch.name === 'alliance-add');
            if (logChannel) await logChannel.send({ embeds: [logEmbed] });

            // ── Save to MongoDB ──
            await saveAlliance({
                groupName,
                ourReps: ourRepsStr,
                theirReps: theirRepsStr,
                discordLink,
                robloxLink,
                repRoleId: theirRole.id,
                ourRepRoleId: null,
                welcomeChannelId: channel.id,
                team,
                strikes: [],
                theirRepIds: [theirRep1?.id, theirRep2?.id].filter(Boolean),
                ourRepIds
            });

            await refreshAllianceList(client);
            await interaction.editReply(
                `✅ Alliance **${groupName}** successfully set up under **Team ${team}**!\n\n` +
                `• Channel: <#${channel.id}>\n` +
                `• Their role: <@&${theirRole.id}>\n` +
                `• Our reps (from team role): ${ourRepsStr}`
            );

        } catch (err) {
            console.error('Error executing alliance-add:', err);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ There was an error executing this command.');
            }
        }
    }
};