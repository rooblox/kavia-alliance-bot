const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { findAlliance } = require('../utils/allianceStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-strikes')
        .setDescription('View all strikes for a specific alliance')
        .addStringOption(option =>
            option.setName('group_name')
                .setDescription('The name of the alliance')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const groupName = interaction.options.getString('group_name');
            const alliance = await findAlliance(groupName);

            if (!alliance) return await interaction.editReply(`❌ Alliance "${groupName}" not found.`);

            const strikes = alliance.strikes || [];
            if (strikes.length === 0) return await interaction.editReply(`✅ Alliance "${groupName}" has no strikes.`);

            const activeStrikes = strikes.filter(s => !s.removed);
            const removedStrikes = strikes.filter(s => s.removed);

            const embed = new EmbedBuilder()
                .setTitle(`⚠️ Strikes for Alliance: ${groupName}`)
                .setColor('Orange')
                .setTimestamp();

            embed.addFields({
                name: '🟢 Active Strikes',
                value: activeStrikes.length > 0
                    ? activeStrikes.map(s =>
                        `**Strike ${s.number}**\n🗒️ Reason: ${s.reason}\n📅 Added On: ${s.addedOn}\n👤 Added By: ${s.addedBy}`
                    ).join('\n\n')
                    : 'None'
            });

            embed.addFields({
                name: '🔴 Removed Strikes',
                value: removedStrikes.length > 0
                    ? removedStrikes.map(s =>
                        `**Strike ${s.number}**\n🗒️ Original Reason: ${s.reason}\n🗑️ Removed By: ${s.removedBy}\n📅 Removed On: ${s.removedOn}\n📝 Removal Reason: ${s.removalReason}`
                    ).join('\n\n')
                    : 'None'
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('Error executing alliance-strikes:', err);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ There was an error executing this command.');
            }
        }
    }
};