const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { sendStrikeNotice } = require('../events/interactionCreate.js');

const DATA_FILE = path.join(__dirname, '../staffDiscipline.json');
const APPEAL_LINK = 'https://docs.google.com/forms/d/e/1FAIpQLSc3NkUHM6R25jl5MKuBBoBLxEO4E_2_caMXlO9BQsLEs3segg/viewform';
const GUILD_ID = '1454555005725048894'; // Replace with your server ID

function loadData() {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff-discipline')
        .setDescription('Add or remove a strike from a staff member')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Select the member to discipline')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to take')
                .addChoices(
                    { name: 'Add Strike', value: 'add' },
                    { name: 'Remove Strike', value: 'remove' },
                    { name: 'Terminate', value: 'terminate' }
                )
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for strike/termination')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('strike_number')
                .setDescription('Strike number (for removal)')
                .setRequired(false)),
    async execute(interaction, client) {
        const member = interaction.options.getUser('member');
        const action = interaction.options.getString('action');
        const reason = interaction.options.getString('reason');
        let strikeNumber = interaction.options.getInteger('strike_number');

        const data = loadData();
        if (!data[member.id]) data[member.id] = [];

        // ----------------- ADD STRIKE -----------------
        if (action === 'add') {
            const nextStrike = data[member.id].filter(s => s.active).length + 1;
            strikeNumber = nextStrike;

            const strike = {
                strikeNumber,
                reason,
                active: true,
                date: new Date().toLocaleString()
            };
            data[member.id].push(strike);
            saveData(data);

            await sendStrikeNotice(client, member.id, strikeNumber, reason);
            await interaction.reply({ content: `✅ Strike ${strikeNumber} added to ${member.tag}`, ephemeral: true });
        }

        // ----------------- REMOVE STRIKE -----------------
        if (action === 'remove') {
            if (!strikeNumber) return interaction.reply({ content: '❌ Please provide a strike number to remove.', ephemeral: true });

            const strike = data[member.id].find(s => s.strikeNumber === strikeNumber && s.active);
            if (!strike) return interaction.reply({ content: '❌ Strike not found or already removed.', ephemeral: true });

            strike.active = false;
            strike.removedBy = interaction.user.id;
            strike.removedDate = new Date().toLocaleString();
            strike.removalReason = reason;
            saveData(data);

            const guild = client.guilds.cache.get(GUILD_ID);
            const logChannel = guild.channels.cache.find(c => c.name === 'staff-discipline');
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('🗑️ Strike Removed')
                    .addFields(
                        { name: 'Member', value: `<@${member.id}>`, inline: false },
                        { name: 'Strike Number', value: `${strikeNumber}`, inline: false },
                        { name: 'Removed By', value: `${interaction.user.tag}`, inline: false },
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Date', value: new Date().toLocaleString(), inline: false }
                    )
                    .setColor('Orange')
                    .setTimestamp();
                logChannel.send({ embeds: [logEmbed] });
            }

            // ----------------- DM the user -----------------
            try {
                await member.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('✅ Strike Removed')
                            .setColor('Green')
                            .setDescription(`Hello <@${member.id}>,\n\nA strike has been **removed** from your record.`)
                            .addFields(
                                { name: 'Strike Number', value: `${strikeNumber}`, inline: false },
                                { name: 'Removed By', value: `${interaction.user.tag}`, inline: false },
                                { name: 'Reason', value: reason, inline: false },
                                { name: 'Date', value: new Date().toLocaleString(), inline: false }
                            )
                            .setTimestamp()
                    ]
                });
            } catch (err) {
                console.error('Failed to DM user on strike removal:', err);
            }

            await interaction.reply({ content: `✅ Strike ${strikeNumber} removed from ${member.tag}`, ephemeral: true });
        }

        // ----------------- TERMINATE -----------------
        if (action === 'terminate') {
            const guild = client.guilds.cache.get(GUILD_ID);
            const logChannel = guild.channels.cache.find(c => c.name === 'staff-discipline');

            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Staff Termination Notice')
                    .setColor('DarkRed')
                    .setDescription(`**Member Terminated:** <@${member.id}>\n**Reason:** ${reason}\n**Date:** ${new Date().toLocaleString()}`)
                    .addFields({ name: 'Appeal', value: `[Submit an appeal here](${APPEAL_LINK})`, inline: false })
                    .setTimestamp();
                logChannel.send({ embeds: [logEmbed] });
            }

            try {
                await member.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('⚠️ Termination Notice')
                            .setColor('DarkRed')
                            .setDescription(`Greetings <@${member.id}>,\n\nYou have been **terminated** from Kavià Cafe.\n\n**Reason:** ${reason}\n\nIf you believe this decision is unfair, you may submit an appeal using the link below:`)
                            .addFields({ name: 'Appeal', value: `[Submit an appeal here](${APPEAL_LINK})`, inline: false })
                            .setTimestamp()
                    ]
                });
            } catch (err) {
                console.error('Failed to DM user on termination:', err);
            }

            await interaction.reply({ content: `✅ ${member.tag} has been terminated.`, ephemeral: true });
        }
    }
};
