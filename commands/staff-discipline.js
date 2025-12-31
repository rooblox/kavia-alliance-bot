const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { sendStrikeNotice } = require('../events/interactionCreate.js');

const DATA_FILE = path.join(__dirname, '../staffDiscipline.json');
const APPEAL_LINK = 'https://docs.google.com/forms/d/e/1FAIpQLSc3NkUHM6R25jl5MKuBBoBLxEO4E_2_caMXlO9BQsLEs3segg/viewform';
const LOG_CHANNEL_ID = '1451561306082775081';

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
        await interaction.deferReply({ ephemeral: true });

        const member = interaction.options.getUser('member');
        const action = interaction.options.getString('action');
        const reason = interaction.options.getString('reason');
        let strikeNumber = interaction.options.getInteger('strike_number');

        const data = loadData();
        if (!data[member.id]) data[member.id] = [];

        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

        // ===== ADD STRIKE =====
        if (action === 'add') {
            strikeNumber = data[member.id].filter(s => s.active).length + 1;

            const strike = {
                strikeNumber,
                reason,
                active: true,
                date: new Date().toLocaleString()
            };

            data[member.id].push(strike);
            saveData(data); // ✅ Save to JSON immediately

            // 🔔 LOG
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📌 Staff Discipline Log')
                    .addFields(
                        { name: 'Member', value: `<@${member.id}>`, inline: false },
                        { name: 'Action', value: 'Add Strike', inline: false },
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Staff', value: `<@${interaction.user.id}>`, inline: false },
                        { name: 'Date', value: new Date().toLocaleString(), inline: false }
                    )
                    .setColor('Red');

                logChannel.send({ embeds: [logEmbed] });
            }

            // ✅ DM
            try {
                await sendStrikeNotice(client, member.id, strikeNumber, reason);
            } catch (err) {
                console.error('sendStrikeNotice failed:', err);
            }

            return interaction.editReply(`✅ Strike ${strikeNumber} added to ${member.tag}`);
        }

        // ===== REMOVE STRIKE =====
        if (action === 'remove') {
            if (!strikeNumber) {
                return interaction.editReply('❌ Please provide a strike number to remove.');
            }

            const strike = data[member.id].find(s => s.strikeNumber === strikeNumber && s.active);
            if (!strike) {
                return interaction.editReply('❌ Strike not found or already removed.');
            }

            strike.active = false;
            strike.removedBy = interaction.user.id;
            strike.removedDate = new Date().toLocaleString();
            strike.removalReason = reason;
            saveData(data); // ✅ Save to JSON

            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📌 Staff Discipline Log')
                    .addFields(
                        { name: 'Member', value: `<@${member.id}>`, inline: false },
                        { name: 'Action', value: 'Remove Strike', inline: false },
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Staff', value: `<@${interaction.user.id}>`, inline: false },
                        { name: 'Date', value: new Date().toLocaleString(), inline: false }
                    )
                    .setColor('Orange');

                logChannel.send({ embeds: [logEmbed] });
            }

            // ✅ DM
            try {
                await member.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('✅ Strike Removed')
                            .setColor('Green')
                            .setDescription(`Hello <@${member.id}>,\n\nA strike has been **removed** from your record.`)
                            .addFields(
                                { name: 'Strike Number', value: `${strikeNumber}` },
                                { name: 'Removed By', value: interaction.user.tag },
                                { name: 'Reason', value: reason },
                                { name: 'Date', value: new Date().toLocaleString() }
                            )
                    ]
                });
            } catch (err) {
                console.error('Failed to DM user on strike removal:', err);
            }

            return interaction.editReply(`✅ Strike ${strikeNumber} removed from ${member.tag}`);
        }

        // ===== TERMINATE =====
        if (action === 'terminate') {
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📌 Staff Discipline Log')
                    .addFields(
                        { name: 'Member', value: `<@${member.id}>`, inline: false },
                        { name: 'Action', value: 'Termination', inline: false },
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Staff', value: `<@${interaction.user.id}>`, inline: false },
                        { name: 'Date', value: new Date().toLocaleString(), inline: false }
                    )
                    .setColor('DarkRed');

                logChannel.send({ embeds: [logEmbed] });
            }

            // ✅ DM
            try {
                await member.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('⚠️ Termination Notice')
                            .setColor('DarkRed')
                            .setDescription(
                                `Greetings <@${member.id}>,\n\nYou have been **terminated** from Kavià Cafe.\n\n**Reason:** ${reason}`
                            )
                            .addFields({
                                name: 'Appeal',
                                value: `[Submit an appeal here](${APPEAL_LINK})`
                            })
                    ]
                });
            } catch (err) {
                console.error('Failed to DM user on termination:', err);
            }

            return interaction.editReply(`✅ ${member.tag} has been terminated.`);
        }
    }
};
