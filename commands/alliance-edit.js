const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { loadAlliances, saveAlliances } = require('../utils/allianceStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-edit')
        .setDescription('Edit an existing alliance')
        .addStringOption(option =>
            option.setName('group_name')
                  .setDescription('The alliance group name to edit')
                  .setRequired(true))
        .addStringOption(option =>
            option.setName('our_reps')
                  .setDescription('Updated our reps, mention them separated by space'))
        .addStringOption(option =>
            option.setName('their_reps')
                  .setDescription('Updated their reps, mention them separated by space'))
        .addStringOption(option =>
            option.setName('discord_link')
                  .setDescription('Updated Discord link'))
        .addStringOption(option =>
            option.setName('roblox_link')
                  .setDescription('Updated Roblox link'))
        .addRoleOption(option =>
            option.setName('rep_role')
                  .setDescription('Updated role to ping for reps'))
        .addChannelOption(option =>
            option.setName('welcome_channel')
                  .setDescription('Updated channel for welcome message')
                  .addChannelTypes(ChannelType.GuildText)),

    async execute(interaction, client) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const groupName = interaction.options.getString('group_name');
            const ourReps = interaction.options.getString('our_reps');
            const theirReps = interaction.options.getString('their_reps');
            const discordLink = interaction.options.getString('discord_link');
            const robloxLink = interaction.options.getString('roblox_link');
            const repRole = interaction.options.getRole('rep_role');
            const welcomeChannel = interaction.options.getChannel('welcome_channel');

            const alliances = loadAlliances();
            const allianceIndex = alliances.findIndex(a => a.groupName.toLowerCase() === groupName.toLowerCase());
            if (allianceIndex === -1) return await interaction.editReply(`Alliance **${groupName}** not found.`);

            // Update only the fields that are provided
            if (ourReps) alliances[allianceIndex].ourReps = ourReps;
            if (theirReps) alliances[allianceIndex].theirReps = theirReps;
            if (discordLink) alliances[allianceIndex].discordLink = discordLink;
            if (robloxLink) alliances[allianceIndex].robloxLink = robloxLink;
            if (repRole) alliances[allianceIndex].repRoleId = repRole.id;
            if (welcomeChannel) alliances[allianceIndex].welcomeChannelId = welcomeChannel.id;

            saveAlliances(alliances);

            // Send updated welcome message if channel is provided
            if (welcomeChannel) {
                const repsArray = (ourReps || alliances[allianceIndex].ourReps).split(' ');
                const welcomeMessage = `:tada: **Welcome Updated Alliance! | Kavi Café x ${groupName}** :tada:

We’re excited to continue our alliance with Kavi Café! :star2:

:speech_balloon: **Questions & Support**
If you have any questions, concerns, or suggestions, this is the perfect place to share them.

:busts_in_silhouette: **Your Representative Pair**
Please meet your Kavi Café representatives:

**• ${repsArray[0] || ''}**
**• ${repsArray[1] || ''}**

:handshake: **Looking Ahead**
We’re so excited to continue building a strong relationship.

:coffee::sparkles: Cheers to our ongoing partnership between **Kavi Café** and **${groupName}**! :sparkles::coffee:`;

                try {
                    await welcomeChannel.send({ content: welcomeMessage });
                } catch (err) {
                    console.error('Failed to send updated welcome message:', err);
                }
            }

            await interaction.editReply(`Alliance **${groupName}** successfully updated!`);

        } catch (err) {
            console.error('Error executing alliance-edit:', err);
            try {
                if (interaction.deferred) {
                    await interaction.editReply({ content: 'There was an error executing this command.' });
                } else {
                    await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
                }
            } catch (err2) {
                console.error('Failed to respond to interaction after error:', err2);
            }
        }
    }
};
