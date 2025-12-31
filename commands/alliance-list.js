const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-list')
        .setDescription('View all current alliances'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const alliances = loadAlliances();

            if (!alliances.length) {
                return await interaction.editReply('No alliances found.');
            }

            const embed = new EmbedBuilder()
                .setTitle('📜 Current Alliances')
                .setColor('Blue')
                .setTimestamp();

            alliances.forEach(a => {
                embed.addFields({
                    name: a.groupName,
                    value: `**Our Reps:** ${a.ourReps}\n**Their Reps:** ${a.theirReps}\n**Discord:** ${a.discordLink}\n**Roblox:** ${a.robloxLink}\n**Rep Role:** ${a.repRoleId ? `<@&${a.repRoleId}>` : 'None'}`,
                });
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error(err);
            await interaction.editReply('Failed to fetch alliance list.');
        }
    }
};
