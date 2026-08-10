const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

const TEAM_ROLE_MAP = {
    1: '1536084366080610414',
    2: '1536084453234053221',
    3: '1536084519650598944',
    4: '1536084475669254305',
    5: '1536084576043147385'
};

const TEAM_CATEGORY_MAP = {
    1: '1451290397086060705',
    2: '1451292986557337761',
    3: '1451294316000579848',
    4: '1536082175475195976',
    5: '1536082236653178910'
};

const GLOBAL_LOG_CHANNEL_ID = '1462580398935642144';
const ALLIANCE_GUILD_ID = '1385081586285940796';
const VIEWER_ROLE_ID = '1449021407282593937';

/**
 * Get or create the team log channel for a given team number.
 */
async function getOrCreateTeamLogChannel(client, team) {
    const guild = await client.guilds.fetch(ALLIANCE_GUILD_ID).catch(() => null);
    if (!guild) return null;

    const categoryId = TEAM_CATEGORY_MAP[team];
    const teamRoleId = TEAM_ROLE_MAP[team];
    const channelName = `team-${team}-log`;

    // Check if it already exists in the category
    const existing = guild.channels.cache.find(
        ch => ch.name === channelName && ch.parentId === categoryId
    );
    if (existing) return existing;

    // Create it
    try {
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: teamRoleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.ReadMessageHistory
                    ],
                    deny: [PermissionFlagsBits.SendMessages]
                },
                {
                    id: VIEWER_ROLE_ID,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.ReadMessageHistory
                    ],
                    deny: [PermissionFlagsBits.SendMessages]
                },
                {
                    id: client.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                }
            ],
            reason: `Team ${team} log channel — auto-created by bot`
        });
        return channel;
    } catch (err) {
        console.error(`Failed to create team-${team}-log channel:`, err);
        return null;
    }
}

/**
 * Get team member display names from the team role.
 */
async function getTeamMembers(client, team) {
    try {
        const guild = await client.guilds.fetch(ALLIANCE_GUILD_ID).catch(() => null);
        if (!guild) return 'Unknown';
        await guild.members.fetch();
        const roleId = TEAM_ROLE_MAP[team];
        const members = guild.members.cache.filter(m => m.roles.cache.has(roleId));
        return members.size > 0
            ? members.map(m => m.displayName).sort().join(', ')
            : 'Nobody';
    } catch {
        return 'Unknown';
    }
}

/**
 * Post a team log embed to both the team log channel and the global log.
 * @param {Client} client
 * @param {number} team - Team number (1-5)
 * @param {string} allianceName
 * @param {EmbedBuilder} embed - The embed to post (will have team fields added)
 */
async function postTeamLog(client, team, allianceName, embed) {
    if (!team) return;

    const teamMembers = await getTeamMembers(client, team);

    // Clone and add team fields
    const teamEmbed = EmbedBuilder.from(embed)
        .addFields(
            { name: '👥 Team', value: `Team ${team}`, inline: true },
            { name: '🧑‍🤝‍🧑 Team Members', value: teamMembers, inline: true },
            { name: '🏛️ Alliance', value: allianceName, inline: true }
        );

    // Post to team log channel
    const teamLogChannel = await getOrCreateTeamLogChannel(client, team);
    if (teamLogChannel) {
        await teamLogChannel.send({ embeds: [teamEmbed] }).catch(console.error);
    }

    // Post to global log (same embed, no ping)
    const globalLog = await client.channels.fetch(GLOBAL_LOG_CHANNEL_ID).catch(() => null);
    if (globalLog) {
        await globalLog.send({ embeds: [teamEmbed] }).catch(console.error);
    }
}

module.exports = { postTeamLog, getOrCreateTeamLogChannel, getTeamMembers, TEAM_ROLE_MAP, TEAM_CATEGORY_MAP };