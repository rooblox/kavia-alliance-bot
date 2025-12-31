const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../staffDiscipline.json');

function loadData() {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff-strikes')
        .setDescription('View all strikes for a staff member')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Select the staff member')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const member = interaction.options.getUser('member');
        const data = loadData();
        const strikes = data[member.id] || [];

        if (strikes.length === 0) {
            return interaction.editReply(`✅ ${member.tag} has no strike history.`);
        }

        const embed = new EmbedBuilder()
            .setTitle(`📋 Staff Discipline Record: ${member.tag}`)
            .setColor('Blue')
            .setThumbnail(member.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        // ----- ACTIVE STRIKES -----
        const activeStrikes = strikes.filter(s => s.active);
        if (activeStrikes.length > 0) {
            activeStrikes.forEach(s => {
                embed.addFields({
                    name: `🟥 Strike ${s.strikeNumber}`,
                    value:
                        `**Reason:** ${s.reason}\n` +
                        `**Date:** ${s.date}`,
                    inline: false
                });
            });
        } else {
            embed.addFields({ name: '🟥 Active Strikes', value: 'None', inline: false });
        }

        // ----- REMOVED STRIKES -----
        const removedStrikes = strikes.filter(s => !s.active);
        if (removedStrikes.length > 0) {
            removedStrikes.forEach(s => {
                embed.addFields({
                    name: `🟨 Strike ${s.strikeNumber} (Removed)`,
                    value:
                        `**Original Reason:** ${s.reason}\n` +
                        `**Removed By:** <@${s.removedBy}>\n` +
                        `**Removal Reason:** ${s.removalReason}\n` +
                        `**Removed On:** ${s.removedDate}`,
                    inline: false
                });
            });
        }

        return interaction.editReply({ embeds: [embed] });
    }
};
