const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelSelectMenuBuilder, UserSelectMenuBuilder, ChannelType } = require('discord.js');
const { loadAlliances, findAlliance } = require('../utils/allianceStorage');

const activeSendTeamLinks = new Map();

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

        const sessionId = `${interaction.user.id}_${Date.now()}`;

        // Validate specific alliance was provided
        if (scope === 'alliance' && !allianceName) {
            return await interaction.editReply('❌ Please provide an alliance name when using **Specific Alliance** scope.');
        }

        // Store session
        activeSendTeamLinks.set(sessionId, {
            scope,
            delivery,
            allianceName: allianceName || null,
            userId: interaction.user.id,
            guildId: interaction.guild.id
        });

        // If whole team — show team picker
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
        await handleDeliveryFollowUp(interaction, sessionId, delivery, null, client);
    },

    async handleSelectMenu(interaction, client) {
        // ── Team selection ──
        if (interaction.customId.startsWith('sendteamlinks_team_')) {
            const sessionId = interaction.customId.replace('sendteamlinks_team_', '');
            const session = activeSendTeamLinks.get(sessionId);
            if (!session) return interaction.update({ content: '❌ Session expired. Please run the command again.', components: [], embeds: [] });

            session.team = parseInt(interaction.values[0]);
            await interaction.deferUpdate();
            await handleDeliveryFollowUp(interaction, sessionId, session.delivery, session.team, client);
            return;
        }

        // ── Channel selection ──
        if (interaction.customId.startsWith('sendteamlinks_channel_')) {
            const sessionId = interaction.customId.replace('sendteamlinks_channel_', '');
            const session = activeSendTeamLinks.get(sessionId);
            if (!session) return interaction.update({ content: '❌ Session expired.', components: [], embeds: [] });

            const channelId = interaction.values[0];
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel) return interaction.update({ content: '❌ Channel not found.', components: [], embeds: [] });

            await interaction.deferUpdate();
            const embeds = await buildLinkEmbeds(session, client);
            for (const embed of embeds) await channel.send({ embeds: [embed] }).catch(console.error);

            activeSendTeamLinks.delete(sessionId);
            await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('✅ Sent!').setDescription(`Links sent to <#${channelId}>.`).setColor('Green')], components: [] });
            return;
        }

        // ── User selection ──
        if (interaction.customId.startsWith('sendteamlinks_user_')) {
            const sessionId = interaction.customId.replace('sendteamlinks_user_', '');
            const session = activeSendTeamLinks.get(sessionId);
            if (!session) return interaction.update({ content: '❌ Session expired.', components: [], embeds: [] });

            const targetUserId = interaction.values[0];
            const targetUser = await client.users.fetch(targetUserId).catch(() => null);
            if (!targetUser) return interaction.update({ content: '❌ User not found.', components: [], embeds: [] });

            await interaction.deferUpdate();
            const embeds = await buildLinkEmbeds(session, client);
            try {
                for (const embed of embeds) await targetUser.send({ embeds: [embed] });
                activeSendTeamLinks.delete(sessionId);
                await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('✅ Sent!').setDescription(`Links sent to **${targetUser.tag}**'s DMs.`).setColor('Green')], components: [] });
            } catch {
                await interaction.editReply({ content: '❌ Could not DM that user — they may have DMs disabled.', embeds: [], components: [] });
            }
            return;
        }
    },

    activeSendTeamLinks
};

async function handleDeliveryFollowUp(interaction, sessionId, delivery, team, client) {
    const session = activeSendTeamLinks.get(sessionId);

    if (delivery === 'my_dms') {
        const embeds = await buildLinkEmbeds(session, client);
        try {
            for (const embed of embeds) await interaction.user.send({ embeds: [embed] });
            activeSendTeamLinks.delete(sessionId);
            await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('✅ Sent!').setDescription('Links sent to your DMs.').setColor('Green')], components: [] });
        } catch {
            await interaction.editReply({ content: '❌ Could not DM you — please enable DMs from server members.', embeds: [], components: [] });
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

async function buildLinkEmbeds(session, client) {
    const { loadAlliances, findAlliance } = require('../utils/allianceStorage');
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

    const embeds = [];
    const title = session.scope === 'team'
        ? `🔗 Team ${session.team} — Alliance Links`
        : `🔗 ${targets[0].groupName} — Links`;

    // Build one embed (chunk if too many fields)
    let currentEmbed = new EmbedBuilder()
        .setTitle(title)
        .setColor(0x9B59B6)
        .setTimestamp();

    let fieldCount = 0;
    for (const a of targets) {
        const discordVal = a.discordLink && a.discordLink !== 'N/A' ? `[Join Discord](${a.discordLink})` : 'N/A';
        const robloxVal = a.robloxLink && a.robloxLink !== 'N/A' ? `[View Group](${a.robloxLink})` : 'N/A';

        if (fieldCount >= 24) {
            embeds.push(currentEmbed);
            currentEmbed = new EmbedBuilder().setTitle(`${title} (cont.)`).setColor(0x9B59B6);
            fieldCount = 0;
        }

        currentEmbed.addFields({
            name: `✨ ${a.groupName}`,
            value: `🎮 **Roblox:** ${robloxVal}\n💬 **Discord:** ${discordVal}`,
            inline: false
        });
        fieldCount++;
    }

    embeds.push(currentEmbed);
    return embeds;
}