const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

const ITEMS_PER_PAGE = 6;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-list-post')
        .setDescription('Post the alliance list publicly (paginated & grouped)'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const alliances = loadAlliances();
        if (!alliances.length) {
            return interaction.editReply('No alliances found.');
        }

        const sections = ['Restaurants', 'Cafes', 'Others'];

        const formatted = [];
        sections.forEach(section => {
            const list = alliances.filter(a => a.section === section);
            if (list.length) {
                formatted.push({ type: 'header', section });
                list.forEach(a => formatted.push({ type: 'alliance', data: a }));
            }
        });

        let page = 0;
        const totalPages = Math.ceil(formatted.length / ITEMS_PER_PAGE);

        const buildEmbed = (page) => {
            const embed = new EmbedBuilder()
                .setTitle('📜 Current Alliances')
                .setColor('Blue')
                .setFooter({ text: `Page ${page + 1} / ${totalPages}` })
                .setTimestamp();

            const start = page * ITEMS_PER_PAGE;
            const pageItems = formatted.slice(start, start + ITEMS_PER_PAGE);

            pageItems.forEach(item => {
                if (item.type === 'header') {
                    embed.addFields({
                        name: `🗂️ **${item.section}**`,
                        value: '──────────────',
                        inline: false
                    });
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
            new ButtonBuilder()
                .setCustomId('prev')
                .setLabel('⬅️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('next')
                .setLabel('➡️')
                .setStyle(ButtonStyle.Secondary)
        );

        const post = await interaction.channel.send({
            embeds: [buildEmbed(page)],
            components: totalPages > 1 ? [row] : []
        });

        await interaction.editReply('✅ Alliance list posted.');

        if (totalPages <= 1) return;

        const collector = post.createMessageComponentCollector({ time: 300000 });

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
