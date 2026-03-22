const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { findAlliance, saveAlliance, deleteAlliance } = require('../utils/allianceStorage');
const { refreshAllianceList } = require('../utils/refreshAllianceList');

const APPEAL_LINK = 'https://forms.gle/h3jUfsMkkzNSdcww8';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-discipline')
        .setDescription('Discipline an alliance')
        .addStringOption(option =>
            option.setName('group_name')
                .setDescription('Name of the alliance group')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Choose the action')
                .setRequired(true)
                .addChoices(
                    { name: 'Strike 1', value: 'strike1' },
                    { name: 'Strike 2', value: 'strike2' },
                    { name: 'Termination', value: 'termination' },
                    { name: 'Remove Strike', value: 'remove-strike' }
                ))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the action')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('strike_number')
                .setDescription('Strike number to remove (required if removing strike)'))
        .addStringOption(option =>
            option.setName('notes')
                .setDescription('Notes / Evidence'))
        .addStringOption(option =>
            option.setName('approved_by')
                .setDescription('Decision approved by'))
        .addStringOption(option =>
            option.setName('follow_up')
                .setDescription('Follow-up actions')),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const groupName = interaction.options.getString('group_name');
            const action = interaction.options.getString('action');
            const reason = interaction.options.getString('reason');
            const strikeNumber = interaction.options.getInteger('strike_number');
            const notes = interaction.options.getString('notes') || 'N/A';
            const approvedBy = interaction.options.getString('approved_by') || 'N/A';
            const followUp = interaction.options.getString('follow_up') || 'N/A';

            const alliance = await findAlliance(groupName);
            if (!alliance) return await interaction.editReply(`❌ Alliance "${groupName}" not found.`);

            const logChannel = interaction.guild.channels.cache.find(ch => ch.name === 'alliance-term-strikes');

            // Get the alliance's welcome channel
            const publicChannel = alliance.welcomeChannelId
                ? await client.channels.fetch(alliance.welcomeChannelId).catch(() => null)
                : null;

            const noChannelWarning = !publicChannel
                ? `\n\n⚠️ **Note:** No channel is set for this alliance. The action has been logged but you will need to send the public message manually.`
                : '';

            // ── Remove Strike ──
            if (action === 'remove-strike') {
                if (!strikeNumber) return await interaction.editReply('❌ You must provide a strike number to remove.');

                const strike = alliance.strikes.find(s => s.number === strikeNumber && !s.removed);
                if (!strike) return await interaction.editReply(`❌ Strike #${strikeNumber} not found or already removed.`);

                strike.removed = true;
                strike.removedBy = interaction.user.tag;
                strike.removalReason = reason;
                strike.removedOn = new Date().toLocaleString();

                await saveAlliance(alliance);

                if (logChannel) {
                    const removeEmbed = new EmbedBuilder()
                        .setTitle(`⚠️ Strike Removed from ${groupName}`)
                        .setColor('Yellow')
                        .addFields(
                            { name: '📅 Date Removed', value: strike.removedOn },
                            { name: '🗑️ Removed By', value: strike.removedBy },
                            { name: '📝 Removal Reason', value: strike.removalReason },
                            { name: 'Strike Number', value: `${strike.number}` },
                            { name: 'Original Reason', value: strike.reason }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [removeEmbed] });
                }

                return await interaction.editReply(`✅ Strike #${strikeNumber} removed from alliance "${groupName}".${noChannelWarning}`);
            }

            // ── Strike ──
            if (action === 'strike1' || action === 'strike2') {
                const newStrikeNumber = alliance.strikes.length + 1;
                alliance.strikes.push({
                    number: newStrikeNumber,
                    reason,
                    notes,
                    addedBy: interaction.user.tag,
                    addedOn: new Date().toLocaleString(),
                    removed: false
                });
                await saveAlliance(alliance);

                if (publicChannel) {
                    await publicChannel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle(`⚠️ Alliance Strike — ${groupName}`)
                            .setDescription(
                                `<@&${alliance.repRoleId || ''}>\n\n` +
                                `Your alliance has received **${action === 'strike1' ? 'Strike 1' : 'Strike 2'}**.\n\n` +
                                `**Reason:** ${reason}\n\n` +
                                `If you believe this is an error or would like to appeal, please use the link below.\n` +
                                `[Submit an Appeal](${APPEAL_LINK})`
                            )
                            .setColor('Orange')
                            .setFooter({ text: 'Kavià Café — Public Relations Department' })
                            .setTimestamp()]
                    });
                }
            }

            // ── Termination ──
            if (action === 'termination') {
                if (publicChannel) {
                    await publicChannel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle(`📢 Alliance Termination — ${groupName}`)
                            .setDescription(
                                `<@&${alliance.repRoleId || ''}>\n\n` +
                                `We regret to inform you that Kavià Café will be **terminating** our alliance partnership with **${groupName}**, effective immediately.\n\n` +
                                `**Reason:** ${reason}\n\n` +
                                `This decision does not reflect any ill intent toward your group. We truly appreciate the time, effort, and partnership we've shared and wish your establishment the very best moving forward.\n\n` +
                                `If you would like to appeal this decision, please use the link below.\n` +
                                `[Submit an Appeal](${APPEAL_LINK})\n\n` +
                                `Thank you for your understanding,\n**Kavià Café Administration** ☕`
                            )
                            .setColor('Red')
                            .setFooter({ text: 'Kavià Café — Public Relations Department' })
                            .setTimestamp()]
                    });
                }

                await deleteAlliance(groupName);
                await refreshAllianceList(client);
            }

            // ── Log embed ──
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('☕ | Kavia Café — Alliance / Termination & Strike Log')
                    .setColor(action === 'termination' ? 'Red' : 'Orange')
                    .addFields(
                        { name: '📅 Date', value: new Date().toLocaleString() },
                        { name: '🏛️ Alliance Name', value: groupName },
                        { name: '🔗 Group Link', value: alliance.robloxLink || 'N/A' },
                        { name: '👤 Logged By', value: interaction.user.tag },
                        { name: '⚠️ Action Taken', value: action === 'strike1' ? 'Strike 1' : action === 'strike2' ? 'Strike 2' : 'Termination' },
                        { name: '📝 Reason', value: reason },
                        { name: '💬 Notes / Evidence', value: notes },
                        { name: '✅ Decision Approved By', value: approvedBy },
                        { name: '📌 Follow-Up Action', value: followUp },
                        { name: '📝 Appeal Link', value: APPEAL_LINK }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }

            await interaction.editReply(`✅ Action "${action}" successfully applied to alliance "${groupName}".${noChannelWarning}`);

        } catch (err) {
            console.error('Error executing alliance-discipline:', err);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ There was an error executing this command.');
            }
        }
    }
};