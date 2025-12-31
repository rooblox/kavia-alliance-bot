const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../staffDiscipline.json');

function loadData() {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

// Split long text into chunks
function chunkText(text, maxLength = 1024) {
    const chunks = [];
    let current = '';

    for (const line of text.split('\n')) {
        if ((current + line + '\n').length > maxLength) {
            chunks.push(current);
            current = '';
        }
        current += line + '\n';
    }

    if (current.trim()) chunks.push(current);

    return chunks;
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
        const member = interaction.options.getUser('member');
        const data = loadData();
        const strikes = data[member.id] || [];

        if (!strikes.length) {
            return interaction.reply({ content: `✅ ${member.tag} has no strike history.`, ephemeral: true });
        }

        const activeStrikes = strikes.filter(s => s.active);
        const removedStrikes = strikes.filter(s => !s.active);

        const embed = new EmbedBuilder()
            .setTitle('📋 Staff Discipline Record')
            .setColor('Blue')
            .setThumbnail(member.displayAvatarURL({ dynamic: true }))
            .addFields({ name: '👤 Staff Member', value: `${member.tag} (<@${member.id}>)`, inline: false })
            .setTimestamp();

        // Active Strikes
        if (activeStrikes.length) {
            const text = activeStrikes.map(s =>
                `**Strike ${s.strikeNumber}**\n🗒️ Reason: ${s.reason}\n📅 Date: ${s.date}`
            ).join('\n\n');

            chunkText(text).forEach((chunk, i) => {
                embed.addFields({ name: i === 0 ? '🟥 Active Strikes' : '🟥 Active Strikes (cont.)', value: chunk, inline: false });
            });
        } else {
            embed.addFields({ name: '🟥 Active Strikes', value: 'None', inline: false });
        }

        // Removed Strikes
        if (removedStrikes.length) {
            const text = removedStrikes.map(s =>
                `**Strike ${s.strikeNumber} (Removed)**\n🗒️ Original Reason: ${s.reason}\n🗑️ Removed By: <@${s.removedBy}>\n📅 Removed On: ${s.removedDate}\n📝 Removal Reason: ${s.removalReason}`
            ).join('\n\n');

            chunkText(text).forEach((chunk, i) => {
                embed.addFields({ name: i === 0 ? '🟨 Removed Strikes' : '🟨 Removed Strikes (cont.)', value: chunk, inline: false });
            });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
