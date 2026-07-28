const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

const VIEWER_ROLE_ID = '1449021407282593937';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fix-channel-perms')
        .setDescription('Add the viewer role to all existing alliance channels'),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const alliances = await loadAlliances().catch(() => []);
        let fixed = 0;
        let skipped = 0;
        let failed = 0;

        for (const alliance of alliances) {
            if (!alliance.welcomeChannelId) { skipped++; continue; }

            const channel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
            if (!channel) { skipped++; continue; }

            try {
                await channel.permissionOverwrites.edit(VIEWER_ROLE_ID, {
                    ViewChannel: true,
                    ReadMessageHistory: true,
                    SendMessages: true,
                    AttachFiles: true,
                    EmbedLinks: true
                });
                fixed++;
            } catch (err) {
                console.error(`Failed to update perms for ${alliance.groupName}:`, err);
                failed++;
            }
        }

        await interaction.editReply(
            `✅ Done!\n` +
            `• **${fixed}** channel(s) updated\n` +
            `• **${skipped}** skipped (no channel set)\n` +
            `• **${failed}** failed`
        );
    }
};