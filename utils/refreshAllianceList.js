const { loadAlliances, getListMessage } = require('./allianceStorage');
const { buildPages, buildEmbed } = require('../commands/alliance-list-post');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ITEMS_PER_PAGE = 6;

async function refreshAllianceList(client) {
    try {
        const listMsg = await getListMessage();
        if (!listMsg) return;

        const channel = await client.channels.fetch(listMsg.channelId).catch(() => null);
        if (!channel) return;

        const message = await channel.messages.fetch(listMsg.messageId).catch(() => null);
        if (!message) return;

        const alliances = await loadAlliances();
        const formatted = await buildPages(alliances);
        const totalPages = Math.ceil(formatted.length / ITEMS_PER_PAGE);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev_post').setLabel('⬅️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('next_post').setLabel('➡️').setStyle(ButtonStyle.Secondary)
        );

        await message.edit({
            embeds: [buildEmbed(formatted, 0)],
            components: totalPages > 1 ? [row] : []
        });
    } catch (err) {
        console.error('Failed to refresh alliance list:', err);
    }
}

module.exports = { refreshAllianceList };