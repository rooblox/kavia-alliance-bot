const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { findAlliance, saveAlliance } = require('../utils/allianceStorage');
const { refreshAllianceList } = require('../utils/refreshAllianceList');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-edit')
        .setDescription('Edit an existing alliance')
        .addStringOption(option =>
            option.setName('group_name')
                .setDescription('The alliance group name to edit')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('their_rep_1')
                .setDescription('Update their first rep'))
        .addUserOption(option =>
            option.setName('their_rep_2')
                .setDescription('Update their second rep'))
        .addUserOption(option =>
            option.setName('our_rep_1')
                .setDescription('Update our first rep'))
        .addUserOption(option =>
            option.setName('our_rep_2')
                .setDescription('Update our second rep'))
        .addChannelOption(option =>
            option.setName('welcome_channel')
                .setDescription('Set or update the alliance channel')
                .addChannelTypes(ChannelType.GuildText))
        .addStringOption(option =>
            option.setName('discord_link')
                .setDescription('Updated Discord link'))
        .addStringOption(option =>
            option.setName('roblox_link')
                .setDescription('Updated Roblox link'))
        .addStringOption(option =>
            option.setName('group_name_new')
                .setDescription('Rename the alliance')),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const groupName = interaction.options.getString('group_name');
            const theirRep1 = interaction.options.getMember('their_rep_1');
            const theirRep2 = interaction.options.getMember('their_rep_2');
            const ourRep1 = interaction.options.getMember('our_rep_1');
            const ourRep2 = interaction.options.getMember('our_rep_2');
            const welcomeChannel = interaction.options.getChannel('welcome_channel');
            const discordLink = interaction.options.getString('discord_link');
            const robloxLink = interaction.options.getString('roblox_link');
            const newGroupName = interaction.options.getString('group_name_new');

            const alliance = await findAlliance(groupName);
            if (!alliance) return await interaction.editReply(`❌ Alliance **${groupName}** not found.`);

            const guild = interaction.guild;

            // ── Update welcome channel ──
            if (welcomeChannel) {
                alliance.welcomeChannelId = welcomeChannel.id;
            }

            // ── Update their reps ──
            if (theirRep1 || theirRep2) {
                const oldTheirRepIds = alliance.theirRepIds || [];
                for (const repId of oldTheirRepIds) {
                    const member = await guild.members.fetch(repId).catch(() => null);
                    if (member && alliance.repRoleId) {
                        await member.roles.remove(alliance.repRoleId).catch(console.error);
                    }
                }

                const newTheirRepIds = [];
                if (theirRep1) {
                    if (alliance.repRoleId) await theirRep1.roles.add(alliance.repRoleId).catch(console.error);
                    newTheirRepIds.push(theirRep1.id);
                }
                if (theirRep2) {
                    if (alliance.repRoleId) await theirRep2.roles.add(alliance.repRoleId).catch(console.error);
                    newTheirRepIds.push(theirRep2.id);
                }

                alliance.theirRepIds = newTheirRepIds;
                alliance.theirReps = newTheirRepIds.map(id => `<@${id}>`).join(' ');
            }

            // ── Update our reps ──
            if (ourRep1 || ourRep2) {
                const oldOurRepIds = alliance.ourRepIds || [];
                for (const repId of oldOurRepIds) {
                    const member = await guild.members.fetch(repId).catch(() => null);
                    if (member && alliance.ourRepRoleId) {
                        await member.roles.remove(alliance.ourRepRoleId).catch(console.error);
                    }
                }

                const newOurRepIds = [];
                if (ourRep1) {
                    if (alliance.ourRepRoleId) await ourRep1.roles.add(alliance.ourRepRoleId).catch(console.error);
                    newOurRepIds.push(ourRep1.id);
                }
                if (ourRep2) {
                    if (alliance.ourRepRoleId) await ourRep2.roles.add(alliance.ourRepRoleId).catch(console.error);
                    newOurRepIds.push(ourRep2.id);
                }

                alliance.ourRepIds = newOurRepIds;
                alliance.ourReps = newOurRepIds.map(id => `<@${id}>`).join(' ');
            }

            // ── Update other fields ──
            if (discordLink) alliance.discordLink = discordLink;
            if (robloxLink) alliance.robloxLink = robloxLink;

            // ── Rename alliance if requested ──
            if (newGroupName) {
                if (alliance.repRoleId) {
                    const theirRole = guild.roles.cache.get(alliance.repRoleId);
                    if (theirRole) await theirRole.setName(newGroupName).catch(console.error);
                }
                if (alliance.ourRepRoleId) {
                    const ourRole = guild.roles.cache.get(alliance.ourRepRoleId);
                    if (ourRole) await ourRole.setName(`Rep Pair | ${newGroupName}`).catch(console.error);
                }
                if (alliance.welcomeChannelId) {
                    const ch = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
                    if (ch) await ch.setName(newGroupName.toLowerCase().replace(/\s+/g, '-')).catch(console.error);
                }
                alliance.groupName = newGroupName;
            }

            // ── Send updated welcome message if reps or channel changed ──
            if ((ourRep1 || ourRep2) && alliance.welcomeChannelId) {
                const channel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
                if (channel) {
                    const ourRepsArray = [ourRep1, ourRep2].filter(Boolean);
                    const welcomeMessage = `:tada: **Updated Representative Pair! | Kavi Café x ${newGroupName || groupName}** :tada:

We'd like to introduce your updated Kavi Café representative pair!

:busts_in_silhouette: **Your Representative Pair**
Please meet your Kavi Café representatives:

**• ${ourRepsArray[0] ? `<@${ourRepsArray[0].id}>` : 'TBD'}**
**• ${ourRepsArray[1] ? `<@${ourRepsArray[1].id}>` : 'TBD'}**

:handshake: We look forward to continuing our strong partnership!

:coffee::sparkles: Thank you for being an amazing alliance — **Kavi Café** appreciates you! :sparkles::coffee:`;
                    await channel.send({ content: welcomeMessage });
                }
            }

            await saveAlliance(alliance);
            await refreshAllianceList(client);

            await interaction.editReply(`✅ Alliance **${groupName}** successfully updated!`);

        } catch (err) {
            console.error('Error executing alliance-edit:', err);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ There was an error executing this command.');
            }
        }
    }
};