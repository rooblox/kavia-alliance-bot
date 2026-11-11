const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');

const LOG_CHANNEL_ID           = '1485119755206791289';
const AGE_VERIFY_LOG_CHANNEL_ID = '1500601790855647265';
const TRAINING_ROLE_ID         = '1485100238715883720';
const TRAINING_CATEGORY_ID     = process.env.TRAINING_CATEGORY_ID || '1536082175475195976';
const ALLIANCE_GUILD_ID        = '1385081586285940796';

// ── Bot training category definitions ────────────────────────────────────────
const BOT_CATEGORIES = {
    overview: {
        label: '📋 Bot Overview',
        description: 'What this bot does and how it\'s structured',
        emoji: '📋',
        getSteps: () => [
            {
                title: '📋 Bot Overview — What Is This Bot?',
                content:
                    'The **Kavià Alliance Bot** manages the entire lifecycle of alliances in the hub server.\n\n' +
                    'It handles:\n' +
                    '• 🤝 Alliance creation and channel management\n' +
                    '• ✅ Representative verification flow\n' +
                    '• 📢 Weekly topost tracking\n' +
                    '• ❓ QOTD / Awareness scheduling\n' +
                    '• ⚠️ Discipline (strikes / kicks)\n' +
                    '• 💰 Staff pay calculation\n' +
                    '• 📊 Weekly alliance stats\n\n' +
                    '> All commands are slash commands (`/`) and most are staff-only.',
                footer: 'Bot Overview • Step 1 of 3'
            },
            {
                title: '📋 Bot Overview — Command List',
                content:
                    '`/alliance-list-post` — Posts or refreshes the alliance list embed\n' +
                    '`/topost` — Starts the weekly topost cycle for all alliances\n' +
                    '`/checkin` — Sends check-in reminders to all reps\n' +
                    '`/qotd` — Schedules or manually posts the Question of the Day\n' +
                    '`/awareness` — Schedules or posts an awareness message\n' +
                    '`/alliance-discipline` — Issues strikes or kicks to an alliance\n' +
                    '`/pay-calculate` — Runs the pay calculation flow for a staff member\n' +
                    '`/sendall` / `/sendsome` / `/sendteamlinks` — Send messages to alliance channels\n' +
                    '`/health-check` — Checks bot health and DB connection',
                footer: 'Bot Overview • Step 2 of 3'
            },
            {
                title: '📋 Bot Overview — Key Concepts',
                content:
                    '**Teams 1–5**\nEach alliance belongs to a team (1–5). Team members are the "our reps" for that alliance.\n\n' +
                    '**Their Reps vs Our Reps**\n"Their reps" = the alliance\'s own representatives in the hub. "Our reps" = Kavià team members assigned to that alliance.\n\n' +
                    '**Alliance Channels**\nEach alliance gets its own private channel created automatically during verification.\n\n' +
                    '**MongoDB Persistence**\nAll alliance data, strikes, QOTD schedules, and topost sessions persist in MongoDB across bot restarts.',
                footer: 'Bot Overview • Step 3 of 3'
            }
        ]
    },
    alliances: {
        label: '🤝 Alliance Management',
        description: 'Creating, editing, and managing alliances',
        emoji: '🤝',
        getSteps: () => [
            {
                title: '🤝 Alliance Management — The Alliance Object',
                content:
                    'Every alliance stored in MongoDB has these fields:\n\n' +
                    '`groupName` — The alliance\'s display name\n' +
                    '`welcomeChannelId` — Their private channel in the hub\n' +
                    '`repRoleId` — Discord role for their reps\n' +
                    '`ourRepRoleId` — Discord role for our team\'s reps\n' +
                    '`theirRepIds` / `ourRepIds` — Arrays of Discord user IDs\n' +
                    '`team` — Which Kavià team (1–5) manages them\n' +
                    '`strikes` — Array of strike objects with reason + date\n' +
                    '`discordLink` / `robloxLink` — Community links',
                footer: 'Alliance Management • Step 1 of 4'
            },
            {
                title: '🤝 Alliance Management — Creating an Alliance',
                content:
                    'Alliances are created **automatically** when a rep passes verification.\n\n' +
                    'What happens on creation:\n' +
                    '1. A role is created with the alliance\'s name\n' +
                    '2. A private channel is created in the team\'s category\n' +
                    '3. The rep is given the alliance role + Allied Reps role\n' +
                    '4. A welcome message is posted in the new channel\n' +
                    '5. The alliance record is saved to MongoDB\n' +
                    '6. The alliance list embed is refreshed',
                footer: 'Alliance Management • Step 2 of 4'
            },
            {
                title: '🤝 Alliance Management — Editing an Alliance',
                content:
                    'You can edit an existing alliance using the edit button on the alliance list embed.\n\n' +
                    '**What you can edit:**\n' +
                    '• Alliance display name\n' +
                    '• Discord / Roblox links\n' +
                    '• Our reps (team assignment)\n' +
                    '• Their reps (add/remove representative IDs)\n\n' +
                    '> Changes are saved immediately to MongoDB and reflected in the alliance list.',
                footer: 'Alliance Management • Step 3 of 4'
            },
            {
                title: '🤝 Alliance Management — Terminating an Alliance',
                content:
                    'When an alliance ends:\n\n' +
                    '1. Their rep role is deleted\n' +
                    '2. Our rep role is deleted\n' +
                    '3. The alliance channel is **moved to the Terminated category** (not deleted)\n' +
                    '4. The MongoDB record is removed\n' +
                    '5. The alliance list is refreshed\n\n' +
                    '> The channel is preserved in the terminated category so conversation history is kept for reference.',
                footer: 'Alliance Management • Step 4 of 4'
            }
        ]
    },
    verification: {
        label: '✅ Rep Verification',
        description: 'Verifying incoming alliance representatives',
        emoji: '✅',
        getSteps: () => [
            {
                title: '✅ Rep Verification — The Verification Channel',
                content:
                    'Incoming alliance representatives go through a verification flow in the **#verification** channel.\n\n' +
                    'When someone sends a message there, the bot:\n' +
                    '1. Reacts with ⏳\n' +
                    '2. Checks if they\'re in the main Kavià Discord\n' +
                    '3. Checks if they\'re in the Kavià Roblox group\n' +
                    '4. Posts a **review card** in the verification log channel\n' +
                    '5. Staff can then Accept or Decline from that card',
                footer: 'Rep Verification • Step 1 of 5'
            },
            {
                title: '✅ Rep Verification — The Review Card',
                content:
                    'The review card shows staff everything they need:\n\n' +
                    '• **User** — Who\'s verifying + their Discord tag\n' +
                    '• **Alliance** — Which alliance they claim to represent\n' +
                    '• **Roblox Username** — Verified Roblox identity\n' +
                    '• **Roblox Profile** — Direct link to their profile\n' +
                    '• **In Main Discord** — Automatic check ✅\n' +
                    '• **In Roblox Group** — Automatic check ✅\n' +
                    '• **Invited By** — If they mentioned who invited them',
                footer: 'Rep Verification • Step 2 of 5'
            },
            {
                title: '✅ Rep Verification — Accept Flow',
                content:
                    'When staff clicks **Accept**:\n\n' +
                    '**If alliance already exists:**\n' +
                    '• Rep is added to theirRepIds\n' +
                    '• Given Allied Reps role + alliance role\n' +
                    '• Welcome message in alliance channel\n' +
                    '• DM sent to the rep\n\n' +
                    '**If new alliance:**\n' +
                    '• Modal appears asking for alliance name + team number\n' +
                    '• Full alliance creation flow runs (channel, roles, MongoDB save)\n' +
                    '• Welcome message posted\n' +
                    '• Rep gets DM with channel access info',
                footer: 'Rep Verification • Step 3 of 5'
            },
            {
                title: '✅ Rep Verification — Decline Flow',
                content:
                    'When staff clicks **Decline**:\n\n' +
                    '1. A modal appears asking for the decline reason\n' +
                    '2. The rep receives a DM with the reason\n' +
                    '3. The review card is updated to show Declined + reason\n' +
                    '4. No roles or channels are created\n\n' +
                    '> Common decline reasons: not in Roblox group, wrong alliance, duplicate rep',
                footer: 'Rep Verification • Step 4 of 5'
            },
            {
                title: '✅ Rep Verification — Staff Verification',
                content:
                    'Staff members can also verify themselves through the same channel.\n\n' +
                    'When a staff verification is detected:\n' +
                    '• The review card shows "Staff Member" instead of an alliance\n' +
                    '• Accepting gives them the Staff role in the hub\n' +
                    '• No alliance channel is created\n\n' +
                    '> The bot checks for the Staff role in the main Kavià Discord to confirm staff status.',
                footer: 'Rep Verification • Step 5 of 5'
            }
        ]
    },
    topost: {
        label: '📢 Topost System',
        description: 'Managing the weekly topost cycle',
        emoji: '📢',
        getSteps: () => [
            {
                title: '📢 Topost System — What Is Topost?',
                content:
                    '"Topost" = **To Post** — a weekly cycle where each alliance must post something in their channel.\n\n' +
                    'Staff runs `/topost` to start the cycle. The bot:\n' +
                    '1. Creates a tracking embed listing all alliances as ❌ Not Posted\n' +
                    '2. Sends a prompt message in each alliance\'s channel with a **✅ Posted** button\n' +
                    '3. Monitors responses over the next 48 hours\n' +
                    '4. Auto-marks non-responders as ❌ after 48h',
                footer: 'Topost System • Step 1 of 4'
            },
            {
                title: '📢 Topost System — Rep Actions',
                content:
                    'From the alliance\'s perspective:\n\n' +
                    '• They see a message in their channel from the bot\n' +
                    '• They click **✅ Posted** to confirm they posted this week\n' +
                    '• The tracking embed updates live\n' +
                    '• They can also click **❌ Won\'t Post** if they\'re skipping\n\n' +
                    '> A 24-hour reminder is sent if they haven\'t responded by then.',
                footer: 'Topost System • Step 2 of 4'
            },
            {
                title: '📢 Topost System — The Tracking Embed',
                content:
                    'The tracking embed shows all alliances in columns:\n\n' +
                    '**✅ Posted** — Confirmed they posted\n' +
                    '**❌ Not Posted** — No response yet (or skipped)\n' +
                    '**🔄 Pending** — Awaiting response\n\n' +
                    'The embed updates every time an alliance responds. At 48h, any remaining pending ones auto-move to ❌.\n\n' +
                    '> Sessions are persisted in MongoDB so a bot restart doesn\'t lose the cycle.',
                footer: 'Topost System • Step 3 of 4'
            },
            {
                title: '📢 Topost System — After the Cycle',
                content:
                    'After all responses are in (or 48h pass):\n\n' +
                    '• The tracking embed is finalized\n' +
                    '• Non-posters are logged\n' +
                    '• Session is cleared from MongoDB\n' +
                    '• Staff can review results and decide on follow-up actions\n\n' +
                    '> Repeated missed toposts can lead to strikes via `/alliance-discipline`.',
                footer: 'Topost System • Step 4 of 4'
            }
        ]
    },
    qotd: {
        label: '❓ QOTD & Awareness',
        description: 'Scheduling and managing QOTD and awareness posts',
        emoji: '❓',
        getSteps: () => [
            {
                title: '❓ QOTD & Awareness — QOTD',
                content:
                    '**Question of the Day (QOTD)** is posted on a schedule in the main hub.\n\n' +
                    'Using `/qotd`:\n' +
                    '• Set a recurring schedule (e.g. daily at 9AM EST)\n' +
                    '• Or post immediately\n' +
                    '• The schedule is stored in MongoDB and survives bot restarts\n\n' +
                    '> Staff with the allowed role can run this command.',
                footer: 'QOTD & Awareness • Step 1 of 3'
            },
            {
                title: '❓ QOTD & Awareness — Awareness Posts',
                content:
                    '**Awareness posts** work the same way as QOTD but for awareness/announcement content.\n\n' +
                    'Using `/awareness`:\n' +
                    '• Set a schedule or post immediately\n' +
                    '• Content is set through the command modal\n' +
                    '• Target channel is configurable\n\n' +
                    '> Both QOTD and Awareness use the same scheduling infrastructure but are independent of each other.',
                footer: 'QOTD & Awareness • Step 2 of 3'
            },
            {
                title: '❓ QOTD & Awareness — Managing Schedules',
                content:
                    '**To view/edit a schedule:**\n' +
                    '• Run the command again to see the current schedule\n' +
                    '• You can overwrite or cancel at any time\n\n' +
                    '**Timezone handling:**\n' +
                    '• All schedules run in **EST (America/New_York)**\n' +
                    '• The bot handles DST automatically\n\n' +
                    '**If the schedule seems wrong:**\n' +
                    '• Check the MongoDB record via `/health-check`\n' +
                    '• Re-run the command to reset',
                footer: 'QOTD & Awareness • Step 3 of 3'
            }
        ]
    },
    discipline: {
        label: '⚠️ Discipline System',
        description: 'Strikes, kicks, and disciplinary actions',
        emoji: '⚠️',
        getSteps: () => [
            {
                title: '⚠️ Discipline System — When to Use It',
                content:
                    'The `/alliance-discipline` command is for formal disciplinary action against an alliance.\n\n' +
                    '**Common reasons:**\n' +
                    '• Missed topost multiple weeks in a row\n' +
                    '• Rep misconduct in the hub\n' +
                    '• Failure to respond to check-ins\n' +
                    '• Violation of alliance agreement terms\n\n' +
                    '> Always attempt direct communication before issuing strikes.',
                footer: 'Discipline System • Step 1 of 4'
            },
            {
                title: '⚠️ Discipline System — Strike 1',
                content:
                    '**Strike 1** is a formal warning.\n\n' +
                    'What happens:\n' +
                    '1. Strike is recorded in MongoDB against the alliance\n' +
                    '2. A warning embed is sent in their alliance channel\n' +
                    '3. Their reps are pinged\n' +
                    '4. The discipline log is updated\n\n' +
                    '> Strike 1 is intended as a warning — they still have full access and channel visibility.',
                footer: 'Discipline System • Step 2 of 4'
            },
            {
                title: '⚠️ Discipline System — Strike 2',
                content:
                    '**Strike 2** is a final warning before removal.\n\n' +
                    'What happens:\n' +
                    '1. Strike 2 added to MongoDB\n' +
                    '2. More serious warning sent in channel\n' +
                    '3. Leadership is notified\n' +
                    '4. Alliance has a set window to respond before action is taken\n\n' +
                    '> At this stage staff should be in direct contact with the alliance\'s leadership.',
                footer: 'Discipline System • Step 3 of 4'
            },
            {
                title: '⚠️ Discipline System — Termination',
                content:
                    '**Termination** is the final action — the alliance is removed from the hub.\n\n' +
                    'What happens:\n' +
                    '1. Alliance roles are deleted\n' +
                    '2. Channel is moved to the Terminated category\n' +
                    '3. MongoDB record is removed\n' +
                    '4. Alliance list is refreshed\n' +
                    '5. Final log entry recorded\n\n' +
                    '> The channel is **not deleted** — it\'s archived for record-keeping.\n\n' +
                    '⚠️ **This action is irreversible through the bot. Coordinate with leadership before terminating.**',
                footer: 'Discipline System • Step 4 of 4'
            }
        ]
    },
    pay: {
        label: '💰 Pay System',
        description: 'Using the pay-calculate command and review flow',
        emoji: '💰',
        getSteps: () => [
            {
                title: '💰 Pay System — Overview',
                content:
                    'The `/pay-calculate` command runs the full staff pay review for a pay period.\n\n' +
                    'It generates review cards for each staff member with:\n' +
                    '• Base pay\n' +
                    '• Deductions (missed QOTD, quota, etc.)\n' +
                    '• Final pay amount\n' +
                    '• Roblox username for payout\n\n' +
                    '> Only authorized staff with the allowed role can run this.',
                footer: 'Pay System • Step 1 of 4'
            },
            {
                title: '💰 Pay System — The Review Flow',
                content:
                    'Each staff member gets a review card with buttons:\n\n' +
                    '**✅ Approve** — Accept calculated pay as-is\n' +
                    '**✏️ Override** — Manually set a different amount with reason\n' +
                    '**➕ Add Deduction** — Apply a preset or custom deduction\n' +
                    '**🎮 Request Roblox Username** — DMs the staff member asking for their Roblox name\n\n' +
                    '> Review cards are posted in the pay review channel and require staff action.',
                footer: 'Pay System • Step 2 of 4'
            },
            {
                title: '💰 Pay System — Deduction Templates',
                content:
                    'When you click **➕ Add Deduction**, a select menu appears with presets:\n\n' +
                    '• Missed QOTD (1 week) — −5 R$\n' +
                    '• Missed QOTD (2 weeks) — −10 R$\n' +
                    '• Missed QOTD (3+ weeks) — −15 R$\n' +
                    '• Missed monthly quota — −10 R$\n' +
                    '• Partial quota completion — −5 R$\n' +
                    '• Late checkin submission — −5 R$\n' +
                    '• Late topost confirmation — −5 R$\n' +
                    '• Inactivity / low engagement — −10 R$\n' +
                    '• ✏️ Custom — Enter your own reason + amount',
                footer: 'Pay System • Step 3 of 4'
            },
            {
                title: '💰 Pay System — Finalizing Pay',
                content:
                    'Once all review cards are actioned:\n\n' +
                    '1. Click **Finalize All** to generate the final pay summary\n' +
                    '2. Summary shows each staff member\'s final amount + Roblox username\n' +
                    '3. Use the Roblox group payout tool to send payments\n' +
                    '4. Summary is logged in the pay log channel\n\n' +
                    '> Pay sessions are in-memory only — if the bot restarts mid-review you\'ll need to re-run the command.',
                footer: 'Pay System • Step 4 of 4'
            }
        ]
    },
    sandbox: {
        label: '🧪 Alliance Sandbox',
        description: 'Practice the full alliance setup with a fake alliance',
        emoji: '🧪',
        getSteps: () => [
            {
                title: '🧪 Alliance Sandbox — Overview',
                content:
                    'The sandbox lets you practice the **full alliance creation flow** safely.\n\n' +
                    '**What WILL happen:**\n' +
                    '• A `[SANDBOX]` channel is created\n' +
                    '• A `[SANDBOX]` role is created\n' +
                    '• The real welcome message format is sent\n' +
                    '• You\'ll see exactly what gets saved to MongoDB\n\n' +
                    '**What WON\'T happen:**\n' +
                    '• Nothing is saved to MongoDB\n' +
                    '• Everything is cleaned up when training ends\n\n' +
                    '> The sandbox channel and role are deleted automatically at the end of training.',
                footer: 'Alliance Sandbox • Step 1 of 1'
            }
        ]
    }
};

// Per-category quiz questions — only questions for selected categories are asked
const CATEGORY_QUESTIONS = {
    overview: [
        {
            question: 'Where is alliance data stored so it survives bot restarts?',
            options: ['A) In-memory only', 'B) A local JSON file', 'C) MongoDB', 'D) Google Sheets'],
            answer: 'c'
        },
        {
            question: 'Which command checks the bot\'s health and MongoDB connection?',
            options: ['A) /status', 'B) /ping', 'C) /health-check', 'D) /debug'],
            answer: 'c'
        }
    ],
    alliances: [
        {
            question: 'What is the difference between "their reps" and "our reps"?',
            options: [
                'A) They are the same thing',
                'B) Their reps = alliance\'s own reps in hub; Our reps = Kavià team members assigned to them',
                'C) Our reps = alliance\'s reps; Their reps = Kavià team members',
                'D) Their reps are in the main server; Our reps are in the hub'
            ],
            answer: 'b'
        },
        {
            question: 'When is a terminated alliance\'s channel deleted?',
            options: ['A) Immediately', 'B) After 24 hours', 'C) It is never deleted — it moves to the Terminated category', 'D) After leadership approves'],
            answer: 'c'
        }
    ],
    verification: [
        {
            question: 'An alliance rep sends a message in #verification. What does the bot do first?',
            options: ['A) DMs the rep', 'B) Reacts with ⏳ and runs checks', 'C) Creates their channel immediately', 'D) Pings leadership'],
            answer: 'b'
        },
        {
            question: 'When staff clicks Accept for a NEW alliance (not an existing one), what appears?',
            options: ['A) The channel is created automatically with no input', 'B) A modal asking for the alliance name and team number', 'C) A DM is sent to the rep immediately', 'D) Nothing — it requires a second confirmation'],
            answer: 'b'
        }
    ],
    topost: [
        {
            question: 'What command do you run to start the weekly posting cycle for all alliances?',
            options: ['A) /checkin', 'B) /topost', 'C) /alliance-list-post', 'D) /sendall'],
            answer: 'b'
        },
        {
            question: 'An alliance hasn\'t responded to topost after 48 hours. What happens?',
            options: ['A) They are automatically struck', 'B) They are auto-marked ❌ Not Posted', 'C) The cycle resets', 'D) Nothing — staff must handle it manually'],
            answer: 'b'
        }
    ],
    qotd: [
        {
            question: 'What timezone do QOTD and Awareness schedules run in?',
            options: ['A) UTC', 'B) PST', 'C) EST (America/New_York)', 'D) CST'],
            answer: 'c'
        },
        {
            question: 'If the QOTD schedule seems wrong after a bot restart, what should you do?',
            options: ['A) Wait for it to fix itself', 'B) Check the MongoDB record via /health-check and re-run the command', 'C) Delete and recreate the schedule in the database manually', 'D) Restart the bot again'],
            answer: 'b'
        }
    ],
    discipline: [
        {
            question: 'What should you do BEFORE issuing a strike to an alliance?',
            options: ['A) Nothing — strikes can be issued at any time', 'B) Attempt direct communication first', 'C) Terminate the alliance immediately', 'D) Post in the alliance channel without warning'],
            answer: 'b'
        },
        {
            question: 'After termination, what happens to the alliance channel?',
            options: ['A) It is deleted immediately', 'B) It stays visible to everyone', 'C) It moves to the Terminated category and is preserved', 'D) It is archived after 7 days'],
            answer: 'c'
        }
    ],
    pay: [
        {
            question: 'What happens when you click "Add Deduction" on a pay review card?',
            options: ['A) A modal opens for free-text entry', 'B) The deduction is applied automatically', 'C) A select menu of preset deduction templates appears', 'D) It opens a DM to the staff member'],
            answer: 'c'
        },
        {
            question: 'Pay sessions are stored in which way?',
            options: ['A) MongoDB — persists through restarts', 'B) In-memory only — lost on bot restart', 'C) Local JSON file', 'D) Google Sheets'],
            answer: 'b'
        }
    ],
    sandbox: [
        {
            question: 'What does the alliance sandbox NOT do?',
            options: ['A) Create a [SANDBOX] role', 'B) Create a [SANDBOX] channel', 'C) Save the alliance to MongoDB', 'D) Send a welcome message'],
            answer: 'c'
        }
    ]
};

// ── Existing PR training data ─────────────────────────────────────────────────
const TRAININGS = {
    basic_training: {
        name: 'Basic Training',
        type: 'pr',
        sections: [
            {
                title: '📢 Welcome to Kavià Café Staff Training',
                content: `Hello! First and foremost, congratulations on joining the Public Relations Department at Kavià. You have already completed your mentorship and this is a final training to help you find your way in the alliance hub and public relations server, and inform you of our expectations.\n\nAs a PR Staff member, your role is very important. You'll help us manage, maintain, and grow our alliances with other groups.\n\nDuring this training I will be sending a number of messages. When you have fully read a message and understood it, please click **Done** below. If after your training you do forget something you can request a re-training with one of our leadership staff.`
            },
            {
                title: '🎯 Responsibilities and Expectations',
                content: `**Alliance Communication**\n• Keep up with affiliated groups.\n• Remain professional in official communication. When you reach out to an affiliated group, you represent Kavià in an official capacity.\n• Post alliance announcements in the partnerships channel in our main server using the alliance ping.\n• Make sure announcements are professional and on time. (Normally 48 hours is our max.)\n\n**Monitoring Alliances**\n• Ensure alliances are active and engaging with their communities.\n• Notify PR Leadership immediately if an alliance becomes inactive or problematic.\n• When looking for inactivity in groups, make sure to report immediately if the inactivity is severe.`
            },
            {
                title: '☕ Handling Common Tasks',
                content: `**Posting Announcements**\n• When posting a partner's announcement, copy the announcement exactly as the partner provides. Unless major grammar issues are found, do **not** edit an announcement.\n• If there is an everyone ping in the provided message, change it to the alliance ping.\n• If any information must be filled in by yourself like a ping, make sure to do this before posting.\n\n**Alliance-Related Problems**\n• If an alliance becomes problematic, has issues, or is inactive, please notify a member of the PR leadership.\n• If you are not sure what to say when communicating with an alliance, feel free to ask.\n\n**Basic Communication**\n• Be polite and professional at all times.\n• Use proper grammar, avoid slang, and always stay respectful.\n• Never argue — if there's an issue, bring it to PR Leadership.`
            },
            {
                title: '⚘️ Handling an Alliance Request',
                content: `• When a group comes into Kavià requesting a partnership, please start by asking them for the Discord link to their main server. Verify that they meet our requirements, and that we aren't already allied with them.\n• If they do **not** meet our requirements, please send them the affiliation deny message which can be found in your resources channel.\n• If they **do** meet our requirements, proceed by sending them this form, then ask a member of the PR leadership team to review. This may take up to 48 hours.\n• The form can also be found in the alliance formatting channel in the alliance hub. If you can't find it contact PRD leadership.\n📋 https://docs.google.com/forms/d/e/1FAIpQLSftkJqN7MCrnX3UfQHpCpiRxO4e12JhGe_ZbUXDWRV4hrPuDQ/viewform?usp=publish-editor\n• If the user does not respond, you may remind them after 24 hours. If you have to remind them a second time, mention that their ticket will be closed in 24 hours if they do not respond.\n• If the alliance is accepted, send them the acceptance message from your resources channel, then proceed to set up the alliance as usual.`
            },
            {
                title: '📢 Engagement, Awareness and OTD',
                content: `Anything PRD related but not alliance related is located in the Public Relations server. Here you may claim anything you need for quota.\n\n**QOTD (Question of the Day)**\n• Please post your OTD before 8PM EST. Refrain from topics that were already used that week (e.g. Superheroes, Media, etc.)\n\n**Events**\n• Head over to the event request channel to request your events. If you are hosting one with an alliance, make sure to specify that. If you are hosting an event together with another PRD member make sure to mention that so that we can count it for their quota too.\n\n**Awareness**\n• When posting awareness/events, please make sure to use the proper pings in your message, not after or below.\n• Awareness topics that include serious topics may need to be edited slightly to comply with server rules.\n• The format for posting awareness can be found in the formats channel in the public relations server.\n\nIf you are in need of help with anything, do not hesitate to ask. We would rather have you ask than mess up, and our staff team is always available to help.`
            },
            {
                title: '🗒️ Setting Up an Alliance',
                content: `• Once you confirm the alliance, have 2 representatives join our alliance hub and main server.\n• Contact PRD leadership and they will set up the channel for you. If any changes come to representatives, notify leadership of this as well.\n• Double check that there are 2 representatives from both sides in the required servers.\n• Post their advertisement, and make sure they post ours too.`
            },
            {
                title: '💜 Alliance Visits',
                content: `It may occur that you have to do an alliance visit with one of our affiliated groups at any point in time. Please follow the guide below:\n\n📄 https://docs.google.com/document/d/18BtqwioC8Yd4F59xRTBc5xPDM3QnOmMX48QYrEzE49o/edit?usp=drivesdk`
            },
            {
                title: '💜 Final Notes',
                content: `We are incredibly grateful to have you in the Public Relations Department. For any more recent changes please refer to the announcements channel. If you have any questions or need help doing anything, please do not hesitate to reach out to PRD leadership — no question is dumb and we are happy to help you.\n\nWelcome to the team! 💜\n\nClick **Done** below to confirm you have read everything and proceed to your final quiz!`
            }
        ],
        questions: [
            {
                question: 'When posting a partner\'s announcement, what should you do if there is an **@everyone** ping in it?',
                options: ['A) Leave it as is', 'B) Remove the ping entirely', 'C) Change it to the alliance ping', 'D) Ask leadership before posting'],
                answer: 'c'
            },
            {
                question: 'How long is the maximum time you should take to post an alliance announcement?',
                options: ['A) 24 hours', 'B) 48 hours', 'C) 72 hours', 'D) 1 week'],
                answer: 'b'
            },
            {
                question: 'An alliance becomes inactive. What should you do?',
                options: ['A) Remove the alliance immediately', 'B) Wait and see', 'C) Notify PR Leadership immediately', 'D) Message the alliance yourself and handle it'],
                answer: 'c'
            },
            {
                question: 'A group requests a partnership but does not meet requirements. What do you do?',
                options: ['A) Ignore them', 'B) Send them the affiliation deny message', 'C) Tell them to try again later', 'D) Accept them anyway'],
                answer: 'b'
            },
            {
                question: 'When setting up a new alliance, how many representatives should join the alliance hub and main server?',
                options: ['A) 1', 'B) 3', 'C) 4', 'D) 2'],
                answer: 'd'
            },
            {
                question: 'Where should you post the proper pings when posting awareness or events?',
                options: ['A) After the message', 'B) Below the message', 'C) Inside the message', 'D) In a separate message'],
                answer: 'c'
            },
            {
                question: 'A group requesting a partnership does not respond after you send the form. When can you send your first reminder?',
                options: ['A) After 12 hours', 'B) After 24 hours', 'C) After 48 hours', 'D) After 72 hours'],
                answer: 'b'
            },
            {
                question: 'What do you need to do while setting up an alliance?',
                options: ['A) Contact PRD leadership to set up the channels', 'B) Post their advertisement, and ask them to post ours', 'C) Ensure we have 2 reps from both sides in the required servers', 'D) All of the above'],
                answer: 'd'
            }
        ]
    },
    intro_to_mentorship: {
        name: 'Intro to Mentorship',
        type: 'pr',
        ageVerifySectionIndex: 1,
        sections: [
            {
                title: '📢 Welcome to Intro to Mentorship',
                content: `Hello! Congratulations on joining the mentorship program at Kavià Café. This training will walk you through everything you need to know about handling tickets, your responsibilities as a High Rank, and how to best support the team.\n\nPlease read each section carefully and click **Done** when you are ready to move on.`
            },
            {
                title: '📋 Age Verification',
                content: `Before proceeding to the next stage of your internship, you are required to complete age verification to confirm that you are **13 years of age or older**.\n\n**To verify your age, please follow these steps:**\n1. Open the Roblox App\n2. Go to **Settings**\n3. Select **Account Info**\n4. Navigate to **Personal**\n5. Take a screenshot of the attached page *(see photo below)*\n\nBelow you will find an example of how your screenshot should appear. You are allowed to cross out or blur any other personal information shown in the image for your privacy. However, your **username** and **age** must remain visible so that staff can confirm your eligibility.\n\n**Privacy Notice**\nAt Kavià Café, we respect and value your privacy. Your age verification screenshot will only be reviewed for confirmation purposes and will not be shared outside of the designated verification channel. Staff members will only access this information to confirm that you meet the 13+ age requirement.\n\n*If it is confirmed that you are under the age of 13, you will be removed from the community in accordance with platform policies. Refusal to complete age verification will result in immediate termination of your internship.*\n*Age verification must be completed in order to proceed.*\n\n**Please reply to this message with your screenshot or image link to submit your verification.**`,
                image: 'https://cdn.discordapp.com/attachments/1426346648405151755/1496261473931100272/Screenshot_20260101_161503_Roblox.jpg?ex=69f866d6&is=69f71556&hm=327749ccbc1031c8ff630d4ee4623d39171d51597348dae31219df325f0167ba&'
            },
            {
                title: '🎫 Ticket Categories — Part 1',
                content: `There are several ticket categories you will encounter. Here is an overview of each:\n\n**General Support** — Visible to all High Ranks. Handles general questions and minor issues.\n\n**Moderation Support** — For moderator requests, rule violations, and role issues.\n\n**Public Relations Support** — For alliances, giveaways, and event winner roles.\n\n**Human Resources Support** — For LR-HR reports, promotions, demotions, and applications.`
            },
            {
                title: '🎫 Ticket Categories — Part 2',
                content: `**Development** — For development and beta tester applications.\n\n**SHR** — For resignations, presidential staff reports, and critical issues.\n\n**Important Notes:**\n• Department-specific tickets are only visible to assigned staff.\n• Always introduce yourself before assisting in any ticket.\n• Close tickets after **48 hours** of no response.`
            },
            {
                title: '🔀 Incorrect Tickets & Redirecting',
                content: `Sometimes users will open the wrong ticket type. Here is how to handle each:\n\n• **SHR tickets** → Resignations, Presidential staff reports, Critical issues\n• **PR tickets** → Alliances, giveaways, event winner roles\n• **Mod tickets** → Moderator needed, rule violations, role issues\n• **HR tickets** → LR-HR reports, Promotions, Demotions, Applications\n• **Dev tickets** → Development/Beta tester applications\n• **General tickets** → General questions, minor issues\n\nIf a user opens the wrong ticket, politely redirect them to the correct one.`
            },
            {
                title: '⚠️ Ban Permissions',
                content: `As a High Rank you will receive the **Ban Handler** role and ban permissions in the Roblox group.\n\n**Important:**\n• Do **not** abuse your ban permissions under any circumstances.\n• Misuse of the ban command will result in **immediate termination**.\n• Only use ban permissions when absolutely necessary and within the guidelines set by leadership.\n\nClick **Done** below to confirm you have read everything and proceed to your final quiz!`
            }
        ],
        questions: [
            {
                question: 'A High Rank staff member has joined the Public Relations Department. Which ticket type can they see?',
                options: ['A) Moderation Support', 'B) Development', 'C) Public Relations + General Support', 'D) SHR + Human Resources Support'],
                answer: 'c'
            },
            {
                question: 'A user creates a General Support ticket. What inquiries are you able to help with in this ticket type?',
                options: ['A) Development Inquiries', 'B) General Questions', 'C) Role issues', 'D) Resignations'],
                answer: 'b'
            },
            {
                question: 'A user opens a General Support ticket to report an LR-HR staff. What is the correct course of action?',
                options: ['A) Redirect them to a Human Resources ticket', 'B) Abandon the ticket', 'C) Ban the user', 'D) Try to punish the LR-HR being reported'],
                answer: 'a'
            },
            {
                question: 'What administrative privilege does a High Rank receive?',
                options: ['A) Pban', 'B) Btools', 'C) Server Shutdown', 'D) Ban'],
                answer: 'd'
            },
            {
                question: 'What is the consequence of misusing the ban command?',
                options: ['A) Strike', 'B) Termination', 'C) Demotion', 'D) Pban'],
                answer: 'b'
            },
            {
                question: 'Which ticket type handles resignations and presidential staff reports?',
                options: ['A) General Support', 'B) Human Resources Support', 'C) SHR', 'D) Moderation Support'],
                answer: 'c'
            },
            {
                question: 'How long should you wait before closing a ticket with no response?',
                options: ['A) 24 hours', 'B) 72 hours', 'C) 1 week', 'D) 48 hours'],
                answer: 'd'
            },
            {
                question: 'A user opens a Moderation Support ticket asking about a demotion. What should you do?',
                options: ['A) Handle it in the Moderation ticket', 'B) Redirect them to a Human Resources ticket', 'C) Redirect them to General Support', 'D) Close the ticket immediately'],
                answer: 'b'
            }
        ]
    },
    bot_training: {
        name: 'Alliance Bot Training',
        type: 'bot',
        // bot training is handled separately — categories defined in BOT_CATEGORIES
    }
};

const activeSessions   = new Map();
const helpMessages     = new Map();
const ageVerifyPending = new Map();
const botTrainingSessions = new Map();

// ── Slash command ─────────────────────────────────────────────────────────────
module.exports = {
    data: new SlashCommandBuilder()
        .setName('starttraining')
        .setDescription('Training commands')
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('Start a training session for a user')
                .addStringOption(option =>
                    option.setName('training')
                        .setDescription('Select the training session')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Basic Training', value: 'basic_training' },
                            { name: 'Intro to Mentorship', value: 'intro_to_mentorship' },
                            { name: 'Alliance Bot Training', value: 'bot_training' }
                        ))
                .addUserOption(option =>
                    option.setName('member')
                        .setDescription('The user to train')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('include_quiz')
                        .setDescription('Include a quiz at the end of bot training? (default: yes)')
                        .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('blast')
                .setDescription('DM all staff asking if they want to go through training (one-time only)')),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const sub = interaction.options.getSubcommand();

        // ── BLAST subcommand ──
        if (sub === 'blast') {
            await handleBlast(interaction, client);
            return;
        }

        // ── START subcommand ──
        const trainingKey = interaction.options.getString('training');
        const user        = interaction.options.getUser('member');
        const includeQuiz = interaction.options.getBoolean('include_quiz') ?? true;
        const training    = TRAININGS[trainingKey];

        if (!training) return await interaction.editReply('❌ Training not found.');

        // ── Bot Training — channel-based flow ──
        if (trainingKey === 'bot_training') {
            if (activeSessions.has(user.id) || [...botTrainingSessions.values()].some(s => s.traineeId === user.id)) {
                return await interaction.editReply(`❌ **${user.tag}** already has an active training session.`);
            }
            await startBotTrainingSession(interaction, client, user, includeQuiz);
            return;
        }

        // ── PR Training — DM-based flow ──
        if (activeSessions.has(user.id)) {
            return await interaction.editReply(`❌ **${user.tag}** already has an active training session.`);
        }

        try {
            await user.send({
                embeds: [buildSectionEmbed(training, 0)],
                components: [buildSectionRow(user.id, 0)]
            });

            activeSessions.set(user.id, {
                section: 0,
                phase: 'training',
                quizIndex: 0,
                quizAnswers: [],
                startedBy: interaction.user.tag,
                helpCount: 0,
                waitingForHelp: false,
                waitingForAgeVerify: false,
                trainingKey
            });

            await interaction.editReply(`✅ **${training.name}** training started for **${user.tag}**! Section 1 has been sent to their DMs.`);

            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                await logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('📚 Training Started')
                        .setColor('Blue')
                        .addFields(
                            { name: 'Trainee', value: `<@${user.id}>`, inline: true },
                            { name: 'Training', value: training.name, inline: true },
                            { name: 'Started By', value: interaction.user.tag, inline: true },
                            { name: 'Date', value: new Date().toLocaleString(), inline: false }
                        )
                        .setTimestamp()]
                });
            }
        } catch (err) {
            console.error('Error starting training:', err);
            await interaction.editReply(`❌ Could not DM **${user.tag}**. They may have DMs closed.`);
        }
    },

    // ── Button handler ────────────────────────────────────────────────────────
    async handleButton(interaction, client) {
        const customId = interaction.customId;

        // ── Bot training buttons ──
        if (customId.startsWith('bt_')) {
            await handleBotTrainingButton(interaction, client);
            return;
        }

        // ── Blast DM Yes ──
        if (customId.startsWith('blast_yes_')) {
            const userId = customId.replace('blast_yes_', '');
            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ This DM is not for you.', ephemeral: true });
            }

            const { TrainingInvite } = require('../db');
            await TrainingInvite.findOneAndUpdate({ userId }, { response: 'yes', respondedAt: new Date() });

            await interaction.update({
                embeds: [new EmbedBuilder()
                    .setTitle('✅ Training Started!')
                    .setColor(0x2ECC71)
                    .setDescription('Awesome! Head to the alliance hub server — a private training channel is being created for you now. 💜')
                    .setTimestamp()],
                components: []
            });

            // Find the guild and kick off bot training for them
            const guild = client.guilds.cache.find(g => g.id === ALLIANCE_GUILD_ID) || client.guilds.cache.first();
            if (!guild) return;

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return;

            // Create a fake "interaction-like" object so we can reuse createBotTrainingChannel
            const fakeInteraction = {
                guild,
                user: { id: userId },
                channel: null,
                editReply: async () => {},
                followUp: async () => {}
            };

            const pending = {
                trainerId:   userId,
                traineeId:   userId,
                traineeName: member.displayName || member.user.username,
                includeQuiz: true,
                guild
            };

            await createBotTrainingChannel(fakeInteraction, client, pending, Object.keys(BOT_CATEGORIES));
            return;
        }

        // ── Blast DM No ──
        if (customId.startsWith('blast_no_')) {
            const userId = customId.replace('blast_no_', '');
            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ This DM is not for you.', ephemeral: true });
            }

            const { TrainingInvite } = require('../db');
            await TrainingInvite.findOneAndUpdate({ userId }, { response: 'no', respondedAt: new Date() });

            await interaction.update({
                embeds: [new EmbedBuilder()
                    .setTitle('No Problem!')
                    .setColor(0x95A5A6)
                    .setDescription('No worries — you won\'t be asked again. If you ever want to go through training, just ask a member of leadership to run `/starttraining start` for you. ☕')
                    .setTimestamp()],
                components: []
            });
            return;
        }

        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

        // ── SECTION DONE BUTTON ──
        if (customId.startsWith('section_done_')) {
            const userId = customId.replace('section_done_', '');
            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ This is not your training session.', ephemeral: true });
            }

            const session = activeSessions.get(userId);
            if (!session) return interaction.reply({ content: '❌ No active session found.', ephemeral: true });

            if (session.waitingForHelp) {
                return interaction.reply({ content: '⏳ Please wait for your help request to be resolved before continuing.', ephemeral: true });
            }

            const training = TRAININGS[session.trainingKey];
            await interaction.update({ components: [] });
            session.section++;

            if (training.ageVerifySectionIndex !== undefined && session.section === training.ageVerifySectionIndex) {
                session.waitingForAgeVerify = true;
                const section = training.sections[session.section];

                const embed = new EmbedBuilder()
                    .setTitle(section.title)
                    .setDescription(section.content)
                    .setColor(0x9B59B6)
                    .setImage(section.image)
                    .setFooter({ text: 'Please reply with your screenshot or image link to submit your verification.' })
                    .setTimestamp();

                await interaction.user.send({ embeds: [embed] });

                setTimeout(async () => {
                    const s = activeSessions.get(userId);
                    if (!s || !s.waitingForAgeVerify) return;
                    try {
                        const ageVerifyLogChannel = await client.channels.fetch(AGE_VERIFY_LOG_CHANNEL_ID).catch(() => null);
                        if (ageVerifyLogChannel) {
                            await ageVerifyLogChannel.send({
                                content: `<@&${TRAINING_ROLE_ID}> ⏰ **Reminder:** Age verification submission from <@${userId}> has not been reviewed yet!`,
                                embeds: [new EmbedBuilder()
                                    .setTitle('⏰ Age Verification — Pending Review Reminder')
                                    .setColor('Orange')
                                    .addFields(
                                        { name: 'Trainee', value: `<@${userId}>`, inline: true },
                                        { name: 'Status', value: '⏳ Awaiting Review', inline: true },
                                        { name: 'Submitted', value: 'Over 12 hours ago', inline: true }
                                    )
                                    .setTimestamp()]
                            });
                        }
                    } catch (err) {
                        console.error('Failed to send age verify re-ping:', err);
                    }
                }, 12 * 60 * 60 * 1000);

                return;
            }

            if (session.section >= training.sections.length) {
                session.phase = 'quiz';
                session.quizIndex = 0;
                session.quizAnswers = [];

                const quizIntroEmbed = new EmbedBuilder()
                    .setTitle('📝 Final Quiz')
                    .setDescription(`Great job completing the training! You will now be asked **${training.questions.length} questions**.\n\nSelect your answer using the buttons below each question.`)
                    .setColor(0x9B59B6)
                    .setTimestamp();

                await interaction.user.send({ embeds: [quizIntroEmbed] });
                setTimeout(async () => {
                    await interaction.user.send({
                        embeds: [buildQuestionEmbed(training, 0)],
                        components: [buildQuizRow(userId, 0)]
                    });
                }, 1500);
            } else {
                await interaction.user.send({
                    embeds: [buildSectionEmbed(training, session.section)],
                    components: [buildSectionRow(userId, session.section)]
                });
            }
        }

        // ── SECTION HELP BUTTON ──
        if (customId.startsWith('section_help_')) {
            const userId = customId.replace('section_help_', '');
            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ This is not your training session.', ephemeral: true });
            }

            const session = activeSessions.get(userId);
            if (!session) return interaction.reply({ content: '❌ No active session found.', ephemeral: true });

            if (session.waitingForHelp) {
                return interaction.reply({ content: '⏳ Your help request is already pending.', ephemeral: true });
            }

            const training = TRAININGS[session.trainingKey];
            session.waitingForHelp = true;
            session.helpCount++;

            await interaction.update({ components: [] });

            await interaction.user.send({
                embeds: [new EmbedBuilder()
                    .setTitle('🆘 Help Requested')
                    .setDescription('No worries! A member of PR Leadership has been notified and will reach out to you shortly.\n\nYou will be able to continue your training once your request has been **resolved**.')
                    .setColor('Orange')
                    .setTimestamp()]
            });

            if (logChannel) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`resolve_help_${userId}`)
                        .setLabel('✅ Mark as Resolved')
                        .setStyle(ButtonStyle.Success)
                );

                const helpEmbed = new EmbedBuilder()
                    .setTitle('🆘 Training Help Request')
                    .setColor('Orange')
                    .addFields(
                        { name: 'Trainee', value: `<@${userId}>`, inline: true },
                        { name: 'Training', value: training.name, inline: true },
                        { name: 'Section', value: `${session.section + 1} — ${training.sections[session.section].title}`, inline: false },
                        { name: 'Help Count', value: `${session.helpCount}`, inline: true },
                        { name: 'Date', value: new Date().toLocaleString(), inline: true },
                        { name: 'Status', value: '🟠 Pending', inline: true }
                    )
                    .setTimestamp();

                const logMsg = await logChannel.send({ embeds: [helpEmbed], components: [row] });
                helpMessages.set(userId, logMsg.id);
            }
        }

        // ── AGE VERIFY ACCEPT ──
        if (customId.startsWith('ageverify_accept_')) {
            const userId = customId.replace('ageverify_accept_', '');
            const session = activeSessions.get(userId);

            if (!session) return interaction.reply({ content: '❌ This training session is no longer active.', ephemeral: true });

            session.waitingForAgeVerify = false;
            ageVerifyPending.delete(userId);

            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setTitle('📋 Age Verification — ✅ Accepted')
                .setColor('Green')
                .spliceFields(3, 1, { name: 'Status', value: `✅ Accepted by ${interaction.user.tag}`, inline: true });

            await interaction.update({ embeds: [updatedEmbed], components: [] });

            try {
                const user = await client.users.fetch(userId);
                await user.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('✅ Age Verification Accepted!')
                        .setDescription('Your age verification has been accepted! You may now continue your training. 💜')
                        .setColor('Green')
                        .setTimestamp()]
                });

                const training = TRAININGS[session.trainingKey];
                session.section++;

                if (session.section >= training.sections.length) {
                    session.phase = 'quiz';
                    session.quizIndex = 0;
                    session.quizAnswers = [];
                    await user.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('📝 Final Quiz')
                            .setDescription(`Great job completing the training! You will now be asked **${training.questions.length} questions**.\n\nSelect your answer using the buttons below each question.`)
                            .setColor(0x9B59B6)
                            .setTimestamp()]
                    });
                    setTimeout(async () => {
                        await user.send({
                            embeds: [buildQuestionEmbed(training, 0)],
                            components: [buildQuizRow(userId, 0)]
                        });
                    }, 1500);
                } else {
                    await user.send({
                        embeds: [buildSectionEmbed(training, session.section)],
                        components: [buildSectionRow(userId, session.section)]
                    });
                }
            } catch (err) {
                console.error('Failed to continue training after age verify accept:', err);
            }
        }

        // ── AGE VERIFY DENY ──
        if (customId.startsWith('ageverify_deny_')) {
            const userId = customId.replace('ageverify_deny_', '');

            const modal = new ModalBuilder()
                .setCustomId(`ageverify_deny_modal_${userId}`)
                .setTitle('Deny Age Verification');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('deny_reason')
                        .setLabel('Reason for denial')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('e.g. Age not visible, wrong screenshot, etc.')
                        .setRequired(true)
                        .setMaxLength(500)
                )
            );

            await interaction.showModal(modal);
        }

        // ── QUIZ ANSWER BUTTONS ──
        if (customId.startsWith('quiz_')) {
            const parts = customId.replace('quiz_', '').split('_');
            const answer = parts[0];
            const userId = parts.slice(1).join('_');

            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ This is not your training session.', ephemeral: true });
            }

            const session = activeSessions.get(userId);
            if (!session || session.phase !== 'quiz') return;

            const training = TRAININGS[session.trainingKey];
            await interaction.update({ components: [] });

            const correct = answer === training.questions[session.quizIndex].answer;
            session.quizAnswers.push({
                question: training.questions[session.quizIndex].question,
                given: answer.toUpperCase(),
                correct: training.questions[session.quizIndex].answer.toUpperCase(),
                passed: correct
            });

            session.quizIndex++;

            const resultEmbed = new EmbedBuilder()
                .setDescription(correct ? '✅ Correct!' : `❌ Incorrect. The correct answer was **${training.questions[session.quizIndex - 1].answer.toUpperCase()}**.`)
                .setColor(correct ? 'Green' : 'Red');

            await interaction.user.send({ embeds: [resultEmbed] });

            if (session.quizIndex < training.questions.length) {
                setTimeout(async () => {
                    await interaction.user.send({
                        embeds: [buildQuestionEmbed(training, session.quizIndex)],
                        components: [buildQuizRow(userId, session.quizIndex)]
                    });
                }, 1000);
            } else {
                const score = session.quizAnswers.filter(a => a.passed).length;
                const passMark = training.name === 'Intro to Mentorship' ? 3 : 6;
                const autoPass = score >= passMark;

                await interaction.user.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('📋 Quiz Submitted!')
                        .setDescription('You have completed the quiz! A member of PR Leadership will review your results shortly.')
                        .setColor(0x9B59B6)
                        .addFields({ name: 'Your Score', value: `${score}/${training.questions.length}`, inline: true })
                        .setTimestamp()]
                });

                if (logChannel) {
                    const breakdown = session.quizAnswers.map((a, i) =>
                        `**Q${i + 1}:** ${a.passed ? '✅' : '❌'} — Answered: **${a.given}** | Correct: **${a.correct}**`
                    ).join('\n');

                    const passFailRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`training_pass_${userId}`).setLabel('✅ Pass').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`training_fail_${userId}`).setLabel('❌ Fail').setStyle(ButtonStyle.Danger)
                    );

                    await logChannel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('📋 Training Quiz Results — Awaiting Review')
                            .setColor(autoPass ? 'Green' : 'Orange')
                            .addFields(
                                { name: 'Trainee', value: `<@${userId}>`, inline: true },
                                { name: 'Training', value: training.name, inline: true },
                                { name: 'Score', value: `${score}/${training.questions.length}`, inline: true },
                                { name: 'Pass Mark', value: `${passMark}/${training.questions.length}`, inline: true },
                                { name: 'Auto Result', value: autoPass ? '✅ Likely Pass' : '⚠️ Likely Fail', inline: true },
                                { name: 'Help Requests During Training', value: `${session.helpCount}`, inline: true },
                                { name: 'Date', value: new Date().toLocaleString(), inline: true },
                                { name: 'Question Breakdown', value: breakdown, inline: false }
                            )
                            .setTimestamp()],
                        components: [passFailRow]
                    });
                }
            }
        }

        // ── PASS BUTTON ──
        if (customId.startsWith('training_pass_')) {
            const userId = customId.replace('training_pass_', '');

            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setTitle('📋 Training Quiz Results — ✅ Passed')
                .setColor('Green')
                .spliceFields(2, 1, { name: 'Final Result', value: `✅ Passed by ${interaction.user.tag}`, inline: true });

            await interaction.update({ embeds: [updatedEmbed], components: [] });

            try {
                const user = await client.users.fetch(userId);
                await user.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🎉 Congratulations — You Passed!')
                        .setDescription('We are so thrilled to officially welcome you to the **Kavià Café Public Relations Department**! 🎊\n\nYou have successfully completed your training and demonstrated a great understanding of your responsibilities.\n\n**What\'s next?**\n• You\'ll be given your official PR role shortly.\n• Head over to the PR server and introduce yourself!\n• Don\'t hesitate to reach out to PR Leadership if you ever need guidance.\n\nWe\'re so excited to have you on the team. Welcome aboard! ☕💜')
                        .setColor(0x9B59B6)
                        .setFooter({ text: 'Kavià Café — Public Relations Department' })
                        .setTimestamp()]
                });
            } catch (err) {
                console.error('Failed to DM trainee pass result:', err);
            }

            activeSessions.delete(userId);
            helpMessages.delete(userId);
            ageVerifyPending.delete(userId);
        }

        // ── FAIL BUTTON ──
        if (customId.startsWith('training_fail_')) {
            const userId = customId.replace('training_fail_', '');
            const session = activeSessions.get(userId);

            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setTitle('📋 Training Quiz Results — ❌ Failed')
                .setColor('Red')
                .spliceFields(2, 1, { name: 'Final Result', value: `❌ Failed by ${interaction.user.tag}`, inline: true });

            await interaction.update({ embeds: [updatedEmbed], components: [] });

            try {
                const user = await client.users.fetch(userId);
                const trainingKey = session?.trainingKey || 'basic_training';
                const training = TRAININGS[trainingKey];

                await user.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('📋 Training Result')
                        .setDescription('Thank you for completing the training, and don\'t be discouraged! Unfortunately you did not pass this time, but we believe in you. 💜\n\nA member of PR Leadership will be reaching out to support you before your next attempt.\n\n**Your training will now restart from the beginning.**\n\nTake your time to review each section carefully — you\'ve got this! ☕')
                        .setColor(0xE74C3C)
                        .setFooter({ text: 'Kavià Café — Public Relations Department' })
                        .setTimestamp()]
                });

                setTimeout(async () => {
                    activeSessions.set(userId, {
                        section: 0,
                        phase: 'training',
                        quizIndex: 0,
                        quizAnswers: [],
                        startedBy: session?.startedBy || 'Unknown',
                        helpCount: 0,
                        waitingForHelp: false,
                        waitingForAgeVerify: false,
                        trainingKey
                    });
                    await user.send({
                        embeds: [buildSectionEmbed(training, 0)],
                        components: [buildSectionRow(userId, 0)]
                    });
                }, 2000);
            } catch (err) {
                console.error('Failed to DM trainee fail result:', err);
            }

            helpMessages.delete(userId);
            ageVerifyPending.delete(userId);
        }

        // ── RESOLVE HELP ──
        if (customId.startsWith('resolve_help_')) {
            const userId = customId.replace('resolve_help_', '');
            const session = activeSessions.get(userId);

            if (!session) return interaction.reply({ content: '❌ This training session is no longer active.', ephemeral: true });

            session.waitingForHelp = false;

            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor('Green')
                .spliceFields(5, 1, { name: 'Status', value: `✅ Resolved by ${interaction.user.tag}`, inline: true });

            await interaction.update({ embeds: [updatedEmbed], components: [] });

            try {
                const user = await client.users.fetch(userId);
                await user.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('✅ Help Resolved')
                        .setDescription('Your help request has been resolved! You can now continue your training by clicking **Done** on your current section.')
                        .setColor('Green')
                        .setTimestamp()],
                    components: [buildSectionRow(userId, session.section)]
                });
            } catch (err) {
                console.error('Failed to DM trainee after resolve:', err);
            }
        }
    },

    async handleModal(interaction, client) {
        if (!interaction.customId.startsWith('ageverify_deny_modal_')) return;

        const userId = interaction.customId.replace('ageverify_deny_modal_', '');
        const reason = interaction.fields.getTextInputValue('deny_reason');
        const session = activeSessions.get(userId);

        if (!session) return interaction.reply({ content: '❌ This training session is no longer active.', ephemeral: true });

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setTitle('📋 Age Verification — ❌ Denied')
            .setColor('Red')
            .spliceFields(3, 1, { name: 'Status', value: `❌ Denied by ${interaction.user.tag}\n**Reason:** ${reason}`, inline: true });

        await interaction.update({ embeds: [updatedEmbed], components: [] });

        try {
            const user = await client.users.fetch(userId);
            await user.send({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Age Verification Denied')
                    .setDescription(
                        `Unfortunately your age verification submission was **denied**.\n\n` +
                        `**Reason:** ${reason}\n\n` +
                        `Please resubmit your verification by replying with a new screenshot that meets the requirements. Make sure your **username** and **age** are clearly visible. 💜`
                    )
                    .setColor('Red')
                    .setTimestamp()]
            });
        } catch (err) {
            console.error('Failed to DM trainee on age verify deny:', err);
        }
    },

    async handleMessage(message, client) {
        if (message.author.bot) return;
        if (message.guild) return;

        const session = activeSessions.get(message.author.id);
        if (!session) return;

        await message.react('👀').catch(() => {});

        if (session.waitingForAgeVerify) {
            const hasImage = message.attachments.size > 0 || message.content.match(/https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)/i);

            if (!hasImage) {
                await message.reply('⚠️ Please send a **screenshot or image link** for your age verification.');
                return;
            }

            const imageUrl = message.attachments.first()?.url || message.content.match(/https?:\/\/\S+/)?.[0];

            ageVerifyPending.set(message.author.id, { userId: message.author.id, imageUrl, submittedAt: Date.now() });

            const ageVerifyLogChannel = await client.channels.fetch(AGE_VERIFY_LOG_CHANNEL_ID).catch(() => null);
            if (ageVerifyLogChannel) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`ageverify_accept_${message.author.id}`).setLabel('✅ Accept').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`ageverify_deny_${message.author.id}`).setLabel('❌ Deny').setStyle(ButtonStyle.Danger)
                );

                await ageVerifyLogChannel.send({
                    content: `<@&${TRAINING_ROLE_ID}>`,
                    embeds: [new EmbedBuilder()
                        .setTitle('📋 Age Verification Submission')
                        .setColor(0x9B59B6)
                        .addFields(
                            { name: 'Trainee', value: `<@${message.author.id}>`, inline: true },
                            { name: 'Training', value: TRAININGS[session.trainingKey].name, inline: true },
                            { name: 'Submitted At', value: new Date().toLocaleString(), inline: true },
                            { name: 'Status', value: '⏳ Awaiting Review', inline: true }
                        )
                        .setImage(imageUrl)
                        .setTimestamp()],
                    components: [row]
                });
            }

            await message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('📋 Verification Submitted!')
                    .setDescription('Your age verification has been submitted and is awaiting review by PR Leadership. You will be notified once it has been reviewed. 💜')
                    .setColor(0x9B59B6)
                    .setTimestamp()]
            });
        }
    }
};

module.exports.activeSessions   = activeSessions;
module.exports.helpMessages     = helpMessages;
module.exports.ageVerifyPending = ageVerifyPending;
module.exports.botTrainingSessions = botTrainingSessions;

// ══════════════════════════════════════════════════════════════════════════════
// BLAST — one-time DM to all staff
// ══════════════════════════════════════════════════════════════════════════════

async function handleBlast(interaction, client) {
    const { TrainingInvite } = require('../db');
    const guild = interaction.guild;
    const staffRole = guild.roles.cache.get(TRAINING_ROLE_ID)
        || await guild.roles.fetch(TRAINING_ROLE_ID).catch(() => null);

    if (!staffRole) {
        return interaction.editReply('❌ Could not find the staff role. Check `TRAINING_ROLE_ID`.');
    }

    // Fetch all members with the role
    await guild.members.fetch();
    const staffMembers = staffRole.members.filter(m => !m.user.bot);

    if (staffMembers.size === 0) {
        return interaction.editReply('❌ No staff members found with that role.');
    }

    // Load everyone already invited
    const alreadyInvited = new Set(
        (await TrainingInvite.find({}, 'userId').lean()).map(r => r.userId)
    );

    const toSend  = staffMembers.filter(m => !alreadyInvited.has(m.id));
    const skipped = staffMembers.size - toSend.size;

    if (toSend.size === 0) {
        return interaction.editReply(`✅ All **${staffMembers.size}** staff members have already been invited. Nobody new to DM.`);
    }

    await interaction.editReply(`⏳ Sending DMs to **${toSend.size}** staff member${toSend.size !== 1 ? 's' : ''}${skipped > 0 ? ` (skipping ${skipped} already invited)` : ''}...`);

    let sent = 0, failed = 0;

    for (const [, member] of toSend) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('☕ Kavià Café — Staff Training')
                .setColor(0x9B59B6)
                .setDescription(
                    `Hey **${member.displayName}**! 👋\n\n` +
                    `We're reaching out to let you know that the **Alliance Bot Training** is now available for all staff!\n\n` +
                    `This training covers everything about the alliance bot — from verification and topost to pay and discipline — with a live sandbox where you can practice the full alliance setup.\n\n` +
                    `**Would you like to go through training?**\n\n` +
                    `> ✅ **Yes** — A private training channel will be created for you right away.\n` +
                    `> ❌ **No** — No worries, you won't be asked again.\n\n` +
                    `*You can always run \`/starttraining start\` later if you change your mind.*`
                )
                .setFooter({ text: 'Kavià Alliance Bot • Training System' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`blast_yes_${member.id}`)
                    .setLabel('✅ Yes, start my training!')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`blast_no_${member.id}`)
                    .setLabel('❌ No thanks')
                    .setStyle(ButtonStyle.Secondary)
            );

            await member.send({ embeds: [embed], components: [row] });

            // Record in MongoDB that we've invited them
            await TrainingInvite.findOneAndUpdate(
                { userId: member.id },
                { userId: member.id, sentAt: new Date(), response: 'pending' },
                { upsert: true, new: true }
            );

            sent++;
            // Small delay to avoid rate limits
            await new Promise(r => setTimeout(r, 500));
        } catch {
            failed++;
        }
    }

    await interaction.editReply(
        `✅ Done! Sent to **${sent}** staff member${sent !== 1 ? 's' : ''}` +
        (failed > 0 ? ` • ❌ **${failed}** couldn't be DM'd (DMs closed)` : '') +
        (skipped > 0 ? ` • ⏭️ **${skipped}** already invited` : '')
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// BOT TRAINING — channel-based logic
// ══════════════════════════════════════════════════════════════════════════════

async function startBotTrainingSession(interaction, client, user, includeQuiz) {
    const guild = interaction.guild;
    const { StringSelectMenuBuilder } = require('discord.js');

    const trainerId = interaction.user.id;

    const select = new StringSelectMenuBuilder()
        .setCustomId(`bt_cat_select_${trainerId}`)
        .setPlaceholder('Select training categories...')
        .setMinValues(1)
        .setMaxValues(Object.keys(BOT_CATEGORIES).length)
        .addOptions(
            Object.entries(BOT_CATEGORIES).map(([key, def]) => ({
                label: def.label,
                value: key,
                description: def.description,
                emoji: def.emoji
            }))
        );

    const everythingBtn = new ButtonBuilder()
        .setCustomId(`bt_all_${trainerId}`)
        .setLabel('📚 Train on Everything')
        .setStyle(ButtonStyle.Success);

    const embed = new EmbedBuilder()
        .setTitle('🤖 Alliance Bot Training')
        .setColor(0x9B59B6)
        .setDescription(
            `Starting bot training for **${user.displayName || user.username}**.\n\n` +
            'Select the **categories** to cover, or click **Train on Everything** for the full session.\n\n' +
            '> A private training channel will be created with step-by-step guides.\n' +
            `> ${includeQuiz ? 'A **quiz** will be included at the end.' : 'No quiz — reading only.'}\n` +
            '> Channel auto-deletes after **24 hours** or when training ends.'
        )
        .setFooter({ text: 'Kavià Alliance Bot • Training System' });

    // Store pending keyed on trainer's user ID
    botTrainingSessions.set(`pending_${trainerId}`, {
        trainerId,
        traineeId:   user.id,
        traineeName: user.displayName || user.username,
        includeQuiz,
        guild
    });

    // Acknowledge the slash command ephemerally, then post the picker publicly so buttons work
    await interaction.editReply({ content: '✅ Training picker sent below!', embeds: [], components: [] });

    await interaction.channel.send({
        content: `<@${interaction.user.id}>`,
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(select),
            new ActionRowBuilder().addComponents(everythingBtn)
        ]
    });
}

async function handleBotTrainingButton(interaction, client) {
    const id = interaction.customId;

    // ── Everything button ──
    if (id.startsWith('bt_all_')) {
        const trainerId = id.replace('bt_all_', '');
        const pending = botTrainingSessions.get(`pending_${trainerId}`);
        if (!pending) return interaction.reply({ content: '❌ Session expired. Run `/starttraining` again.', ephemeral: true });
        botTrainingSessions.delete(`pending_${trainerId}`);
        await interaction.update({ content: '⏳ Creating training channel...', components: [], embeds: [] });
        await createBotTrainingChannel(interaction, client, pending, Object.keys(BOT_CATEGORIES));
        return;
    }

    // ── Sandbox start ──
    if (id.startsWith('bt_sandbox_start_')) {
        const channelId = id.replace('bt_sandbox_start_', '');
        const session = botTrainingSessions.get(channelId);
        if (!session) return interaction.reply({ content: '❌ Session not found.', ephemeral: true });
        await interaction.deferUpdate();
        await runSandbox(interaction.channel, session, interaction.guild, client);
        return;
    }

    // ── Next ──
    if (id.startsWith('bt_next_')) {
        const channelId = id.replace('bt_next_', '');
        const session = botTrainingSessions.get(channelId);
        if (!session) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });
        await interaction.deferUpdate();

        session.stepIndex++;
        const catKey = session.selectedCategories[session.categoryIndex];
        const steps = BOT_CATEGORIES[catKey]?.getSteps() || [];
        if (session.stepIndex >= steps.length) {
            session.categoryIndex++;
            session.stepIndex = 0;
        }
        await sendBotStep(interaction.channel, session, client);
        return;
    }

    // ── Prev ──
    if (id.startsWith('bt_prev_')) {
        const channelId = id.replace('bt_prev_', '');
        const session = botTrainingSessions.get(channelId);
        if (!session) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });
        await interaction.deferUpdate();
        session.stepIndex = Math.max(0, session.stepIndex - 1);
        await sendBotStep(interaction.channel, session, client);
        return;
    }

    // ── Start quiz button ──
    if (id.startsWith('bt_startquiz_')) {
        const channelId = id.replace('bt_startquiz_', '');
        const session = botTrainingSessions.get(channelId);
        if (!session) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });
        await interaction.deferUpdate();
        await sendBotQuizQuestion(interaction.channel, session);
        return;
    }

    // ── Quiz answers ──
    if (id.startsWith('bt_quiz_')) {
        const parts  = id.replace('bt_quiz_', '').split('_');
        const answer = parts[0];
        const channelId = parts.slice(1).join('_');
        const session = botTrainingSessions.get(channelId);
        if (!session) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });
        await interaction.deferUpdate();

        const questions = session._quizQuestions || [];
        const q = questions[session.quizIndex];
        const correct = answer === q.answer;
        session.quizAnswers.push({ question: q.question, given: answer.toUpperCase(), correct: q.answer.toUpperCase(), passed: correct });
        session.quizIndex++;

        await interaction.channel.send({
            embeds: [new EmbedBuilder()
                .setDescription(correct ? '✅ Correct!' : `❌ Incorrect. The correct answer was **${q.answer.toUpperCase()}**.`)
                .setColor(correct ? 'Green' : 'Red')]
        });

        if (session.quizIndex < questions.length) {
            setTimeout(() => sendBotQuizQuestion(interaction.channel, session), 1000);
        } else {
            await sendBotQuizResults(interaction.channel, session, client);
        }
        return;
    }

    // ── Skip quiz ──
    if (id.startsWith('bt_skip_quiz_')) {
        const channelId = id.replace('bt_skip_quiz_', '');
        const session = botTrainingSessions.get(channelId);
        if (!session) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });
        await interaction.deferUpdate();
        await sendBotCompletion(interaction.channel, session, client);
        return;
    }

    // ── Done / cleanup ──
    if (id.startsWith('bt_done_')) {
        const channelId = id.replace('bt_done_', '');
        const session = botTrainingSessions.get(channelId);
        if (!session) return interaction.reply({ content: '❌ Already cleaned up.', ephemeral: true });
        await interaction.deferUpdate();
        await interaction.channel.send({ content: '🧹 Cleaning up training session...' });
        await cleanupBotSession(session, interaction.guild);
        return;
    }
}

module.exports.handleBotTrainingSelectMenu = async function(interaction, client) {
    const id = interaction.customId;

    if (id.startsWith('bt_cat_select_')) {
        const trainerId = id.replace('bt_cat_select_', '');
        const pending = botTrainingSessions.get(`pending_${trainerId}`);
        if (!pending) return interaction.reply({ content: '❌ Session expired. Run `/starttraining` again.', ephemeral: true });
        botTrainingSessions.delete(`pending_${trainerId}`);
        const selected = interaction.values;
        await interaction.update({ content: `⏳ Creating training channel for: ${selected.map(k => BOT_CATEGORIES[k]?.emoji).join(' ')}...`, components: [], embeds: [] });
        await createBotTrainingChannel(interaction, client, pending, selected);
    }
};

async function createBotTrainingChannel(interaction, client, pending, selectedCategories) {
    const { trainerId, traineeId, traineeName, includeQuiz, guild: pendingGuild } = pending;
    const guild = interaction.guild || pendingGuild;
    if (!guild) return;

    const channelName = `bot-training-${traineeName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20)}`;

    let trainingChannel;
    try {
        trainingChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: TRAINING_CATEGORY_ID,
            topic: `🤖 Bot training for <@${traineeId}> — started by <@${trainerId}>`,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: traineeId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                ...(trainerId !== traineeId
                    ? [{ id: trainerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }]
                    : []),
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] }
            ]
        });
    } catch (err) {
        console.error('[BotTraining] Failed to create channel:', err);
        try { await interaction.followUp({ content: `❌ Couldn't create training channel: ${err.message}`, ephemeral: true }); } catch {}
        return;
    }

    const channelId = trainingChannel.id;
    const session = {
        id: channelId,
        trainingChannelId: channelId,
        trainerId,
        traineeId,
        includeQuiz,
        selectedCategories,
        categoryIndex: 0,
        stepIndex: 0,
        sandboxRoleId: null,
        sandboxChannelId: null,
        quizIndex: 0,
        quizAnswers: [],
        autoDeleteTimeout: null
    };

    botTrainingSessions.set(channelId, session);

    session.autoDeleteTimeout = setTimeout(async () => {
        const ch = guild.channels.cache.get(channelId);
        if (ch) await ch.send({ content: '⏰ **24 hours have passed.** Auto-deleting training session...' }).catch(() => {});
        setTimeout(() => cleanupBotSession(session, guild), 5000);
    }, 24 * 60 * 60 * 1000);

    const introEmbed = new EmbedBuilder()
        .setTitle('🤖 Alliance Bot Training — Welcome!')
        .setColor(0x9B59B6)
        .setDescription(
            `Hey <@${traineeId}>! Welcome to your bot training session.\n\n` +
            `**Trainer:** <@${trainerId}>\n` +
            `**Sections:** ${selectedCategories.map(k => BOT_CATEGORIES[k]?.emoji).join(' ')} ${selectedCategories.length} section${selectedCategories.length !== 1 ? 's' : ''}\n` +
            `**Quiz at end:** ${includeQuiz ? '✅ Yes' : '❌ No'}\n\n` +
            '**How this works:**\n' +
            '• Read each embed and click **Next ▶️** to continue\n' +
            '• Use **◀️ Previous** to go back at any time\n' +
            '• Click **🏁 End Training** at any time to finish and clean up\n' +
            '• This channel **auto-deletes in 24 hours**\n\n' +
            '> Ready? First section starts below! 👇'
        )
        .setFooter({ text: `Sections: ${selectedCategories.map(k => BOT_CATEGORIES[k]?.label).join(', ')}` })
        .setTimestamp();

    await trainingChannel.send({
        content: `<@${traineeId}>${trainerId !== traineeId ? ` <@${trainerId}>` : ''}`,
        embeds: [introEmbed]
    });

    // Update the picker message to show the channel link
    try {
        await interaction.editReply({ content: `✅ Training channel created: <#${trainingChannel.id}>` }).catch(() =>
            interaction.channel?.send({ content: `✅ Training channel: <#${trainingChannel.id}>` }).catch(() => {})
        );
    } catch {}

    await sendBotStep(trainingChannel, session, client);
}

async function sendBotStep(channel, session) {
    const catKeys = session.selectedCategories;
    const catIdx  = session.categoryIndex;
    const stepIdx = session.stepIndex;

    if (catIdx >= catKeys.length) {
        return await sendBotQuizOrCompletion(channel, session);
    }

    const catKey = catKeys[catIdx];
    const catDef = BOT_CATEGORIES[catKey];
    if (!catDef) {
        session.categoryIndex++;
        session.stepIndex = 0;
        return await sendBotStep(channel, session);
    }

    const steps = catDef.getSteps();

    if (stepIdx >= steps.length) {
        session.categoryIndex++;
        session.stepIndex = 0;
        return await sendBotStep(channel, session);
    }

    const step = steps[stepIdx];
    const isSandboxIntro = catKey === 'sandbox';

    const totalSteps = steps.length;
    const filled = Math.round(((stepIdx + 1) / totalSteps) * 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

    const progressEmbed = new EmbedBuilder()
        .setColor(0x2C2F33)
        .setDescription(
            `**${catDef.emoji} Section ${catIdx + 1}/${catKeys.length}: ${catDef.label}**\n` +
            `${bar} ${stepIdx + 1}/${totalSteps}`
        );

    const contentEmbed = new EmbedBuilder()
        .setTitle(step.title)
        .setDescription(step.content)
        .setColor(0x9B59B6)
        .setFooter({ text: step.footer || '' })
        .setTimestamp();

    const row = new ActionRowBuilder();

    if (isSandboxIntro) {
        row.addComponents(
            new ButtonBuilder().setCustomId(`bt_sandbox_start_${session.id}`).setLabel('▶️ Start Sandbox').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`bt_done_${session.id}`).setLabel('🏁 End Training').setStyle(ButtonStyle.Danger)
        );
    } else {
        if (stepIdx > 0 || catIdx > 0) {
            row.addComponents(new ButtonBuilder().setCustomId(`bt_prev_${session.id}`).setLabel('◀️ Previous').setStyle(ButtonStyle.Secondary));
        }
        const isLastStep = stepIdx >= totalSteps - 1 && catIdx >= catKeys.length - 1;
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`bt_next_${session.id}`)
                .setLabel(isLastStep ? (session.includeQuiz ? '📝 Start Quiz' : '✅ Finish') : 'Next ▶️')
                .setStyle(isLastStep ? ButtonStyle.Success : ButtonStyle.Primary)
        );
        row.addComponents(new ButtonBuilder().setCustomId(`bt_done_${session.id}`).setLabel('🏁 End Training').setStyle(ButtonStyle.Danger));
    }

    await channel.send({ embeds: [progressEmbed, contentEmbed], components: [row] });
}

function getSessionQuestions(session) {
    const questions = [];
    for (const catKey of session.selectedCategories) {
        const qs = CATEGORY_QUESTIONS[catKey] || [];
        questions.push(...qs);
    }
    return questions;
}

async function sendBotQuizOrCompletion(channel, session) {
    if (session.includeQuiz) {
        const questions = getSessionQuestions(session);
        session._quizQuestions = questions; // store filtered list on session

        const introEmbed = new EmbedBuilder()
            .setTitle('📝 Bot Training Quiz')
            .setDescription(
                `Great work getting through all the sections! Now let\'s test your knowledge.\n\n` +
                `You\'ll be asked **${questions.length} question${questions.length !== 1 ? 's' : ''}** based on the categories you covered.\n\n` +
                `Use the A / B / C / D buttons to answer each question.\n\n` +
                `> You can also skip the quiz if you\'d prefer.`
            )
            .setColor(0x9B59B6)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`bt_startquiz_${session.id}`).setLabel('▶️ Start Quiz').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`bt_skip_quiz_${session.id}`).setLabel('Skip Quiz').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`bt_done_${session.id}`).setLabel('🏁 End Training').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ embeds: [introEmbed], components: [row] });
    } else {
        await sendBotCompletion(channel, session);
    }
}

async function sendBotQuizQuestion(channel, session) {
    const questions = session._quizQuestions || [];
    const q = questions[session.quizIndex];
    if (!q) return; // no questions for selected categories

    const embed = new EmbedBuilder()
        .setTitle(`Question ${session.quizIndex + 1} of ${questions.length}`)
        .setDescription(`**${q.question}**\n\n${q.options.join('\n')}`)
        .setColor(0x9B59B6)
        .setFooter({ text: 'Select your answer below' })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bt_quiz_a_${session.id}`).setLabel('A').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bt_quiz_b_${session.id}`).setLabel('B').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bt_quiz_c_${session.id}`).setLabel('C').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bt_quiz_d_${session.id}`).setLabel('D').setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row] });
}

async function sendBotQuizResults(channel, session, client) {
    const score    = session.quizAnswers.filter(a => a.passed).length;
    const total    = (session._quizQuestions || []).length;
    const passed   = total === 0 || score >= Math.ceil(total * 0.75); // 75% to pass

    const breakdown = session.quizAnswers.map((a, i) =>
        `**Q${i + 1}:** ${a.passed ? '✅' : '❌'} — Answered: **${a.given}** | Correct: **${a.correct}**`
    ).join('\n');

    const resultEmbed = new EmbedBuilder()
        .setTitle(passed ? '🎉 Quiz Passed!' : '📋 Quiz Complete')
        .setColor(passed ? 'Green' : 'Orange')
        .setDescription(
            passed
                ? `Great job, <@${session.traineeId}>! You scored **${score}/${total}** and passed the bot training quiz! 🎊`
                : `You scored **${score}/${total}**. You need **${Math.ceil(total * 0.75)}/${total}** to pass. Don\'t worry — you can review the sections and try again!`
        )
        .addFields({ name: 'Question Breakdown', value: breakdown, inline: false })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bt_done_${session.id}`).setLabel('🏁 End & Cleanup').setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [resultEmbed], components: [row] });

    // Log to training log channel
    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (logChannel) {
        await logChannel.send({
            embeds: [new EmbedBuilder()
                .setTitle(`📋 Bot Training Quiz Results — ${passed ? '✅ Passed' : '⚠️ Needs Review'}`)
                .setColor(passed ? 'Green' : 'Orange')
                .addFields(
                    { name: 'Trainee', value: `<@${session.traineeId}>`, inline: true },
                    { name: 'Training', value: 'Alliance Bot Training', inline: true },
                    { name: 'Score', value: `${score}/${total}`, inline: true },
                    { name: 'Result', value: passed ? '✅ Passed' : '❌ Did not pass', inline: true },
                    { name: 'Date', value: new Date().toLocaleString(), inline: true },
                    { name: 'Question Breakdown', value: breakdown, inline: false }
                )
                .setTimestamp()]
        });
    }
}

async function sendBotCompletion(channel, session, client) {
    const embed = new EmbedBuilder()
        .setTitle('🎓 Bot Training Complete!')
        .setColor(0x2ECC71)
        .setDescription(
            `Great work, <@${session.traineeId}>! You\'ve completed the Alliance Bot training.\n\n` +
            '**Sections covered:**\n' +
            session.selectedCategories.map(k => `• ${BOT_CATEGORIES[k]?.label || k}`).join('\n') +
            '\n\n> This channel will be deleted in **10 minutes**.\n> Click **🏁 End & Cleanup** to delete it now.'
        )
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bt_done_${session.id}`).setLabel('🏁 End & Cleanup').setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [row] });

    session.autoDeleteTimeout = setTimeout(async () => {
        const guild = channel.guild;
        await cleanupBotSession(session, guild);
    }, 10 * 60 * 1000);
}

async function runSandbox(channel, session, guild, client) {
    const fakeAllianceName = `Sandbox Alliance ${Math.floor(Math.random() * 900) + 100}`;

    await channel.send({
        embeds: [new EmbedBuilder().setColor(0x9B59B6).setDescription(`🧪 Creating sandbox alliance: **${fakeAllianceName}**...\n⏳ Creating role...`)]
    });

    let sandboxRole = null;
    let sandboxChannel = null;

    try {
        sandboxRole = await guild.roles.create({
            name: `[SANDBOX] ${fakeAllianceName}`,
            color: 0x9B59B6,
            reason: 'Training sandbox — will be deleted'
        });

        await channel.send({
            embeds: [new EmbedBuilder().setColor(0x9B59B6).setDescription(`✅ Role created: **${sandboxRole.name}**\n⏳ Creating channel...`)]
        });

        sandboxChannel = await guild.channels.create({
            name: `sandbox-${fakeAllianceName.toLowerCase().replace(/\s+/g, '-')}`,
            type: ChannelType.GuildText,
            parent: TRAINING_CATEGORY_ID,
            topic: '⚠️ SANDBOX CHANNEL — Training simulation. Will be deleted.',
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: sandboxRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: session.traineeId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                ...(session.trainerId !== session.traineeId
                    ? [{ id: session.trainerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }]
                    : [])
            ]
        });

        session.sandboxRoleId    = sandboxRole.id;
        session.sandboxChannelId = sandboxChannel.id;

        await channel.send({
            embeds: [new EmbedBuilder().setColor(0x9B59B6).setDescription(`✅ Channel created: <#${sandboxChannel.id}>\n⏳ Sending welcome message...`)]
        });

        // Send the REAL welcome message in the sandbox channel
        await sandboxChannel.send({
            content:
                `:tada: **Welcome New Alliance! | Kavi Café x ${fakeAllianceName}** :tada:\n\n` +
                `We're thrilled to officially welcome your community into an alliance with Kavi Café! :star2:\n\n` +
                `:speech_balloon: **Questions & Support**\nIf you have any questions, concerns, or suggestions, this is the perfect place to share them.\n\n` +
                `:busts_in_silhouette: **Your Representative Pair**\nPlease meet your Kavi Café representatives:\n\n**• [Team Member 1]**\n**• [Team Member 2]**\n\n` +
                `:handshake: **Looking Ahead**\nWe're so excited to be working together and building a strong relationship.\n\n` +
                `:coffee::sparkles: Here's to a successful partnership between **Kavi Café** and **${fakeAllianceName}**! :sparkles::coffee:`
        });

        // Show what MongoDB would store
        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('🧪 What Gets Saved to MongoDB (normally)')
                .setColor(0x27AE60)
                .addFields(
                    { name: 'groupName', value: fakeAllianceName, inline: true },
                    { name: 'welcomeChannelId', value: sandboxChannel.id, inline: true },
                    { name: 'repRoleId', value: sandboxRole.id, inline: true },
                    { name: 'ourRepRoleId', value: '(created separately)', inline: true },
                    { name: 'theirRepIds', value: '["user_id_of_rep"]', inline: false },
                    { name: 'ourRepIds', value: '["team_member_1_id", "team_member_2_id"]', inline: false },
                    { name: 'team', value: '1–5 (selected during verification)', inline: true },
                    { name: 'strikes', value: '[] (empty to start)', inline: true }
                )
                .setFooter({ text: '⚠️ SANDBOX — Nothing was saved to MongoDB' })]
        });

        const doneRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`bt_done_${session.id}`).setLabel('🏁 End Training & Cleanup').setStyle(ButtonStyle.Danger)
        );

        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('🧪 Sandbox Complete!')
                .setColor(0x2ECC71)
                .setDescription(
                    `The sandbox alliance **${fakeAllianceName}** has been created!\n` +
                    `Check <#${sandboxChannel.id}> to see the welcome message.\n\n` +
                    `Click **🏁 End Training & Cleanup** to delete the sandbox channel, role, and this training channel.`
                )],
            components: [doneRow]
        });

        // Move to next category if any remain
        session.categoryIndex++;
        session.stepIndex = 0;
        const remaining = session.selectedCategories.slice(session.categoryIndex);
        if (remaining.length > 0) {
            await channel.send({ content: `▶️ Continuing to: **${BOT_CATEGORIES[remaining[0]]?.label}**...` });
            await sendBotStep(channel, session);
        }

    } catch (err) {
        console.error('[BotTraining] Sandbox error:', err);
        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Sandbox Error')
                .setColor(0xE74C3C)
                .setDescription(`Failed to create sandbox: \`${err.message}\`\n\nMake sure the bot has Manage Channels + Manage Roles permission in the training category.`)]
        });
    }
}

async function cleanupBotSession(session, guild) {
    if (session.autoDeleteTimeout) clearTimeout(session.autoDeleteTimeout);

    if (session.sandboxRoleId) {
        const role = guild.roles.cache.get(session.sandboxRoleId) || await guild.roles.fetch(session.sandboxRoleId).catch(() => null);
        if (role) await role.delete('Bot training sandbox cleanup').catch(console.error);
    }
    if (session.sandboxChannelId) {
        const ch = guild.channels.cache.get(session.sandboxChannelId) || await guild.channels.fetch(session.sandboxChannelId).catch(() => null);
        if (ch) await ch.delete('Bot training sandbox cleanup').catch(console.error);
    }
    if (session.trainingChannelId) {
        const ch = guild.channels.cache.get(session.trainingChannelId) || await guild.channels.fetch(session.trainingChannelId).catch(() => null);
        if (ch) await ch.delete('Bot training complete').catch(console.error);
    }

    botTrainingSessions.delete(session.id);
}

// ══════════════════════════════════════════════════════════════════════════════
// PR Training helpers (unchanged from original)
// ══════════════════════════════════════════════════════════════════════════════

function buildSectionEmbed(training, index) {
    const section = training.sections[index];
    return new EmbedBuilder()
        .setTitle(section.title)
        .setDescription(section.content)
        .setColor(0x9B59B6)
        .setFooter({ text: `Section ${index + 1} of ${training.sections.length} • Click Done when ready` })
        .setTimestamp();
}

function buildSectionRow(userId, index) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`section_done_${userId}`).setLabel('✅ Done').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`section_help_${userId}`).setLabel('🆘 I Need Help').setStyle(ButtonStyle.Secondary)
    );
}

function buildQuestionEmbed(training, index) {
    const q = training.questions[index];
    return new EmbedBuilder()
        .setTitle(`Question ${index + 1} of ${training.questions.length}`)
        .setDescription(`**${q.question}**\n\n${q.options.join('\n')}`)
        .setColor(0x9B59B6)
        .setFooter({ text: 'Select your answer below' })
        .setTimestamp();
}

function buildQuizRow(userId, index) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`quiz_a_${userId}`).setLabel('A').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`quiz_b_${userId}`).setLabel('B').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`quiz_c_${userId}`).setLabel('C').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`quiz_d_${userId}`).setLabel('D').setStyle(ButtonStyle.Primary)
    );
}