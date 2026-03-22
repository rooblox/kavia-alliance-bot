require('dotenv').config();
const fs = require('fs');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const { connectDB } = require('./db');

const ALLOWED_ROLE_ID = '1485100238715883720';
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: ['CHANNEL', 'MESSAGE']
});

client.commands = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if (!command.data || !command.execute) continue;
    client.commands.set(command.data.name, command);
    console.log(`Loaded command: ${command.data.name}`);
}

async function deployToGuild(guildId) {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const commandData = [...client.commands.values()].map(c => c.data.toJSON());
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: commandData });
        console.log(`✅ Commands deployed to guild: ${guildId}`);
    } catch (err) {
        console.error(`❌ Failed to deploy to guild ${guildId}:`, err);
    }
}

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    await connectDB();
    for (const guild of client.guilds.cache.values()) {
        await deployToGuild(guild.id);
    }
});

client.on('guildCreate', async (guild) => {
    console.log(`Joined new guild: ${guild.name}`);
    await deployToGuild(guild.id);
});

// Role restriction + command handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const role = interaction.guild?.roles.cache.get(ALLOWED_ROLE_ID);
    if (role) {
        const member = interaction.member;
        if (!member?.roles.cache.has(ALLOWED_ROLE_ID)) {
            return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
        }
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction, client);
    } catch (err) {
        console.error(`Error executing ${interaction.commandName}:`, err);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply('❌ There was an error executing this command.');
        } else {
            await interaction.reply({ content: '❌ There was an error executing this command.', ephemeral: true });
        }
    }
});

// Handle buttons
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'claim_rep') {
        try {
            const originalEmbed = interaction.message.embeds[0];
            const { EmbedBuilder } = require('discord.js');
            const updatedEmbed = EmbedBuilder.from(originalEmbed)
                .setColor('Grey')
                .setTitle('📥 Rep Request — Claimed')
                .addFields({ name: 'Claimed By', value: `${interaction.user}`, inline: false });
            await interaction.update({ embeds: [updatedEmbed], components: [] });
        } catch (err) {
            console.error('Error handling claim_rep button:', err);
        }
    }

    if (interaction.customId.startsWith('resolve_help_')) {
        const starttraining = client.commands.get('starttraining');
        if (starttraining) await starttraining.handleResolve(interaction, client);
    }
});

// Handle DM messages for training
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.guild) return;
    const starttraining = client.commands.get('starttraining');
    if (starttraining) await starttraining.handleMessage(message, client);
});

client.login(process.env.TOKEN);