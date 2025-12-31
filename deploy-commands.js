require('dotenv').config();
const fs = require('fs');
const { REST, Routes } = require('discord.js');

// Replace with your bot & guild IDs
const clientId = '1454554780285403403';
const guildId = '1385081586285940796';

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

// Load commands
const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if (!command.data || !command.execute) continue;
    commands.push(command.data.toJSON());
    console.log(`Registered command for deployment: ${command.data.name}`);
}

(async () => {
    try {
        console.log('Deploying commands to guild...');
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );
        console.log('✅ Commands deployed successfully!');
    } catch (err) {
        console.error('❌ Failed to deploy commands:', err);
    }
})();
