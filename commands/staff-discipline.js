const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { sendStrikeNotice } = require('../events/interactionCreate.js');

const DATA_FILE = path.join(__dirname, '../staffDiscipline.json');
const APPEAL_LINK = 'https://docs.google.com/forms/d/e/1FAIpQLSc3NkUHM6R25jl5MKuBBoBLxEO4E_2_caMXlO9BQsLEs3segg/viewform';
const GUILD_ID = '1454555005725048894'; // Server ID

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
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to take')
                .addChoices(
                    { name: 'Add Strike', value: 'add' },
                    { name: 'Remove Strike', value: 'remove' },
                    { name: 'Terminate', value: 'terminate' }
                )
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for strike/termination')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('strike_number')
                .setDescription('Strike number (for removal)')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        const user = interaction.options.getUser('member');
        const action = interaction.options.getString('action');
        const reason = interaction.options.getString('reason');
        let strikeNumber = interaction.options.getInteger('strike_number');

        const data = loadData();
        if (!data[user.id]) data[user.id] = [];

        // ================= ADD STRIKE =================
        if (action === 'add') {
            const nextStrike = data[user.id].filter(s => s.active).length + 1;
            strikeNumber = nextStrike;

            const strike = {
                strikeNumber,
                reason,
                active: true,
                date: new Date().toLocaleString()
            };

            data[user.id].push(strike);
            saveData(data);

            // DM (protected)
            try {
                await sendStrikeNotice(client, user.id, strikeNumber, reason);
            } catch (err) {
                console.error('sendStrikeNotice failed:', err);
            }

            await interaction.reply({
                content: `✅ Strike ${strikeNumber} added to ${user.tag}`,
                ephemeral: true
            });
        }

        // ================= REMOVE STRIKE =================
        if (action === 'remove') {
            if (!strikeNumber) {
                return interaction.reply({
                    content: '❌ Please provide a strike number to remove.',
                    ephemeral: true
                });
            }

            const strike = data[user.id].find(
                s => s.strikeNumber === strikeNumber && s.active
            );

            if (!strike) {
                return interaction.reply({
                    content: '❌ Strike not found or already removed.',
                    ephemeral: true
                });
            }

            strike.active = false;
            strike.removedBy = interaction.user.id;
            strike.removedDate = new Date().toLocaleString();
            strike.removalReason = reason;

            saveData(data);

            // Fetch guild safely (FIX)
            const guild = await client.guilds.fetch(GUILD_ID);
            const logChannel = guild.channels.cache.find(
                c => c.name === 'staff-discipline'
            );

            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('🗑️ Strike Removed')
                    .setColor('Orange')
                    .addFields(
                        { name: 'Member', value: `<@${user.id}>` },
                        { name: 'Strike Number', value: `${strikeNumber}` },
                        { name: 'Removed By', value: `${interaction.user.tag}` },
                        { name: 'Reason', value: reason },
                        { name: 'Date', value: new Date().toLocaleString() }
                    )
                    .setTimestamp();

                logChannel.send({ embeds: [logEmbed] });
            }

            // DM user (format untouched)
            try {
                await user.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('✅ Strike Removed')
                            .setColor('Green')
                            .setDescription(
                                `Hello <@${user.id}>,\n\nA strike has been **removed** from your record.`
                            )
                            .addFields(
                                { name: 'Strike Number', value: `${strikeNumber}` },
                                { name: 'Removed By', value: `${interaction.user.tag}` },
                                { name: 'Reason', value: reason },
                                { name: 'Date', value: new Date().toLocaleString() }
                            )
                            .setTimestamp()
                    ]
                });
            } catch (err) {
                console.error('Failed to DM user on strike removal:', err);
            }

            await interaction.reply({
                content: `✅ Strike ${strikeNumber} removed from ${user.tag}`,
                ephemeral: true
            });
        }

        // ================= TERMINATE =================
        if (action === 'terminate') {
            const guild = await client.guilds.fetch(GUILD_ID);
            const logChannel = guild.channels.cache.find(
                c => c.name === 'staff-discipline'
            );

            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Staff Termination Notice')
                    .setColor('DarkRed')
                    .setDescription(
                        `**Member Terminated:** <@${user.id}>\n` +
                        `**Reason:** ${reason}\n` +
                        `**Date:** ${new Date().toLocaleString()}`
                    )
                    .addFields({
                        name: 'Appeal',
                        value: `[Submit an appeal here](${APPEAL_LINK})`
                    })
                    .setTimestamp();

                logChannel.send({ embeds: [logEmbed] });
            }

            // DM termination (format untouched)
            try {
                await user.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('⚠️ Termination Notice')
                            .setColor('DarkRed')
                            .setDescription(
                                `Greetings <@${user.id}>,\n\n` +
                                `You have been **terminated** from Kavià Cafe.\n\n` +
                                `**Reason:** ${reason}\n\n` +
                                `If you believe this decision is unfair, you may submit an appeal below.`
                            )
                            .addFields({
                                name: 'Appeal',
                                value: `[Submit an appeal here](${APPEAL_LINK})`
                            })
                            .setTimestamp()
                    ]
                });
            } catch (err) {
                console.error('Failed to DM user on termination:', err);
            }

            await interaction.reply({
                content: `✅ ${user.tag} has been terminated.`,
                ephemeral: true
            });
        }
    }
};
