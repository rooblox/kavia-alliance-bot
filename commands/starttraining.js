const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const LOG_CHANNEL_ID = '1485119755206791289';
const AGE_VERIFY_LOG_CHANNEL_ID = '1500601790855647265';
const TRAINING_ROLE_ID = '1485100238715883720';

const TRAININGS = {
    basic_training: {
        name: 'Basic Training',
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
    }
};

const activeSessions = new Map();
const helpMessages = new Map();
const ageVerifyPending = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('starttraining')
        .setDescription('Start PR staff training for a user')
        .addStringOption(option =>
            option.setName('training')
                .setDescription('Select the training session')
                .setRequired(true)
                .addChoices(
                    { name: 'Basic Training', value: 'basic_training' },
                    { name: 'Intro to Mentorship', value: 'intro_to_mentorship' }
                ))
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The user to train')
                .setRequired(true)),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const trainingKey = interaction.options.getString('training');
        const user = interaction.options.getUser('member');
        const training = TRAININGS[trainingKey];

        if (!training) return await interaction.editReply('❌ Training not found.');

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

    async handleButton(interaction, client) {
        const customId = interaction.customId;
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

            // ── Check if next section is age verification ──
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

                // Set 12 hour re-ping
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
                return interaction.reply({ content: '⏳ Your help request is already pending. Please wait for it to be resolved.', ephemeral: true });
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

        // ── AGE VERIFY ACCEPT BUTTON ──
        if (customId.startsWith('ageverify_accept_')) {
            const userId = customId.replace('ageverify_accept_', '');
            const session = activeSessions.get(userId);

            if (!session) {
                return interaction.reply({ content: '❌ This training session is no longer active.', ephemeral: true });
            }

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

                // Continue to next section
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

        // ── AGE VERIFY DENY BUTTON — open modal for reason ──
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
                        .setDescription(`You have completed the quiz! A member of PR Leadership will review your results shortly.`)
                        .setColor(0x9B59B6)
                        .addFields({ name: 'Your Score', value: `${score}/${training.questions.length}`, inline: true })
                        .setTimestamp()]
                });

                if (logChannel) {
                    const breakdown = session.quizAnswers.map((a, i) =>
                        `**Q${i + 1}:** ${a.passed ? '✅' : '❌'} — Answered: **${a.given}** | Correct: **${a.correct}**`
                    ).join('\n');

                    const passFailRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`training_pass_${userId}`)
                            .setLabel('✅ Pass')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`training_fail_${userId}`)
                            .setLabel('❌ Fail')
                            .setStyle(ButtonStyle.Danger)
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
                        .setDescription(`We are so thrilled to officially welcome you to the **Kavià Café Public Relations Department**! 🎊\n\nYou have successfully completed your training and demonstrated a great understanding of your responsibilities.\n\n**What's next?**\n• You'll be given your official PR role shortly.\n• Head over to the PR server and introduce yourself!\n• Don't hesitate to reach out to PR Leadership if you ever need guidance.\n\nWe're so excited to have you on the team. Welcome aboard! ☕💜`)
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
                        .setDescription(`Thank you for completing the training, and don't be discouraged! Unfortunately you did not pass this time, but we believe in you. 💜\n\nA member of PR Leadership will be reaching out to support you before your next attempt.\n\n**Your training will now restart from the beginning.**\n\nTake your time to review each section carefully — you've got this! ☕`)
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

        // ── RESOLVE HELP BUTTON ──
        if (customId.startsWith('resolve_help_')) {
            const userId = customId.replace('resolve_help_', '');
            const session = activeSessions.get(userId);

            if (!session) {
                return interaction.reply({ content: '❌ This training session is no longer active.', ephemeral: true });
            }

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

        if (!session) {
            return interaction.reply({ content: '❌ This training session is no longer active.', ephemeral: true });
        }

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

        // ── Handle age verify submission ──
        if (session.waitingForAgeVerify) {
            const hasImage = message.attachments.size > 0 || message.content.match(/https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)/i);

            if (!hasImage) {
                await message.reply('⚠️ Please send a **screenshot or image link** for your age verification.');
                return;
            }

            const imageUrl = message.attachments.first()?.url || message.content.match(/https?:\/\/\S+/)?.[0];

            ageVerifyPending.set(message.author.id, {
                userId: message.author.id,
                imageUrl,
                submittedAt: Date.now()
            });

            const ageVerifyLogChannel = await client.channels.fetch(AGE_VERIFY_LOG_CHANNEL_ID).catch(() => null);
            if (ageVerifyLogChannel) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ageverify_accept_${message.author.id}`)
                        .setLabel('✅ Accept')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`ageverify_deny_${message.author.id}`)
                        .setLabel('❌ Deny')
                        .setStyle(ButtonStyle.Danger)
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

            return;
        }
    }
};

module.exports.activeSessions = activeSessions;
module.exports.helpMessages = helpMessages;
module.exports.ageVerifyPending = ageVerifyPending;

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
        new ButtonBuilder()
            .setCustomId(`section_done_${userId}`)
            .setLabel('✅ Done')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`section_help_${userId}`)
            .setLabel('🆘 I Need Help')
            .setStyle(ButtonStyle.Secondary)
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