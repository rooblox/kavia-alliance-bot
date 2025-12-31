const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { loadAlliances, saveAlliances } = require('../utils/allianceStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-add')
        .setDescription('Add a new alliance')
        .addStringOption(option =>
            option.setName('group_name')
                .setDescription('Name of the alliance group')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('our_reps')
                .setDescription('Your reps, mention them separated by space')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('their_reps')
                .setDescription('Their reps, mention them separated by space')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('discord_link')
                .setDescription('Discord link of the alliance'))
        .addStringOption(option =>
            option.setName('roblox_link')
                .setDescription('Roblox link of the alliance'))
        .addRoleOption(option =>
            option.setName('rep_role')
                .setDescription('Role to ping for reps'))
        .addChannelOption(option =>
            option.setName('welcome_channel')
                .setDescription('Channel to send the formatted welcome message')
                .addChannelTypes(ChannelType.GuildText)),

    async execute(interaction) {

        // ✅ MUST be first awaited call
        await interaction.deferReply({ flags: 64 }); // ephemeral

        try {
            const groupName = interaction.options.getString('group_name');
            const ourReps = interaction.options.getString('our_reps');
            const theirReps = interaction.options.getString('their_reps');
            const discordLink = interaction.options.getString('discord_link') || 'N/A';
            const robloxLink = interaction.options.getString('roblox_link') || 'N/A';
            const repRole = interaction.options.getRole('rep_role');
            const welcomeChannel = interaction.options.getChannel('welcome_channel');

            // ✅ Use interaction.guild (NOT cache.first)
            const guild = interaction.guild;
            if (!guild) {
                return await interaction.editReply('❌ Guild not found.');
            }

            // --- LOG EMBED ---
            const logEmbed = new EmbedBuilder()
                .setTitle(`New Alliance Added: ${groupName}`)
                .setColor('Blue')
                .addFields(
                    { name: 'Our Reps', value: ourReps },
                    { name: 'Their Reps', value: theirReps },
                    { name: 'Discord Link', value: discordLink },
                    { name: 'Roblox Link', value: robloxLink },
                    { name: 'Rep Role', value: repRole ? `<@&${repRole.id}>` : 'None' }
                )
                .setTimestamp();

            const logChannel = guild.channels.cache.find(ch => ch.name === 'alliance-add');
            if (!logChannel) {
                return await interaction.editReply('❌ Log channel "alliance-add" not found.');
            }

            await logChannel.send({ embeds: [logEmbed] });

            // --- WELCOME MESSAGE ---
            if (welcomeChannel) {
                const repsArray = ourReps.split(' ');

                const welcomeMessage = `:tada: **Welcome New Alliance! | Kavi Café x ${groupName}** :tada:

We’re thrilled to officially welcome your community into an alliance with Kavi Café! :star2:

:speech_balloon: **Questions & Support**
If you have any questions, concerns, or suggestions, this is the perfect place to share them.

:busts_in_silhouette: **Your Representative Pair**
Please meet your Kavi Café representatives:

**• ${repsArray[0] || ''}**
**• ${repsArray[1] || ''}**

:handshake: **Looking Ahead**
We’re so excited to be working together and building a strong relationship.

:coffee::sparkles: Here’s to a successful partnership between **Kavi Café** and **${groupName}**! :sparkles::coffee:`;

                await welcomeChannel.send({ content: welcomeMessage });
            }

            // --- SAVE TO alliances.json ---
            const alliances = loadAlliances();
            alliances.push({
                groupName,
                ourReps,
                theirReps,
                discordLink,
                robloxLink,
                repRoleId: repRole?.id || null,
                welcomeChannelId: welcomeChannel?.id || null,
                addedAt: Date.now()
            });
            saveAlliances(alliances);

            // ✅ FINAL RESPONSE
            await interaction.editReply(`✅ Alliance **${groupName}** successfully added!`);

        } catch (err) {
            console.error('Error executing alliance-add:', err);

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ There was an error executing this command.');
            }
        }
    }
};
