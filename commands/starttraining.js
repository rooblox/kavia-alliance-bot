const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const LOG_CHANNEL_ID = '1485119755206791289';

const SECTIONS = [
    {
        title: '📢 Welcome to Kavià Café Staff Training',
        content: `Hello! First and foremost, congratulations on joining the Public Relations Department at Kavià. You have already completed your mentorship and this is a final training to help you find your way in the alliance hub and public relations server, and inform you of our expectations.\n\nAs a PR Staff member, your role is very important. You'll help us manage, maintain, and grow our alliances with other groups.\n\nDuring this training I will be sending a number of messages. When you have fully read a message and understood it, please reply with **"done"**.`
    },
    {
        title: '🎯 Responsibilities and Expectations',
        content: `**Alliance Communication**\n• Keep up with affiliated groups.\n• Remain professional in official communication. When you reach out to an affiliated group, you represent Kavià in an official capacity.\n• Post alliance announcements in the partnerships channel in our main server using the alliance ping.\n• Make sure announcements are professional *and* on time. (Normally 48 hours is our max.)\n\n**Monitoring Alliances**\n• Ensure alliances are active and engaging with their communities.\n• Notify PR Leadership immediately if an alliance becomes inactive or problematic.\n• When looking for inactivity in groups, make sure to report immediately if the inactivity is severe.`
    },
    {
        title: '☕ Handling Common Tasks',
        content: `**Posting Announcements**\n• When posting a partner's announcement, copy the announcement exactly as the partner provides. Unless major grammar issues are found, do **not** edit an announcement.\n• If there is an everyone ping in the provided message, change it to the alliance ping.\n• If any information must be filled in by yourself like a ping, make sure to do this before posting.\n\n**Alliance-Related Problems**\n• If an alliance becomes problematic, has issues, or is inactive, please notify a member of the PR leadership.\n• If you are not sure what to say when communicating with an alliance, feel free to ask.\n\n**Basic Communication**\n• Be polite and professional at all times.\n• Use proper grammar, avoid slang, and always stay respectful.\n• Never argue — if there's an issue, bring it to PR Leadership.`
    },
    {
        title: '⚘️ Handling an Alliance Request',
        content: `• When a group comes into Kavià requesting a partnership, please start by asking them for the Discord link to their main server. Verify that they meet our requirements, and that we aren't already allied with them.\n• If they do **not** meet our requirements, please send them the affiliation deny message which can be found in your resources channel.\n• If they **do** meet our requirements, proceed by sending them this form, then ask a member of the PR leadership team to review. This may take up to 48 hours.\n📋 https://docs.google.com/forms/d/e/1FAIpQLSftkJqN7MCrnX3UfQHpCpiRxO4e12JhGe_ZbUXDWRV4hrPuDQ/viewform?usp=publish-editor\n• If the user does not respond, you may remind them after 24 hours. If you have to remind them a second time, mention that their ticket will be closed in 24 hours if they do not respond.\n• If the alliance is accepted, send them the acceptance message from your resources channel, then proceed to set up the alliance as usual.`
    },
    {
        title: '📢 Engagement, Awareness and OTD',
        content: `Anything PRD related but not alliance related is located in the Public Relations server. Here you may claim anything you need for quota.\n\n**QOTD (Question of the Day)**\n• Please post your OTD in a timely manner. Refrain from topics that were already used that week (e.g. Superheroes, Media, etc.)\n\n**Events**\n• Head over to the event request channel to request your events. If you are hosting one with an alliance, make sure to specify that.\n\n**Awareness**\n• When posting awareness/events, please make sure to use the proper pings *in* your message, not after or below.\n• Awareness topics that include serious topics may need to be edited slightly to comply with server rules.\n\nIf you are in need of help with anything, do *not* hesitate to ask. We would rather have you ask than mess up, and our staff team is always available to help.`
    },
    {
        title: '🗒️ Setting Up an Alliance',
        content: `• Once you confirm the alliance, have 2 representatives join our alliance hub and main server.\n• Create a channel with the alliance's name under the right category. If it is not a café *or* a restaurant, use the "Others" section. Add the PR leadership role to this channel.\n• Create a role named after the alliance's name (e.g. "Kavia Cafe").\n• Assign both representatives the already existing "Allied Reps" role and their designated alliance role.\n• Add the role named after the alliance to the channel so they have access to see it.\n• Once you double check all the essential people have access, use the **/alliance-add** command and if done properly it will send a welcome message in the alliance's channel.`
    },
    {
        title: '💜 Alliance Visits',
        content: `It may occur that you have to do an alliance visit with one of our affiliated groups at any point in time. Please follow the guide below:\n\n📄 https://docs.google.com/document/d/18BtqwioC8Yd4F59xRTBc5xPDM3QnOmMX48QYrEzE49o/edit?usp=drivesdk`
    },
    {
        title: '💜 Final Notes',
        content: `We are incredibly grateful to have you in the Public Relations Department. For any more recent changes please refer to the announcements channel. If you have any questions or need help doing anything, please do not hesitate to reach out to PRD leadership — no question is dumb and we are happy to help you.\n\nWelcome to the team! 💜\n\nPlease reply with **"done"** to confirm you have read everything and proceed to your final quiz!`
    }
];

const QUESTIONS = [
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
        question: 'Which command do you use to officially add a new alliance once setup is complete?',
        options: ['A) /alliance-new', 'B) /add-alliance', 'C) /alliance-create', 'D) /alliance-add'],
        answer: 'd'
    }
];

const activeSessions = new Map();
// Track help log messages: userId -> log message id
const helpMessages = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('starttraining')
        .setDescription('Start the PR staff training for a user')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The user to train')
                .setRequired(true)),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const user = interaction.options.getUser('member');

        if (activeSessions.has(user.id)) {
            return await interaction.editReply(`❌ **${user.tag}** already has an active training session.`);
        }

        try {
            const embed = buildSectionEmbed(0);
            await user.send({ embeds: [embed] });

            activeSessions.set(user.id, {
                section: 0,
                phase: 'training',
                quizIndex: 0,
                quizAnswers: [],
                startedBy: interaction.user.tag,
                helpCount: 0,
                waitingForHelp: false
            });

            await interaction.editReply(`✅ Training started for **${user.tag}**! Section 1 has been sent to their DMs.`);

            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📚 Training Started')
                    .setColor('Blue')
                    .addFields(
                        { name: 'Trainee', value: `<@${user.id}>`, inline: true },
                        { name: 'Started By', value: interaction.user.tag, inline: true },
                        { name: 'Date', value: new Date().toLocaleString(), inline: false }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (err) {
            console.error('Error starting training:', err);
            await interaction.editReply(`❌ Could not DM **${user.tag}**. They may have DMs closed.`);
        }
    },

    async handleMessage(message, client) {
        if (message.author.bot) return;
        if (message.guild) return;

        const userId = message.author.id;
        const session = activeSessions.get(userId);
        if (!session) return;

        const content = message.content.trim().toLowerCase();

        await message.react('👀').catch(() => {});

        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

        // Block progress if waiting for help to be resolved
        if (session.waitingForHelp) {
            await message.react('⏳').catch(() => {});
            await message.author.send({
                embeds: [new EmbedBuilder()
                    .setDescription('⏳ Please wait — a member of PR Leadership is being notified to help you. You\'ll be able to continue once your help request has been **resolved**.')
                    .setColor('Orange')]
            });
            return;
        }

        // ── TRAINING PHASE ──
        if (session.phase === 'training') {
            if (content === 'done' || content === 'next') {
                await message.react('✅').catch(() => {});
                session.section++;

                if (session.section >= SECTIONS.length) {
                    session.phase = 'quiz';
                    session.quizIndex = 0;
                    session.quizAnswers = [];

                    const quizIntroEmbed = new EmbedBuilder()
                        .setTitle('📝 Final Quiz')
                        .setDescription('Great job completing the training! You will now be asked **8 questions**.\n\nReply with **a**, **b**, **c**, or **d** for each question.')
                        .setColor('Purple')
                        .setTimestamp();

                    await message.author.send({ embeds: [quizIntroEmbed] });
                    setTimeout(async () => {
                        await message.author.send({ embeds: [buildQuestionEmbed(0)] });
                    }, 1500);
                } else {
                    await message.author.send({ embeds: [buildSectionEmbed(session.section)] });
                }

            } else if (content.includes('help') || content.includes('i need help') || content.includes('confused')) {
                await message.react('🆘').catch(() => {});
                session.waitingForHelp = true;
                session.helpCount++;

                await message.author.send({
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
                            { name: 'Section', value: `${session.section + 1} — ${SECTIONS[session.section].title}`, inline: false },
                            { name: 'Message', value: message.content, inline: false },
                            { name: 'Help Count', value: `${session.helpCount}`, inline: true },
                            { name: 'Date', value: new Date().toLocaleString(), inline: true },
                            { name: 'Status', value: '🟠 Pending', inline: true }
                        )
                        .setTimestamp();

                    const logMsg = await logChannel.send({ embeds: [helpEmbed], components: [row] });
                    helpMessages.set(userId, logMsg.id);
                }

            } else {
                await message.react('❓').catch(() => {});
                await message.author.send({
                    embeds: [new EmbedBuilder()
                        .setDescription('Please reply with **"done"** when you have finished reading, or **"help"** if you need assistance.')
                        .setColor('Grey')]
                });
            }

        // ── QUIZ PHASE ──
        } else if (session.phase === 'quiz') {
            const validAnswers = ['a', 'b', 'c', 'd'];

            if (!validAnswers.includes(content)) {
                await message.react('❓').catch(() => {});
                await message.author.send({
                    embeds: [new EmbedBuilder()
                        .setDescription('Please reply with **a**, **b**, **c**, or **d**.')
                        .setColor('Grey')]
                });
                return;
            }

            await message.react('✅').catch(() => {});

            const correct = content === QUESTIONS[session.quizIndex].answer;
            session.quizAnswers.push({
                question: QUESTIONS[session.quizIndex].question,
                given: content.toUpperCase(),
                correct: QUESTIONS[session.quizIndex].answer.toUpperCase(),
                passed: correct
            });

            session.quizIndex++;

            if (session.quizIndex < QUESTIONS.length) {
                const resultEmbed = new EmbedBuilder()
                    .setDescription(correct ? '✅ Correct!' : `❌ Incorrect. The correct answer was **${QUESTIONS[session.quizIndex - 1].answer.toUpperCase()}**.`)
                    .setColor(correct ? 'Green' : 'Red');
                await message.author.send({ embeds: [resultEmbed] });
                setTimeout(async () => {
                    await message.author.send({ embeds: [buildQuestionEmbed(session.quizIndex)] });
                }, 1000);
            } else {
                const score = session.quizAnswers.filter(a => a.passed).length;
                const passed = score >= 6;

                const resultEmbed = new EmbedBuilder()
                    .setTitle(passed ? '🎉 Training Complete!' : '📋 Training Complete')
                    .setDescription(passed
                        ? `Congratulations! You passed the quiz with a score of **${score}/8**! 🎉\nWelcome to the PR team — you're all set!`
                        : `You scored **${score}/8**. Don't worry, a member of PR Leadership will follow up with you shortly!`)
                    .setColor(passed ? 'Green' : 'Orange')
                    .setTimestamp();

                await message.author.send({ embeds: [resultEmbed] });

                if (logChannel) {
                    const breakdown = session.quizAnswers.map((a, i) =>
                        `**Q${i + 1}:** ${a.passed ? '✅' : '❌'} — Answered: **${a.given}** | Correct: **${a.correct}**`
                    ).join('\n');

                    const logEmbed = new EmbedBuilder()
                        .setTitle('📋 Training Quiz Results')
                        .setColor(passed ? 'Green' : 'Orange')
                        .addFields(
                            { name: 'Trainee', value: `<@${userId}>`, inline: true },
                            { name: 'Score', value: `${score}/8`, inline: true },
                            { name: 'Result', value: passed ? '✅ Passed' : '❌ Failed', inline: true },
                            { name: 'Help Requests', value: `${session.helpCount}`, inline: true },
                            { name: 'Date', value: new Date().toLocaleString(), inline: true },
                            { name: 'Question Breakdown', value: breakdown, inline: false }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] });
                }

                activeSessions.delete(userId);
                helpMessages.delete(userId);
            }
        }
    },

    // Handle the resolve button
    async handleResolve(interaction, client) {
        const customId = interaction.customId;
        if (!customId.startsWith('resolve_help_')) return;

        const userId = customId.replace('resolve_help_', '');
        const session = activeSessions.get(userId);

        if (!session) {
            return interaction.reply({ content: '❌ This training session is no longer active.', ephemeral: true });
        }

        session.waitingForHelp = false;

        // Update the log message
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor('Green')
            .spliceFields(5, 1, { name: 'Status', value: `✅ Resolved by ${interaction.user.tag}`, inline: true });

        await interaction.update({ embeds: [updatedEmbed], components: [] });

        // DM the trainee they can continue
        try {
            const user = await client.users.fetch(userId);
            await user.send({
                embeds: [new EmbedBuilder()
                    .setTitle('✅ Help Resolved')
                    .setDescription('Your help request has been resolved! You can now continue your training by replying with **"done"**.')
                    .setColor('Green')
                    .setTimestamp()]
            });
        } catch (err) {
            console.error('Failed to DM trainee after resolve:', err);
        }
    }
};

function buildSectionEmbed(index) {
    const section = SECTIONS[index];
    return new EmbedBuilder()
        .setTitle(section.title)
        .setDescription(section.content)
        .setColor('Purple')
        .setFooter({ text: `Section ${index + 1} of ${SECTIONS.length} • Reply "done" when ready` })
        .setTimestamp();
}

function buildQuestionEmbed(index) {
    const q = QUESTIONS[index];
    return new EmbedBuilder()
        .setTitle(`Question ${index + 1} of ${QUESTIONS.length}`)
        .setDescription(`**${q.question}**\n\n${q.options.join('\n')}`)
        .setColor('Purple')
        .setFooter({ text: 'Reply with a, b, c, or d' })
        .setTimestamp();
}