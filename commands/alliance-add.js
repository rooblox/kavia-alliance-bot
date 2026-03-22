const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { findAlliance, saveAlliance } = require('../utils/allianceStorage');
const { refreshAllianceList } = require('../utils/refreshAllianceList');

const CATEGORY_MAP = {
    Restaurants: '1451290397086060705',
    Cafes: '1451292986557337761',
    Others: '1451294316000579848'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-add')
        .setDescription('Add a new alliance')
        .addStringOption(option =>
            option.setName('group_name')
                .setDescription('Name of the alliance group')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('section')
                .setDescription('Section of the alliance')
                .setRequired(true)
                .addChoices(
                    { name: 'Restaurants', value: 'Restaurants' },
                    { name: 'Cafes', value: 'Cafes' },
                    { name: 'Others', value: 'Others' }
                ))
        .addUserOption(option =>
            option.setName('their_rep_1')
                .setDescription('Their first rep (will receive alliance role)')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('their_rep_2')
                .setDescription('Their second rep (will receive alliance role)')
                .setRequired(false))
        .addUserOption(option =>
            option.setName('our_rep_1')
                .setDescription('Our first rep (will receive rep pair role)')
                .setRequired(false))
        .addUserOption(option =>
            option.setName('our_rep_2')
                .setDescription('Our second rep (will receive rep pair role)')
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
            const section = interaction.options.getString('section');
            const discordLink = interaction.options.getString('discord_link') || 'N/A';
            const robloxLink = interaction.options.getString('roblox_link') || 'N/A';
            const theirRep1 = interaction.options.getMember('their_rep_1');
            const theirRep2 = interaction.options.getMember('their_rep_2');
            const ourRep1 = interaction.options.getMember('our_rep_1');
            const ourRep2 = interaction.options.getMember('our_rep_2');

            const existing = await findAlliance(groupName);
            if (existing) {
                return await interaction.editReply(`❌ Alliance **${groupName}** already exists.`);
            }

            const guild = interaction.guild;
            const categoryId = CATEGORY_MAP[section];

            await interaction.editReply('⏳ Setting up alliance... creating roles and channel.');

            // Build rep strings automatically from user options
            const theirRepsStr = [theirRep1, theirRep2]
                .filter(Boolean)
                .map(m => `<@${m.id}>`)
                .join(' ') || 'N/A';

            const ourRepsStr = [ourRep1, ourRep2]
                .filter(Boolean)
                .map(m => `<@${m.id}>`)
                .join(' ') || 'N/A';

            // ── Create their rep role ──
            const theirRole = await guild.roles.create({
                name: groupName,
                reason: `Alliance role for ${groupName}`
            });

            // ── Create our rep pair role ──
            const ourRole = await guild.roles.create({
                name: `Rep Pair | ${groupName}`,
                reason: `Our rep pair role for ${groupName}`
            });

            // ── Assign roles ──
            if (theirRep1) await theirRep1.roles.add(theirRole).catch(console.error);
            if (theirRep2) await theirRep2.roles.add(theirRole).catch(console.error);
            if (ourRep1) await ourRep1.roles.add(ourRole).catch(console.error);
            if (ourRep2) await ourRep2.roles.add(ourRole).catch(console.error);

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
                        id: ourRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    }
                ],
                reason: `Alliance channel for ${groupName}`
            });

            // ── Send welcome message ──
            const ourRepsArray = [ourRep1, ourRep2].filter(Boolean);
            const welcomeMessage = `:tada: **Welcome New Alliance! | Kavi Café x ${groupName}** :tada:

We're thrilled to officially welcome your community into an alliance with Kavi Café! :star2:

:speech_balloon: **Questions & Support**
If you have any questions, concerns, or suggestions, this is the perfect place to share them.

:busts_in_silhouette: **Your Representative Pair**
Please meet your Kavi Café representatives:

**• ${ourRepsArray[0] ? `<@${ourRepsArray[0].id}>` : 'TBD'}**
**• ${ourRepsArray[1] ? `<@${ourRepsArray[1].id}>` : 'TBD'}**

:handshake: **Looking Ahead**
We're so excited to be working together and building a strong relationship.

:coffee::sparkles: Here's to a successful partnership between **Kavi Café** and **${groupName}**! :sparkles::coffee:`;

            await channel.send({ content: welcomeMessage });

            // ── Log embed ──
            const logEmbed = new EmbedBuilder()
                .setTitle(`New Alliance Added: ${groupName}`)
                .setColor('Blue')
                .addFields(
                    { name: 'Their Reps', value: theirRepsStr },
                    { name: 'Our Reps', value: ourRepsStr },
                    { name: 'Discord Link', value: discordLink },
                    { name: 'Roblox Link', value: robloxLink },
                    { name: 'Section', value: section },
                    { name: 'Channel', value: `<#${channel.id}>` },
                    { name: 'Their Role', value: `<@&${theirRole.id}>` },
                    { name: 'Our Rep Role', value: `<@&${ourRole.id}>` }
                )
                .setTimestamp();

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
                ourRepRoleId: ourRole.id,
                welcomeChannelId: channel.id,
                section,
                strikes: [],
                theirRepIds: [theirRep1?.id, theirRep2?.id].filter(Boolean),
                ourRepIds: [ourRep1?.id, ourRep2?.id].filter(Boolean)
            });

            await refreshAllianceList(client);
            await interaction.editReply(
                `✅ Alliance **${groupName}** successfully set up under **${section}**!\n\n` +
                `• Channel: <#${channel.id}>\n` +
                `• Their role: <@&${theirRole.id}>\n` +
                `• Our rep role: <@&${ourRole.id}>`
            );

        } catch (err) {
            console.error('Error executing alliance-add:', err);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ There was an error executing this command.');
            }
        }
    }
};