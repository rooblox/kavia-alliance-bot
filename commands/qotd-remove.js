const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { QotdSchedule } = require('../db');

const SCHEDULE_CHANNEL_ID = '1457224221024587909';
const LOG_CHANNEL_ID = '1494502239119736922';
const GUILD_ID = '1313780438061420584';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('qotd-remove')
        .setDescription('Remove someone from a QOTD day or reset the whole week')
        .addStringOption(option =>
            option.setName('day')
                .setDescription('Day to remove or reset the whole week')
                .setRequired(true)
                .addChoices(
                    { name: 'Monday', value: 'Monday' },
                    { name: 'Tuesday', value: 'Tuesday' },
                    { name: 'Wednesday', value: 'Wednesday' },
                    { name: 'Thursday', value: 'Thursday' },
                    { name: 'Friday', value: 'Friday' },
                    { name: 'Saturday', value: 'Saturday' },
                    { name: 'Sunday', value: 'Sunday' },
                    { name: 'Reset Entire Week', value: 'all' }
                )),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const { buildEmbed, buildButtons, getWeekStart } = require('./qotd');
            const day = interaction.options.getString('day');
            const weekStart = getWeekStart();

            const schedule = await QotdSchedule.findOne({ weekStart });
            if (!schedule) return await interaction.editReply('❌ No active schedule found.');

            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

            if (day === 'all') {
                const snapshot = { ...schedule.days };
                schedule.days = {};
                schedule.markModified('days');
                await schedule.save();
                await interaction.editReply('✅ Weekly QOTD schedule has been reset!');

                if (logChannel) {
                    const claimedDays = Object.entries(snapshot)
                        .filter(([, v]) => v?.userId)
                        .map(([d, v]) => `**${d}** — <@${v.userId}>`)
                        .join('\n') || 'None';

                    await logChannel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('🔄 QOTD Week Manually Reset')
                            .setColor('Red')
                            .addFields(
                                { name: 'Reset By', value: interaction.user.tag, inline: true },
                                { name: 'Date', value: new Date().toLocaleString(), inline: true },
                                { name: 'Days That Were Claimed', value: claimedDays, inline: false }
                            )
                            .setTimestamp()]
                    });
                }
            } else {
                if (!schedule.days[day]?.userId) {
                    return await interaction.editReply(`❌ No one has claimed **${day}**.`);
                }
                const removedUser = schedule.days[day].userId;
                schedule.days[day] = {};
                schedule.markModified('days');
                await schedule.save();
                await interaction.editReply(`✅ Removed <@${removedUser}> from **${day}**.`);

                if (logChannel) {
                    await logChannel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('🗑️ QOTD Day Removed by Staff')
                            .setColor('Orange')
                            .addFields(
                                { name: 'Removed User', value: `<@${removedUser}>`, inline: true },
                                { name: 'Day', value: day, inline: true },
                                { name: 'Removed By', value: interaction.user.tag, inline: true },
                                { name: 'Date', value: new Date().toLocaleString(), inline: true }
                            )
                            .setTimestamp()]
                    });
                }
            }

            // Update the schedule embed
            const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
            if (guild) {
                const channel = await client.channels.fetch(SCHEDULE_CHANNEL_ID).catch(() => null);
                if (channel && schedule.messageId) {
                    const msg = await channel.messages.fetch(schedule.messageId).catch(() => null);
                    if (msg) {
                        await msg.edit({
                            embeds: [buildEmbed(schedule)],
                            components: buildButtons(schedule)
                        }).catch(console.error);
                    }
                }
            }
        } catch (err) {
            console.error('Error executing qotd-remove:', err);
            await interaction.editReply('❌ There was an error.');
        }
    }
};