const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rep-request')
        .setDescription('Request a new alliance rep')
        .addIntegerOption(option =>
            option.setName('number')
                .setDescription('Number of reps requested')
                .setRequired(true)
                .addChoices(
                    { name: '1', value: 1 },
                    { name: '2', value: 2 }
                ))
        .addStringOption(option =>
            option.setName('discordlink')
                .setDescription('Discord link of the alliance')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('robloxlink')
                .setDescription('Roblox link of the alliance')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('alliancelink')
                .setDescription('Alliance link')
                .setRequired(true)),

    async execute(interaction) {
        const number = interaction.options.getInteger('number');
        const discordLink = interaction.options.getString('discordlink');
        const robloxLink = interaction.options.getString('robloxlink');
        const allianceLink = interaction.options.getString('alliancelink');

        const repChannel = interaction.guild.channels.cache.find(ch => ch.name === 'rep-request');
        if (!repChannel) return interaction.reply({ content: '❌ Rep request channel not found.', ephemeral: true });

        const staffRoleId = '1417981534421520515';

        const embed = new EmbedBuilder()
            .setTitle('📥 New Rep Request')
            .addFields(
                { name: 'Requested By', value: `${interaction.user}`, inline: false },
                { name: 'Number of Reps', value: `${number}`, inline: false },
                { name: 'Discord Link', value: discordLink, inline: false },
                { name: 'Roblox Link', value: robloxLink, inline: false },
                { name: 'Alliance Link', value: allianceLink, inline: false },
                { name: 'Date', value: new Date().toLocaleString(), inline: false }
            )
            .setColor('Green')
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('claim_rep')
                .setLabel('Claimed')
                .setStyle(ButtonStyle.Success)
        );

        await repChannel.send({
            content: `<@&${staffRoleId}>`,
            embeds: [embed],
            components: [row],
            allowedMentions: { roles: [staffRoleId] }
        });

        await interaction.reply({ content: '✅ Rep request sent!', ephemeral: true });
    }
};