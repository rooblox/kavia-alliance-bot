const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { findAlliance, saveAlliance, loadAlliances } = require('../utils/allianceStorage');

const NOTES_REMINDER_CHANNEL_ID = '1462580398935642144';

const FOLLOWUP_OPTIONS = [
    { name: 'In 3 days', value: '3' },
    { name: 'In 1 week', value: '7' },
    { name: 'In 2 weeks', value: '14' },
    { name: 'In 1 month', value: '30' },
    { name: 'No follow-up', value: '0' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alliance-notes')
        .setDescription('Manage internal notes for an alliance')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'Add Note', value: 'add' },
                    { name: 'View Notes', value: 'view' },
                    { name: 'Remove Note', value: 'remove' }
                ))
        .addStringOption(option =>
            option.setName('group_name')
                .setDescription('Alliance name')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('note')
                .setDescription('The note to add (required for Add)')
                .setRequired(false)
                .setMaxLength(500))
        .addIntegerOption(option =>
            option.setName('number')
                .setDescription('Note number to remove (required for Remove)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('followup')
                .setDescription('Set a follow-up reminder (optional, for Add)')
                .setRequired(false)
                .addChoices(...FOLLOWUP_OPTIONS)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const alliances = await loadAlliances().catch(() => []);
        const filtered = alliances
            .filter(a => a.groupName.toLowerCase().includes(focusedValue))
            .slice(0, 25)
            .map(a => ({ name: a.groupName, value: a.groupName }));
        await interaction.respond(filtered);
    },

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const action = interaction.options.getString('action');
        const groupName = interaction.options.getString('group_name');
        const noteText = interaction.options.getString('note');
        const noteNumber = interaction.options.getInteger('number');
        const followup = interaction.options.getString('followup') || '0';

        const alliance = await findAlliance(groupName);
        if (!alliance) return await interaction.editReply(`❌ Alliance **${groupName}** not found.`);

        // Ensure notes array exists
        if (!alliance.notes) {
            alliance.notes = [];
            alliance.markModified('notes');
        }

        // ── Add Note ──
        if (action === 'add') {
            if (!noteText) return await interaction.editReply('❌ You must provide a note to add.');

            const newNote = {
                number: alliance.notes.length + 1,
                text: noteText,
                addedBy: interaction.user.tag,
                addedAt: new Date().toLocaleString(),
                followupDays: parseInt(followup)
            };

            alliance.notes.push(newNote);
            alliance.markModified('notes');
            await saveAlliance(alliance);

            // Schedule follow-up reminder if set
            if (parseInt(followup) > 0) {
                const days = parseInt(followup);
                const delay = days * 24 * 60 * 60 * 1000;

                setTimeout(async () => {
                    try {
                        const reminderChannel = await client.channels.fetch(NOTES_REMINDER_CHANNEL_ID).catch(() => null);
                        if (!reminderChannel) return;

                        await reminderChannel.send({
                            embeds: [new EmbedBuilder()
                                .setTitle('📋 Alliance Note Follow-Up Reminder')
                                .setColor('Yellow')
                                .addFields(
                                    { name: 'Alliance', value: groupName, inline: true },
                                    { name: 'Reminder Set By', value: interaction.user.tag, inline: true },
                                    { name: 'Note', value: noteText, inline: false },
                                    { name: 'Originally Added', value: newNote.addedAt, inline: false }
                                )
                                .setFooter({ text: `Follow-up after ${days} day(s)` })
                                .setTimestamp()]
                        });
                    } catch (err) {
                        console.error('Failed to send note follow-up reminder:', err);
                    }
                }, delay);
            }

            const followupText = parseInt(followup) > 0
                ? `\n⏰ Follow-up reminder set for **${FOLLOWUP_OPTIONS.find(o => o.value === followup)?.name}**.`
                : '';

            return await interaction.editReply(`✅ Note #${newNote.number} added to **${groupName}**.${followupText}`);
        }

        // ── View Notes ──
        if (action === 'view') {
            if (!alliance.notes || alliance.notes.length === 0) {
                return await interaction.editReply(`📋 No notes found for **${groupName}**.`);
            }

            const activeNotes = alliance.notes.filter(n => !n.removed);
            if (activeNotes.length === 0) {
                return await interaction.editReply(`📋 No active notes found for **${groupName}**.`);
            }

            const noteLines = activeNotes.map(n =>
                `**#${n.number}** — ${n.text}\n*Added by ${n.addedBy} on ${n.addedAt}*${n.followupDays > 0 ? ` • ⏰ Follow-up in ${n.followupDays}d` : ''}`
            ).join('\n\n');

            return await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle(`📋 Notes — ${groupName}`)
                    .setDescription(noteLines)
                    .setColor(0x9B59B6)
                    .setFooter({ text: `${activeNotes.length} active note(s)` })
                    .setTimestamp()]
            });
        }

        // ── Remove Note ──
        if (action === 'remove') {
            if (!noteNumber) return await interaction.editReply('❌ You must provide a note number to remove.');

            const note = alliance.notes.find(n => n.number === noteNumber && !n.removed);
            if (!note) return await interaction.editReply(`❌ Note #${noteNumber} not found or already removed.`);

            note.removed = true;
            note.removedBy = interaction.user.tag;
            note.removedAt = new Date().toLocaleString();
            alliance.markModified('notes');
            await saveAlliance(alliance);

            return await interaction.editReply(`✅ Note #${noteNumber} removed from **${groupName}**.`);
        }
    }
};