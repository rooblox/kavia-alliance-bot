const { EmbedBuilder } = require('discord.js');

const WELCOME_CHANNEL_ID = '1385081586873008231';

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        const channel = await client.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle('☕ Welcome to Kavià | Alliance Hub!')
            .setDescription(
                `Hey there, <@${member.id}>! We're so glad to have you here. 💜\n\n` +
                `**Kavià Alliance Hub** is the home of our allied representatives and partnerships.\n\n` +
                `**Here's what to do next:**\n` +
                `• ✅ Head over to <#verification> and verify yourself\n` +
                `• 👥 Make sure you're an **Allied Representative** — if you're unsure, reach out to a member of PR Leadership\n` +
                `• ⚠️ Please note that members who are not Allied Representatives may be removed\n\n` +
                `If you have any questions, don't hesitate to reach out. We're happy to help!\n\n` +
                `**— Kavià Café | PR Leadership** ☕`
            )
            .setColor(0x9B59B6)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Kavià Café — Public Relations Department' })
            .setTimestamp();

        await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
    }
};