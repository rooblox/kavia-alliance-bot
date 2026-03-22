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

        const buildRow = (claimedCount, total) => {
            if (total === 1) {
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('claim_rep')
                        .setLabel('Claimed')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(claimedCount >= 1)
                );
            }

            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('claim_rep_1')
                    .setLabel(claimedCount >= 1 ? '✅ Rep 1 Claimed' : 'Claim Rep 1')
                    .setStyle(claimedCount >= 1 ? ButtonStyle.Secondary : ButtonStyle.Success)
                    .setDisabled(claimedCount >= 1),
                new ButtonBuilder()
                    .setCustomId('claim_rep_2')
                    .setLabel(claimedCount >= 2 ? '✅ Rep 2 Claimed' : 'Claim Rep 2')
                    .setStyle(claimedCount >= 2 ? ButtonStyle.Secondary : ButtonStyle.Success)
                    .setDisabled(claimedCount >= 2)
            );
        };

        const msg = await repChannel.send({
            content: `<@&${staffRoleId}>`,
            embeds: [embed],
            components: [buildRow(0, number)],
            allowedMentions: { roles: [staffRoleId] }
        });

        await interaction.reply({ content: '✅ Rep request sent!', ephemeral: true });

        // Track claims
        let claimedCount = 0;
        const collector = msg.createMessageComponentCollector();

        collector.on('collect', async i => {
            if (i.customId === 'claim_rep') {
                // Single rep
                const updatedEmbed = EmbedBuilder.from(i.message.embeds[0])
                    .setColor('Grey')
                    .setTitle('📥 Rep Request — Claimed');

                await i.update({
                    embeds: [updatedEmbed],
                    components: [buildRow(1, 1)]
                });
                collector.stop();

            } else if (i.customId === 'claim_rep_1' || i.customId === 'claim_rep_2') {
                claimedCount++;

                const updatedEmbed = EmbedBuilder.from(i.message.embeds[0])
                    .setColor(claimedCount >= 2 ? 'Grey' : 'Yellow')
                    .setTitle(claimedCount >= 2
                        ? '📥 Rep Request — Both Reps Claimed'
                        : '📥 Rep Request — 1 Rep Claimed, 1 Still Needed');

                await i.update({
                    embeds: [updatedEmbed],
                    components: [buildRow(claimedCount, 2)]
                });

                if (claimedCount >= 2) collector.stop();
            }
        });
    }
};