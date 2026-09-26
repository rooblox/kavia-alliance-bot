const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

const ITEMS_PER_PAGE = 6;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-list')
        .setDescription('View all current alliances (paginated & grouped)'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const alliances = await loadAlliances();
            if (!alliances.length) return await interaction.editReply('No alliances found.');

            const formatted = [];
            for (let t = 1; t <= 5; t++) {
                const list = alliances.filter(a => a.team === t);
                if (list.length) {
                    formatted.push({ type: 'header', team: t });
                    list.forEach(a => formatted.push({ type: 'alliance', data: a }));
                }
            }
            const noTeam = alliances.filter(a => !a.team);
            if (noTeam.length) {
                formatted.push({ type: 'header', team: 0 });
                noTeam.forEach(a => formatted.push({ type: 'alliance', data: a }));
            }

            let page = 0;
            const totalPages = Math.ceil(formatted.length / ITEMS_PER_PAGE);

            const buildEmbed = (p) => {
                const embed = new EmbedBuilder()
                    .setTitle('📜 Current Alliances')
                    .setColor('Blue')
                    .setFooter({ text: `Page ${p + 1} / ${totalPages}` })
                    .setTimestamp();

                const pageItems = formatted.slice(p * ITEMS_PER_PAGE, (p + 1) * ITEMS_PER_PAGE);
                pageItems.forEach(item => {
                    if (item.type === 'header') {
                        const label = item.team === 0 ? 'No Team Assigned' : `Team ${item.team}`;
                        embed.addFields({ name: `👥 **${label}**`, value: '──────────────', inline: false });
                    } else {
                        const a = item.data;
                        embed.addFields({
                            name: `✨ **${a.groupName}**`,
                            value:
                                `**Our Reps:** ${a.ourReps}\n` +
                                `**Their Reps:** ${a.theirReps}\n` +
                                `**Discord:** ${a.discordLink}\n` +
                                `**Roblox:** ${a.robloxLink}\n` +
                                `**Rep Role:** ${a.repRoleId ? `<@&${a.repRoleId}>` : 'None'}`,
                            inline: false
                        });
                    }
                });
                return embed;
            };

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev').setLabel('⬅️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('next').setLabel('➡️').setStyle(ButtonStyle.Secondary)
            );

            const message = await interaction.editReply({
                embeds: [buildEmbed(page)],
                components: totalPages > 1 ? [row] : []
            });

            if (totalPages <= 1) return;

            const collector = message.createMessageComponentCollector({ time: 300000 });
            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'This menu is not for you.', ephemeral: true });
                }
                if (i.customId === 'next') page = Math.min(page + 1, totalPages - 1);
                if (i.customId === 'prev') page = Math.max(page - 1, 0);
                await i.update({ embeds: [buildEmbed(page)], components: [row] });
            });
        } catch (err) {
            console.error('Error executing alliance-list:', err);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ There was an error executing this command.');
            }
        }
    }
};