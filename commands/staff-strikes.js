const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../staffDiscipline.json');

// Load JSON data
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

        if (!strikes.length) {
            return interaction.editReply(`✅ **${member.tag}** has no strike history.`);
        }

        const activeStrikes = strikes.filter(s => s.active);
        const removedStrikes = strikes.filter(s => !s.active);

        const embed = new EmbedBuilder()
            .setTitle(`📋 Staff Discipline Record: ${member.tag}`)
            .setColor('Blue')
            .setThumbnail(member.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        // Active Strikes
        if (activeStrikes.length) {
            embed.addFields({ name: '🟥 Active Strikes', value: '\u200B' });
            activeStrikes.forEach(s => {
                embed.addFields({
                    name: `✨ **Strike ${s.strikeNumber}** ✨`,
                    value:
                        `**Reason:** ${s.reason}\n` +
                        `**Date:** ${s.date}\n` +
                        `────────────────────`,
                    inline: false
                });
            });
        } else {
            embed.addFields({ name: '🟥 Active Strikes', value: 'None', inline: false });
        }

        // Removed Strikes
        if (removedStrikes.length) {
            embed.addFields({ name: '🟨 Removed Strikes', value: '\u200B' });
            removedStrikes.forEach(s => {
                embed.addFields({
                    name: `✨ Strike ${s.strikeNumber} (Removed) ✨`,
                    value:
                        `**Original Reason:** ${s.reason}\n` +
                        `**Removed By:** <@${s.removedBy}>\n` +
                        `**Removed On:** ${s.removedDate}\n` +
                        `**Removal Reason:** ${s.removalReason}\n` +
                        `────────────────────`,
                    inline: false
                });
            });
        }

        await interaction.editReply({ embeds: [embed] });
    }
};
