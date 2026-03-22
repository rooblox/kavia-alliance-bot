const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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

        starttraining.activeSessions.delete(user.id);
        starttraining.helpMessages?.delete(user.id);

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

        await interaction.editReply(`✅ Training session for **${user.tag}** has been ended.`);
    }
};