const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { findAlliance, saveAlliance, loadAlliances } = require('../utils/allianceStorage');

const ALLIED_REPS_ROLE_ID = '1417866883750957188';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rep-swap')
        .setDescription('Quickly swap one rep for another on an alliance')
        .addStringOption(option =>
            option.setName('group_name')
                .setDescription('Alliance name')
                .setRequired(true)
                .setAutocomplete(true))
        .addUserOption(option =>
            option.setName('old_rep')
                .setDescription('The rep to remove')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('new_rep')
                .setDescription('The rep to add in their place')
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
        const oldRep = interaction.options.getMember('old_rep');
        const newRep = interaction.options.getMember('new_rep');

        const alliance = await findAlliance(groupName);
        if (!alliance) return await interaction.editReply(`❌ Alliance **${groupName}** not found.`);

        const theirRepIds = alliance.theirRepIds || [];
        if (!theirRepIds.includes(oldRep.id)) {
            return await interaction.editReply(`❌ <@${oldRep.id}> is not currently a rep for **${groupName}**.`);
        }

        // Remove old rep's roles
        if (alliance.repRoleId) await oldRep.roles.remove(alliance.repRoleId).catch(console.error);
        await oldRep.roles.remove(ALLIED_REPS_ROLE_ID).catch(console.error);

        // Add new rep's roles
        if (alliance.repRoleId) await newRep.roles.add(alliance.repRoleId).catch(console.error);
        await newRep.roles.add(ALLIED_REPS_ROLE_ID).catch(console.error);

        // Update alliance record
        const newRepIds = theirRepIds.map(id => id === oldRep.id ? newRep.id : id);
        alliance.theirRepIds = newRepIds;
        alliance.theirReps = newRepIds.map(id => `<@${id}>`).join(' ');
        alliance.markModified('theirRepIds');
        alliance.markModified('theirReps');
        await saveAlliance(alliance);

        // Post in alliance channel
        if (alliance.welcomeChannelId) {
            const channel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
            if (channel) {
                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🔄 Representative Swap')
                        .setDescription(
                            `<@${oldRep.id}> has been replaced by <@${newRep.id}> as a representative for **${groupName}**.\n\n` +
                            `Welcome to the team, <@${newRep.id}>! 🎉`
                        )
                        .setColor(0x9B59B6)
                        .setFooter({ text: 'Kavià Café — Alliance Hub' })
                        .setTimestamp()]
                });
            }
        }

        await interaction.editReply(`✅ Swapped <@${oldRep.id}> → <@${newRep.id}> for **${groupName}**. Roles updated and alliance record saved.`);
    }
};