const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { findAlliance, saveAlliance, loadAlliances } = require('../utils/allianceStorage');

const ALLIED_REPS_ROLE_ID = '1417866883750957188';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Issue a lightweight warning to an alliance (does not count toward strikes)')
        .addStringOption(option =>
            option.setName('group_name')
                .setDescription('Alliance name')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the warning')
                .setRequired(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const alliances = await loadAlliances().catch(() => []);
        const filtered = alliances
            .filter(a => a.groupName.toLowerCase().includes(focusedValue))
            .slice(0, 25)
            .map(a => ({ name: a.groupName, value: a.groupName }));
        await interaction.respond(filtered);
    },

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const groupName = interaction.options.getString('group_name');
        const reason = interaction.options.getString('reason');

        const alliance = await findAlliance(groupName);
        if (!alliance) return await interaction.editReply(`❌ Alliance **${groupName}** not found.`);

        if (!alliance.warnings) {
            alliance.warnings = [];
            alliance.markModified('warnings');
        }

        const newWarning = {
            number: alliance.warnings.length + 1,
            reason,
            addedBy: interaction.user.tag,
            addedOn: new Date().toLocaleString()
        };

        alliance.warnings.push(newWarning);
        alliance.markModified('warnings');
        await saveAlliance(alliance);

        if (alliance.welcomeChannelId) {
            const channel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
            if (channel) {
                await channel.send({
                    content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                    embeds: [new EmbedBuilder()
                        .setTitle(`⚡ Warning — ${groupName}`)
                        .setDescription(
                            `Your alliance has received a **warning** from PR Leadership.\n\n` +
                            `**Reason:** ${reason}\n\n` +
                            `This is a lightweight notice and does **not** count toward a strike. However, repeated warnings may lead to formal discipline. Please take this into consideration going forward.`
                        )
                        .setColor('Yellow')
                        .setFooter({ text: 'Kavià Café — Public Relations Department' })
                        .setTimestamp()],
                    allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                });
            }
        }

        await interaction.editReply(`✅ Warning #${newWarning.number} issued to **${groupName}**.`);
    }
};