const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { loadAlliances, saveAlliances } = require('../utils/allianceStorage');

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
                  .setDescription('Strike number to remove (required if removing strike)')
                  .setRequired(false))
        .addChannelOption(option =>
            option.setName('public_channel')
                  .setDescription('Channel to send a public message to')
                  .addChannelTypes(ChannelType.GuildText))
        .addStringOption(option =>
            option.setName('notes')
                  .setDescription('Notes / Evidence')
                  .setRequired(false))
        .addStringOption(option =>
            option.setName('approved_by')
                  .setDescription('Decision approved by')
                  .setRequired(false))
        .addStringOption(option =>
            option.setName('follow_up')
                  .setDescription('Follow-up actions')
                  .setRequired(false)),

    async execute(interaction, client) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const groupName = interaction.options.getString('group_name');
            const action = interaction.options.getString('action');
            const reason = interaction.options.getString('reason');
            const strikeNumber = interaction.options.getInteger('strike_number');
            const publicChannel = interaction.options.getChannel('public_channel');
            const notes = interaction.options.getString('notes') || 'N/A';
            const approvedBy = interaction.options.getString('approved_by') || 'N/A';
            const followUp = interaction.options.getString('follow_up') || 'N/A';

            const alliances = loadAlliances();
            const index = alliances.findIndex(a => a.groupName === groupName);
            if (index === -1) return interaction.editReply(`❌ Alliance "${groupName}" not found.`);

            const alliance = alliances[index];

            // --- Handle Remove Strike ---
            if (action === 'remove-strike') {
                if (!strikeNumber) return interaction.editReply('❌ You must provide a strike number to remove.');

                if (!alliance.strikes || alliance.strikes.length === 0) {
                    return interaction.editReply(`❌ Alliance "${groupName}" has no strikes.`);
                }

                const strike = alliance.strikes.find(s => s.number === strikeNumber && !s.removed);
                if (!strike) return interaction.editReply(`❌ Strike #${strikeNumber} not found or already removed.`);

                strike.removed = true;
                strike.removedBy = interaction.user.tag;
                strike.removalReason = reason;
                strike.removedOn = new Date().toLocaleString();

                saveAlliances(alliances);

                // Log removal
                const guild = client.guilds.cache.first();
                if (guild) {
                    const logChannel = guild.channels.cache.find(ch => ch.name === 'alliance-term-strikes');
                    if (logChannel) {
                        const removeEmbed = new EmbedBuilder()
                            .setTitle(`⚠️ Strike Removed from ${groupName}`)
                            .setColor('Yellow')
                            .addFields(
                                { name: '📅 Date Removed', value: strike.removedOn, inline: false },
                                { name: '🗑️ Removed By', value: strike.removedBy, inline: false },
                                { name: '📝 Removal Reason', value: strike.removalReason, inline: false },
                                { name: 'Strike Number', value: `${strike.number}`, inline: false },
                                { name: 'Original Reason', value: strike.reason, inline: false }
                            )
                            .setTimestamp();
                        await logChannel.send({ embeds: [removeEmbed] });
                    }
                }

                return interaction.editReply(`✅ Strike #${strikeNumber} removed from alliance "${groupName}".`);
            }

            // --- Handle Strike / Termination ---
            if (!alliance.strikes) alliance.strikes = [];

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
                saveAlliances(alliances);
            }

            if (action === 'termination') {
                alliances.splice(index, 1);
                saveAlliances(alliances);
            }

            // --- Build staff log embed ---
            const logEmbed = new EmbedBuilder()
                .setTitle(`☕ | Kavia Café — Alliance / Termination & Strike Log`)
                .setColor(action === 'termination' ? 'Red' : 'Orange')
                .addFields(
                    { name: '📅 Date', value: new Date().toLocaleString(), inline: false },
                    { name: '🏛️ Alliance Name', value: groupName, inline: false },
                    { name: '🔗 Group Link', value: alliance.robloxLink || 'N/A', inline: false },
                    { name: '👤 Logged By', value: interaction.user.tag, inline: false },
                    { name: '⚠️ Action Taken', value: action === 'strike1' ? 'Strike 1' : action === 'strike2' ? 'Strike 2' : 'Termination', inline: false },
                    { name: '📝 Reason', value: reason, inline: false },
                    { name: '💬 Notes / Evidence', value: notes, inline: false },
                    { name: '✅ Decision Approved By', value: approvedBy, inline: false },
                    { name: '📌 Follow-Up Action', value: followUp, inline: false },
                    { name: '📝 Appeal Link', value: APPEAL_LINK, inline: false }
                )
                .setTimestamp();

            const guild = client.guilds.cache.first();
            if (guild) {
                const logChannel = guild.channels.cache.find(ch => ch.name === 'alliance-term-strikes');
                if (logChannel) await logChannel.send({ embeds: [logEmbed] });
            }

            // --- Public message ---
            let publicMessage = '';
            if (action === 'strike1' || action === 'strike2') {
                publicMessage = `⚠️ Alliance **${groupName}** has received **${action === 'strike1' ? 'Strike 1' : 'Strike 2'}** for the following reason:\n${reason}\n\n[Submit an appeal here](${APPEAL_LINK})`;
            } else if (action === 'termination') {
                publicMessage = `📢 | Alliance Termination Notice\n\nHello there,\n\nWe’d like to inform you that Kavia Café will be terminating our alliance partnership with **${groupName}**, effective immediately.\n\n**Reason for Termination:** ${reason}\n\nPlease note that this decision does not reflect any ill intent toward your group. We truly appreciate the time, effort, and partnership we’ve shared and wish your establishment the very best moving forward.\n\n[Submit an appeal here](${APPEAL_LINK})\n\nThank you for your understanding,\nKavia Café Administration ☕`;
            }

            if (publicChannel && publicMessage) await publicChannel.send({ content: publicMessage });

            await interaction.editReply(`✅ Action "${action}" successfully applied to alliance "${groupName}".`);

        } catch (err) {
            console.error('Error executing alliance-discipline:', err);
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply('❌ There was an error executing this command.');
                } else {
                    await interaction.reply({ content: '❌ There was an error executing this command.', ephemeral: true });
                }
            } catch (err2) {
                console.error('Failed to respond to interaction after error:', err2);
            }
        }
    }
};
