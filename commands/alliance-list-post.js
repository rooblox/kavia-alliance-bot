const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { loadAlliances, setListMessage } = require('../utils/allianceStorage');

const ITEMS_PER_PAGE = 6;

async function buildPages(alliances) {
    const sections = ['Restaurants', 'Cafes', 'Others'];
    const formatted = [];
    sections.forEach(section => {
        const list = alliances.filter(a => a.section === section);
        if (list.length) {
            formatted.push({ type: 'header', section });
            list.forEach(a => formatted.push({ type: 'alliance', data: a }));
        }
    });
    return formatted;
}

function buildEmbed(formatted, p) {
    const totalPages = Math.ceil(formatted.length / ITEMS_PER_PAGE);
    const embed = new EmbedBuilder()
        .setTitle('📜 Current Alliances')
        .setColor('Blue')
        .setFooter({ text: `Page ${p + 1} / ${totalPages}` })
        .setTimestamp();

    const pageItems = formatted.slice(p * ITEMS_PER_PAGE, (p + 1) * ITEMS_PER_PAGE);
    pageItems.forEach(item => {
        if (item.type === 'header') {
            embed.addFields({ name: `🗂️ **${item.section}**`, value: '──────────────', inline: false });
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
}

// Store each user's current page: userId -> page number
const userPages = new Map();
// Store the formatted list in memory so button handler can access it
let cachedFormatted = [];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-list-post')
        .setDescription('Post the alliance list publicly (paginated & grouped)'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const alliances = await loadAlliances();
            if (!alliances.length) return await interaction.editReply('No alliances found.');

            cachedFormatted = await buildPages(alliances);
            const totalPages = Math.ceil(cachedFormatted.length / ITEMS_PER_PAGE);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev_post').setLabel('⬅️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('next_post').setLabel('➡️').setStyle(ButtonStyle.Secondary)
            );

            const post = await interaction.channel.send({
                embeds: [buildEmbed(cachedFormatted, 0)],
                components: totalPages > 1 ? [row] : []
            });

            await setListMessage(post.id, interaction.channel.id);
            await interaction.editReply('✅ Alliance list posted.');

        } catch (err) {
            console.error('Error executing alliance-list-post:', err);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ There was an error executing this command.');
            }
        }
    },

    async handlePageButton(interaction) {
        const userId = interaction.user.id;
        const totalPages = Math.ceil(cachedFormatted.length / ITEMS_PER_PAGE);

        if (!cachedFormatted.length) {
            return interaction.reply({ content: '❌ Alliance list is not loaded. Please run /alliance-list-post again.', ephemeral: true });
        }

        let page = userPages.get(userId) ?? 0;

        if (interaction.customId === 'next_post') page = Math.min(page + 1, totalPages - 1);
        if (interaction.customId === 'prev_post') page = Math.max(page - 1, 0);

        userPages.set(userId, page);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev_post').setLabel('⬅️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('next_post').setLabel('➡️').setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
            embeds: [buildEmbed(cachedFormatted, page)],
            components: [row],
            ephemeral: true
        });
    },

    buildEmbed,
    buildPages,
    getCachedFormatted: () => cachedFormatted
};