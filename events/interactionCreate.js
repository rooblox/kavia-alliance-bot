const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction, client) {

        /* ===============================
           🔘 BUTTON INTERACTIONS
        ================================ */
        if (interaction.isButton()) {
            if (interaction.customId !== 'claim_rep') return;

            try {
                // Acknowledge immediately (prevents "Interaction Failed")
                await interaction.deferUpdate();

                const message = interaction.message;
                const embed = EmbedBuilder.from(message.embeds[0]);

                // Prevent double-claiming
                if (embed.data.fields.some(f => f.name === 'Claimed By')) {
                    return;
                }

                // Add "Claimed By" field
                embed.addFields({
                    name: 'Claimed By',
                    value: `<@${interaction.user.id}>`,
                    inline: false
                });

                // Disable the button
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('claim_rep')
                        .setLabel('Claimed')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true)
                );

                // Update the message
                await message.edit({
                    embeds: [embed],
                    components: [disabledRow]
                });

            } catch (err) {
                console.error('Error handling claim button:', err);
            }

            return;
        }

        /* ===============================
           💬 SLASH COMMANDS
        ================================ */
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error(error);
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({
                    content: '❌ There was an error executing this command.',
                    ephemeral: true
                });
            }
        }
    }
};
