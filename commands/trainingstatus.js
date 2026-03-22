const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trainingstatus')
        .setDescription('Check the training status of a user')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The user to check')
                .setRequired(true)),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const user = interaction.options.getUser('member');
        const starttraining = client.commands.get('starttraining');

        if (!starttraining) return await interaction.editReply('❌ Training command not found.');

        const session = starttraining.activeSessions?.get(user.id);

        if (!session) {
            return await interaction.editReply(`❌ **${user.tag}** does not have an active training session.`);
        }

        const phase = session.phase === 'quiz' ? '📝 Quiz' : '📚 Training';
        const progress = session.phase === 'quiz'
            ? `Question ${session.quizIndex + 1} of 8`
            : `Section ${session.section + 1} of 8`;

        const embed = new EmbedBuilder()
            .setTitle(`📋 Training Status — ${user.tag}`)
            .setColor('Blue')
            .addFields(
                { name: 'Phase', value: phase, inline: true },
                { name: 'Progress', value: progress, inline: true },
                { name: 'Help Requests', value: `${session.helpCount}`, inline: true },
                { name: 'Waiting for Help', value: session.waitingForHelp ? '🟠 Yes' : '🟢 No', inline: true },
                { name: 'Started By', value: session.startedBy, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};