const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelSelectMenuBuilder, UserSelectMenuBuilder, ChannelType } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

const activeSendTeamLinks = new Map();

// Role IDs that count as "team member" — all 5 team roles + leadership/staff roles
const TEAM_MEMBER_ROLE_IDS = new Set([
    '1536084366080610414', // Team 1
    '1536084453234053221', // Team 2
    '1536084519650598944', // Team 3
    '1536084475669254305', // Team 4
    '1536084576043147385', // Team 5
    '1449021407282593937', // Leadership / Viewer
    '1417861483899130007', // Staff bypass
    '1435434983991939072', // Staff bypass
    '1417862070308700231', // Staff bypass
    '1417862149346299967', // Staff bypass
    '1417862179108950198', // Staff bypass
]);

function isTeamMember(member) {
    return member.roles.cache.some(r => TEAM_MEMBER_ROLE_IDS.has(r.id));
}

async function buildLinkEmbeds(session, showServerLink = false) {
    const alliances = await loadAlliances().catch(() => []);

    let targets = [];
    if (session.scope === 'alliance') {
        const found = alliances.find(a => a.groupName === session.allianceName);
        if (found) targets = [found];
    } else {
        targets = alliances.filter(a => a.team === session.team);
    }

    if (!targets.length) {
        return [new EmbedBuilder()
            .setTitle('❌ No Alliances Found')
            .setDescription('No alliances found for the selected scope.')
            .setColor('Red')];
    }

    const title = session.scope === 'team'
        ? `🔗 Team ${session.team} — Alliance Links`
        : `🔗 ${targets[0].groupName} — Links`;

    const embeds = [];
    let currentEmbed = new EmbedBuilder().setTitle(title).setColor(0x9B59B6).setTimestamp();
    let fieldCount = 0;

    for (const a of targets) {
        const discordVal = a.discordLink && a.discordLink !== 'N/A' ? `[Join Discord](${a.discordLink})` : 'N/A';
        const robloxVal = a.robloxLink && a.robloxLink !== 'N/A' ? `[View Group](${a.robloxLink})` : 'N/A';
        const serverVal = a.allianceServerLink && a.allianceServerLink !== 'N/A' ? `[Alliance Server](${a.allianceServerLink})` : 'N/A';

        if (fieldCount >= 24) {
            embeds.push(currentEmbed);
            currentEmbed = new EmbedBuilder().setTitle(`${title} (cont.)`).setColor(0x9B59B6);
            fieldCount = 0;
        }

        const valueLines = [
            `🎮 **Roblox:** ${robloxVal}`,
            `💬 **Discord:** ${discordVal}`
        ];
        if (showServerLink) {
            valueLines.push(`🏰 **Alliance Server:** ${serverVal}`);
        }

        currentEmbed.addFields({
            name: `✨ ${a.groupName}`,
            value: valueLines.join('\n'),
            inline: false
        });
        fieldCount++;
    }

    embeds.push(currentEmbed);
    return embeds;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sendteamlinks')
        .setDescription('Send alliance links for a team or specific alliance')
        .addStringOption(option =>
            option.setName('scope')
                .setDescription('Send links for a whole team or a specific alliance')
                .setRequired(true)
                .addChoices(
                    { name: '👥 Whole Team', value: 'team' },
                    { name: '🏛️ Specific Alliance', value: 'alliance' }
                ))
        .addStringOption(option =>
            option.setName('delivery')
                .setDescription('Where to send the links')
                .setRequired(true)
                .addChoices(
                    { name: '📩 My DMs', value: 'my_dms' },
                    { name: '📩 Another User\'s DMs', value: 'user_dms' },
                    { name: '📢 A Channel', value: 'channel' }
                ))
        .addStringOption(option =>
            option.setName('alliance_name')
                .setDescription('Alliance name (required if scope is Specific Alliance)')
                .setRequired(false)
                .setAutocomplete(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const alliances = await loadAlliances().catch(() => []);
        const filtered = alliances
            .filter(a => a.groupName.toLowerCase().includes(focusedValue))
            .slice(0, 25)
            .map(a => ({ name: a.groupName, value: a.groupName }));
        await interaction.respond(filtered);
    },

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const scope = interaction.options.getString('scope');
        const delivery = interaction.options.getString('delivery');
        const allianceName = interaction.options.getString('alliance_name');

        if (scope === 'alliance' && !allianceName) {
            return await interaction.editReply('❌ Please provide an alliance name when using **Specific Alliance** scope.');
        }

        // Check if requester is a team member (determines whether alliance server link is shown)
        const member = await interaction.guild.members.fetch({ user: interaction.user.id, force: true }).catch(() => null);
        const showServerLink = member ? isTeamMember(member) : false;

        const sessionId = `${interaction.user.id}_${Date.now()}`;
        activeSendTeamLinks.set(sessionId, {
            scope,
            delivery,
            allianceName: allianceName || null,
            userId: interaction.user.id,
            team: null,
            showServerLink
        });

        // Whole team — show team picker first
        if (scope === 'team') {
            const teamSelect = new StringSelectMenuBuilder()
                .setCustomId(`sendteamlinks_team_${sessionId}`)
                .setPlaceholder('Select a team...')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Team 1').setValue('1').setEmoji('1️⃣'),
                    new StringSelectMenuOptionBuilder().setLabel('Team 2').setValue('2').setEmoji('2️⃣'),
                    new StringSelectMenuOptionBuilder().setLabel('Team 3').setValue('3').setEmoji('3️⃣'),
                    new StringSelectMenuOptionBuilder().setLabel('Team 4').setValue('4').setEmoji('4️⃣'),
                    new StringSelectMenuOptionBuilder().setLabel('Team 5').setValue('5').setEmoji('5️⃣')
                );

            return await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('👥 Select Team')
                    .setDescription('Which team\'s alliance links would you like to send?')
                    .setColor(0x9B59B6)],
                components: [new ActionRowBuilder().addComponents(teamSelect)]
            });
        }

        // Specific alliance — go straight to delivery follow-up
        await showDeliveryFollowUp(interaction, sessionId, delivery);
    },

    async handleSelectMenu(interaction, client) {

        // ── Team selection ──
        if (interaction.customId.startsWith('sendteamlinks_team_')) {
            await interaction.deferUpdate();
            const sessionId = interaction.customId.replace('sendteamlinks_team_', '');
            const session = activeSendTeamLinks.get(sessionId);
            if (!session) {
                await interaction.editReply({ content: '❌ Session expired. Please run the command again.', components: [], embeds: [] });
                return;
            }
            session.team = parseInt(interaction.values[0]);
            await showDeliveryFollowUp(interaction, sessionId, session.delivery);
            return;
        }

        // ── Channel selection ──
        if (interaction.customId.startsWith('sendteamlinks_channel_')) {
            await interaction.deferUpdate();
            const sessionId = interaction.customId.replace('sendteamlinks_channel_', '');
            const session = activeSendTeamLinks.get(sessionId);
            if (!session) {
                await interaction.editReply({ content: '❌ Session expired.', components: [], embeds: [] });
                return;
            }

            const channelId = interaction.values[0];
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel) {
                await interaction.editReply({ content: '❌ Channel not found.', components: [], embeds: [] });
                return;
            }

            const embeds = await buildLinkEmbeds(session, session.showServerLink);
            for (const embed of embeds) await channel.send({ embeds: [embed] }).catch(console.error);

            activeSendTeamLinks.delete(sessionId);
            await interaction.editReply({
                embeds: [new EmbedBuilder().setTitle('✅ Sent!').setDescription(`Links sent to <#${channelId}>.`).setColor('Green')],
                components: []
            });
            return;
        }

        // ── User DM selection ──
        if (interaction.customId.startsWith('sendteamlinks_user_')) {
            await interaction.deferUpdate();
            const sessionId = interaction.customId.replace('sendteamlinks_user_', '');
            const session = activeSendTeamLinks.get(sessionId);
            if (!session) {
                await interaction.editReply({ content: '❌ Session expired.', components: [], embeds: [] });
                return;
            }

            const targetUserId = interaction.values[0];
            const targetUser = await client.users.fetch(targetUserId).catch(() => null);
            if (!targetUser) {
                await interaction.editReply({ content: '❌ User not found.', components: [], embeds: [] });
                return;
            }

            const embeds = await buildLinkEmbeds(session, session.showServerLink);
            try {
                for (const embed of embeds) await targetUser.send({ embeds: [embed] });
                activeSendTeamLinks.delete(sessionId);
                await interaction.editReply({
                    embeds: [new EmbedBuilder().setTitle('✅ Sent!').setDescription(`Links sent to **${targetUser.tag}**'s DMs.`).setColor('Green')],
                    components: []
                });
            } catch {
                await interaction.editReply({ content: '❌ Could not DM that user — they may have DMs disabled.', embeds: [], components: [] });
            }
            return;
        }
    },

    activeSendTeamLinks
};

async function showDeliveryFollowUp(interaction, sessionId, delivery) {
    const session = activeSendTeamLinks.get(sessionId);

    if (delivery === 'my_dms') {
        const embeds = await buildLinkEmbeds(session, session.showServerLink);
        try {
            for (const embed of embeds) await interaction.user.send({ embeds: [embed] });
            activeSendTeamLinks.delete(sessionId);
            await interaction.editReply({
                embeds: [new EmbedBuilder().setTitle('✅ Sent!').setDescription('Links sent to your DMs. 📩').setColor('Green')],
                components: []
            });
        } catch {
            await interaction.editReply({
                content: '❌ Could not DM you — please enable DMs from server members.',
                embeds: [],
                components: []
            });
        }
        return;
    }

    if (delivery === 'user_dms') {
        const userSelect = new UserSelectMenuBuilder()
            .setCustomId(`sendteamlinks_user_${sessionId}`)
            .setPlaceholder('Select a user to DM...')
            .setMinValues(1)
            .setMaxValues(1);

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('📩 Select User')
                .setDescription('Who should receive these links in their DMs?')
                .setColor(0x9B59B6)],
            components: [new ActionRowBuilder().addComponents(userSelect)]
        });
        return;
    }

    if (delivery === 'channel') {
        const channelSelect = new ChannelSelectMenuBuilder()
            .setCustomId(`sendteamlinks_channel_${sessionId}`)
            .setPlaceholder('Select a channel...')
            .addChannelTypes(ChannelType.GuildText)
            .setMinValues(1)
            .setMaxValues(1);

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('📢 Select Channel')
                .setDescription('Which channel should the links be sent to?')
                .setColor(0x9B59B6)],
            components: [new ActionRowBuilder().addComponents(channelSelect)]
        });
        return;
    }
}