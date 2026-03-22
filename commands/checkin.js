const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadAlliances } = require('../utils/allianceStorage');

const LOG_CHANNEL_ID = '1485119755206791289';
const ALLIED_REPS_ROLE_ID = '1417866883750957188';

// Store active checkins: channelId -> { groupName, responded }
const activeCheckins = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkin')
        .setDescription('Send the alliance check-in message to all alliance channels'),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const alliances = await loadAlliances();

            if (!alliances.length) return await interaction.editReply('❌ No alliances found.');

            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

            let sent = 0;
            let failed = 0;
            const failedAlliances = [];

            for (const alliance of alliances) {
                if (!alliance.welcomeChannelId) {
                    failed++;
                    failedAlliances.push(`${alliance.groupName} (no channel set)`);
                    continue;
                }

                const channel = await client.channels.fetch(alliance.welcomeChannelId).catch(() => null);
                if (!channel) {
                    failed++;
                    failedAlliances.push(`${alliance.groupName} (channel not found)`);
                    continue;
                }

                try {
                    const checkinMessage = await channel.send({
                        content: `<@&${ALLIED_REPS_ROLE_ID}>`,
                        embeds: [new EmbedBuilder()
                            .setTitle('📋 Alliance Check-In')
                            .setDescription(
                                `Hello, <@&${ALLIED_REPS_ROLE_ID}>\n\n` +
                                `It is time for our alliance check-in. This will take place once every 2 weeks. Your response is **mandatory**, and you will receive a strike if you do not answer our questions within **48 hours** unless you have a valid reason for the delay.\n\n` +
                                `Please respond honestly. This will help us see areas where we can improve.\n\n` +
                                `**1.** Please rate our communication on a scale of 1-10.\n` +
                                `**2.** How would you rate our activity on a scale of 1-10?\n` +
                                `**3.** Do you think Kavià can make any improvements in our alliance program? If yes, please let us know what we can improve.\n` +
                                `**4.** Do you feel that Kavià is maintaining a good reputation?\n` +
                                `**5.** Does your group have 2 reps provided from our staff team at Kavià? If not, please ping PR leadership and we will assist you.`
                            )
                            .setColor(0x9B59B6)
                            .setFooter({ text: 'Respond to these 5 questions in your channel • You have 48 hours to do so.' })
                            .setTimestamp()],
                        allowedMentions: { roles: [ALLIED_REPS_ROLE_ID] }
                    });

                    // Store active checkin
                    activeCheckins.set(alliance.welcomeChannelId, {
                        groupName: alliance.groupName,
                        responded: false,
                        messageId: checkinMessage.id,
                        startedAt: Date.now()
                    });

                    // Set 48 hour timeout for no response
                    setTimeout(async () => {
                        const checkin = activeCheckins.get(alliance.welcomeChannelId);
                        if (!checkin || checkin.responded) return;

                        activeCheckins.delete(alliance.welcomeChannelId);

                        if (logChannel) {
                            const noResponseEmbed = new EmbedBuilder()
                                .setTitle('⚠️ Check-In No Response')
                                .setColor('Red')
                                .addFields(
                                    { name: 'Alliance', value: alliance.groupName, inline: true },
                                    { name: 'Status', value: '❌ No response within 48 hours', inline: true },
                                    { name: 'Channel', value: `<#${alliance.welcomeChannelId}>`, inline: true },
                                    { name: 'Date', value: new Date().toLocaleString(), inline: false }
                                )
                                .setTimestamp();
                            await logChannel.send({ embeds: [noResponseEmbed] });
                        }

                        // Notify the channel
                        await channel.send({
                            embeds: [new EmbedBuilder()
                                .setDescription(`⚠️ <@&${ALLIED_REPS_ROLE_ID}> The 48 hour check-in window has passed with no response. PR Leadership has been notified.`)
                                .setColor('Red')]
                        });

                    }, 48 * 60 * 60 * 1000);

                    sent++;
                } catch (err) {
                    console.error(`Failed to send checkin to ${alliance.groupName}:`, err);
                    failed++;
                    failedAlliances.push(`${alliance.groupName} (send failed)`);
                }
            }

            // Log checkin started
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📋 Alliance Check-In Started')
                    .setColor(0x9B59B6)
                    .addFields(
                        { name: 'Started By', value: interaction.user.tag, inline: true },
                        { name: 'Sent To', value: `${sent} alliance(s)`, inline: true },
                        { name: 'Failed', value: failed > 0 ? `${failed} alliance(s)\n${failedAlliances.join('\n')}` : 'None', inline: false },
                        { name: 'Date', value: new Date().toLocaleString(), inline: false }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }

            await interaction.editReply(`✅ Check-in sent to **${sent}** alliance(s)${failed > 0 ? `\n⚠️ Failed for: ${failedAlliances.join(', ')}` : ''}`);

        } catch (err) {
            console.error('Error executing checkin:', err);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ There was an error executing this command.');
            }
        }
    },

    // Handle replies in alliance channels
    async handleCheckinReply(message, client) {
        if (message.author.bot) return;
        if (!message.guild) return;

        const checkin = activeCheckins.get(message.channel.id);
        if (!checkin || checkin.responded) return;

        checkin.responded = true;
        activeCheckins.delete(message.channel.id);

        await message.react('✅').catch(() => {});

        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('✅ Check-In Response Received')
                .setColor('Green')
                .addFields(
                    { name: 'Alliance', value: checkin.groupName, inline: true },
                    { name: 'Responded By', value: `${message.author.tag}`, inline: true },
                    { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                    { name: 'Response', value: message.content.slice(0, 1024) || 'No text content', inline: false },
                    { name: 'Date', value: new Date().toLocaleString(), inline: false }
                )
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
        }
    }
};

module.exports.activeCheckins = activeCheckins;