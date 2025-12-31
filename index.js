require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');

// Path to the staffDiscipline JSON
const STAFF_FILE = path.join(__dirname, 'staffDiscipline.json');

// Ensure the staffDiscipline.json file exists
if (!fs.existsSync(STAFF_FILE)) {
    fs.writeFileSync(STAFF_FILE, JSON.stringify({}, null, 4));
    console.log('✅ Created staffDiscipline.json file.');
}

// Load or initialize the in-memory cache
let staffDisciplineCache = {};
try {
    staffDisciplineCache = JSON.parse(fs.readFileSync(STAFF_FILE, 'utf8'));
    console.log('✅ Loaded staffDiscipline.json into cache.');
} catch (err) {
    console.error('❌ Failed to load staffDiscipline.json:', err);
}

// Create client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ],
    partials: ['CHANNEL'] // Needed for DMs
});

// Make cache available to commands
client.staffDisciplineCache = staffDisciplineCache;

// Command collection
client.commands = new Collection();

// Load all commands
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if (!command.data || !command.execute) continue;
    client.commands.set(command.data.name, command);
    console.log(`Loaded command: ${command.data.name}`);
}

// Load events
const eventFiles = fs.readdirSync('./events').filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// Save cache to file on exit
function saveStaffDiscipline() {
    fs.writeFileSync(STAFF_FILE, JSON.stringify(client.staffDisciplineCache, null, 4));
    console.log('✅ staffDiscipline.json saved.');
}

process.on('exit', saveStaffDiscipline);
process.on('SIGINT', () => { saveStaffDiscipline(); process.exit(); });
process.on('SIGTERM', () => { saveStaffDiscipline(); process.exit(); });

client.login(process.env.TOKEN);
console.log('Bot started successfully!');
