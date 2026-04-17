const { SlashCommandBuilder } = require('discord.js');
const { QotdSchedule } = require('../db');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SCHEDULE_CHANNEL_ID = '1457224221024587909';
const GUILD_ID = '1313780438061420584';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('qotd-remove')
        .setDescription('Remove someone from a QOTD day or reset the whole week')
        .addStringOption(option =>
            option.setName('day')
                .setDescription('Day to remove or "all" to reset the whole week')
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

            if (day === 'all') {
                schedule.days = {};
                schedule.markModified('days');
                await schedule.save();
                await interaction.editReply('✅ Weekly QOTD schedule has been reset!');
            } else {
                if (!schedule.days[day]?.userId) {
                    return await interaction.editReply(`❌ No one has claimed **${day}**.`);
                }
                const removedUser = schedule.days[day].userId;
                schedule.days[day] = {};
                schedule.markModified('days');
                await schedule.save();
                await interaction.editReply(`✅ Removed <@${removedUser}> from **${day}**.`);
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