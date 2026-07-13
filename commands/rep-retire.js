const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadAlliances, findAlliance, saveAlliance } = require('../utils/allianceStorage');

const ALLIED_REPS_ROLE_ID = '1417866883750957188';
const LOG_CHANNEL_ID = '1462580398935642144';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rep-retire')
        .setDescription('Notify all alliances that a Kavià rep is no longer active and remove them from records')
        .addUserOption(option =>
            option.setName('rep')
                .setDescription('The Kavià staff member who is retiring/resigning')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason (optional — shown to staff log only, not alliances)')
                .setRequired(false)),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const repUser = interaction.options.getUser('rep');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        const alliances = await loadAlliances().catch(() => []);

        const affected = alliances.filter(a => (a.ourRepIds || []).includes(repUser.id));

        if (affected.length === 0) {
            return await interaction.editReply(`❌ <@${repUser.id}> is not listed as a Kavià rep for any alliance.`);
        }

        let notified = 0;
        let failed = 0;

        for (const alliance of affected) {
            try {
                // Remove from ourRepIds
                alliance.ourRepIds = (alliance.ourRepIds || []).filter(id => id !== repUser.id);
                alliance.ourReps = alliance.ourRepIds.map(id => `<@${id}>`).join(' ') || 'N/A';
                alliance.markModified('ourRepIds');
                alliance.markModified('ourReps');

                // Remove our rep role if set
                if (alliance.ourRepRoleId) {
                    const guild = await client.guilds.fetch(interaction.guildId).catch(() => null);
                    if (guild) {
                        const member = await guild.members.fetch(repUser.id).catch(() => null);
                        if (member) await member.roles.remove(alliance.ourRepRoleId).catch(console.error);
                    }
                }

                await saveAlliance(alliance);

                // Notify the alliance channel
                if (alliance.welcomeChannelId) {
                    const channel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
                    if (channel) {
                        await channel.send({
                            content: `<@&${alliance.repRoleId || ALLIED_REPS_ROLE_ID}>`,
                            embeds: [new EmbedBuilder()
                                .setTitle('👋 Representative Update')
                                .setDescription(
                                    `Hey there! 👋\n\n` +
                                    `We wanted to let you know that **${repUser.username}** is no longer a representative from **Kavià Café** for your alliance.\n\n` +
                                    `Please **kick them from your server** if they are still a member, as they are no longer affiliated with Kavià Café in this capacity.\n\n` +
                                    `A new representative will be assigned to your alliance shortly. We appreciate your understanding! 💜`
                                )
                                .setColor('Yellow')
                                .setFooter({ text: 'Kavià Café — Public Relations Department' })
                                .setTimestamp()],
                            allowedMentions: { roles: [alliance.repRoleId || ALLIED_REPS_ROLE_ID] }
                        });
                        notified++;
                    } else {
                        failed++;
                    }
                } else {
                    failed++;
                }
            } catch (err) {
                console.error(`Failed to process retirement for ${alliance.groupName}:`, err);
                failed++;
            }
        }

        // Log to staff channel
        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            await logChannel.send({
                embeds: [new EmbedBuilder()
                    .setTitle('👋 Rep Retirement Processed')
                    .setColor('Orange')
                    .addFields(
                        { name: 'Rep', value: `<@${repUser.id}> (${repUser.tag})`, inline: true },
                        { name: 'Processed By', value: interaction.user.tag, inline: true },
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Alliances Affected', value: affected.map(a => a.groupName).join(', ') || 'None', inline: false },
                        { name: 'Notified', value: `${notified}`, inline: true },
                        { name: 'Failed', value: `${failed}`, inline: true }
                    )
                    .setTimestamp()]
            });
        }

        await interaction.editReply(
            `✅ Done! **${repUser.username}** has been removed from **${affected.length}** alliance(s) and all channels have been notified.\n\n` +
            `📋 **Affected alliances:** ${affected.map(a => a.groupName).join(', ')}\n` +
            `⚠️ Don't forget to manually assign a new Kavià rep to each of these alliances using **/alliance-edit**!`
        );
    }
};