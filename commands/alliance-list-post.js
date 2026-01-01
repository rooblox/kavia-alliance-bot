const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

const ITEMS_PER_PAGE = 10;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-list-post')
        .setDescription('Post the alliance list publicly (paginated)'),    

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const alliances = loadAlliances();
        if (!alliances.length) {
            return interaction.editReply('No alliances found.');
        }

        let page = 0;
        const totalPages = Math.ceil(alliances.length / ITEMS_PER_PAGE);

        const buildEmbed = (page) => {
            const embed = new EmbedBuilder()
                .setTitle('📜 Current Alliances')
                .setColor('Blue')
                .setFooter({ text: `Page ${page + 1} / ${totalPages}` })
                .setTimestamp();

            const start = page * ITEMS_PER_PAGE;
            const current = alliances.slice(start, start + ITEMS_PER_PAGE);

            current.forEach(a => {
                embed.addFields({
                    name: `✨ **${a.groupName}**`,
                    value:
                        `**Our Reps:** ${a.ourReps}\n` +
                        `**Their Reps:** ${a.theirReps}\n` +
                        `**Discord:** ${a.discordLink}\n` +
                        `**Roblox:** ${a.robloxLink}`,
                    inline: false
                });
            });

            return embed;
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('prev')
                .setLabel('⬅️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('next')
                .setLabel('➡️')
                .setStyle(ButtonStyle.Secondary)
        );

        // Send the public message
        const postedMessage = await interaction.channel.send({
            embeds: [buildEmbed(page)],
            components: totalPages > 1 ? [row] : []
        });

        await interaction.editReply('✅ Alliance list posted.');

        if (totalPages <= 1) return;

        const collector = postedMessage.createMessageComponentCollector({
            time: 300000 // 5 minutes
        });

        collector.on('collect', async i => {
            if (i.customId === 'next') page++;
            if (i.customId === 'prev') page--;

            page = Math.max(0, Math.min(page, totalPages - 1));

            await i.update({
                embeds: [buildEmbed(page)],
                components: [row]
            });
        });
    }
};
