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
        .addUserOption(opt =>
            opt.setName('member')
               .setDescription('Select the staff member')
               .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const member = interaction.options.getUser('member');
        const data = loadData();
        const strikes = data[member.id] || [];

        if (!strikes.length) return interaction.editReply(`✅ ${member.tag} has no strike history.`);

        const embed = new EmbedBuilder()
            .setTitle(`📋 Staff Discipline Record | ${member.tag}`)
            .setColor('Blue')
            .setThumbnail(member.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        strikes.forEach(s => {
            const status = s.active ? '🟥 Active Strike' : '🟨 Removed Strike';
            let text =
                `**Strike ${s.strikeNumber}**\n` +
                `🗒️ Reason: ${s.reason}\n` +
                `📅 Date: ${s.date}`;
            if (!s.active) {
                text += `\n🗑️ Removed By: <@${s.removedBy}>\n📝 Removal Reason: ${s.removalReason}\n📅 Removed On: ${s.removedDate}`;
            }
            embed.addFields({ name: status, value: text, inline: false });
        });

        await interaction.editReply({ embeds: [embed] });
    }
};
