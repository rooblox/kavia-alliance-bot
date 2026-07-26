const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const LOG_CHANNEL_ID = '1485119755206791289';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('endtraining')
        .setDescription('Force end an active training session for a user')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The user whose training to end')
                .setRequired(true)),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const user = interaction.options.getUser('member');
        const starttraining = client.commands.get('starttraining');

        if (!starttraining) return await interaction.editReply('❌ Training command not found.');

        const session = starttraining.activeSessions?.get(user.id);
        if (!session) return await interaction.editReply(`❌ **${user.tag}** does not have an active training session.`);

        const phase = session.phase === 'quiz' ? '📝 Quiz' : '📚 Training';
        const progress = session.phase === 'quiz'
            ? `Question ${session.quizIndex + 1} of 8`
            : `Section ${session.section + 1} of 8`;

        starttraining.activeSessions.delete(user.id);
        starttraining.helpMessages?.delete(user.id);

        // DM the trainee
        try {
            await user.send({
                embeds: [new EmbedBuilder()
                    .setTitle('📋 Training Ended')
                    .setDescription('Your training session has been ended by a member of PR Leadership. Please reach out to them if you have any questions.')
                    .setColor('Grey')
                    .setTimestamp()]
            });
        } catch (err) {
            console.error('Failed to DM user on training end:', err);
        }

        // Log to channel
        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('🛑 Training Session Ended')
                .setColor('Red')
                .addFields(
                    { name: 'Trainee', value: `<@${user.id}>`, inline: true },
                    { name: 'Ended By', value: interaction.user.tag, inline: true },
                    { name: 'Phase at End', value: phase, inline: true },
                    { name: 'Progress at End', value: progress, inline: true },
                    { name: 'Help Requests', value: `${session.helpCount}`, inline: true },
                    { name: 'Started By', value: session.startedBy, inline: true },
                    { name: 'Date', value: new Date().toLocaleString(), inline: false }
                )
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
        }

        await interaction.editReply(`✅ Training session for **${user.tag}** has been ended.`);
    }
};