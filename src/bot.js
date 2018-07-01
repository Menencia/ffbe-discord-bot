const Discord = require('discord.js');
const _ = require('lodash');
const { CronJob } = require('cron');
const messages = require('./messages');
const helper = require('./helper');
const db = require('./database');
const Rankings = require('./rankings');

const {
  botLoginToken,
  homeChannelId,
} = require('../settings');

const bot = new Discord.Client();

const rankings = new Rankings(db, helper);

bot.on('ready', () => {
  bot.user.setStatus('idle');
});

bot.on('guildMemberAdd', (member) => {
  const channel = member.guild.channels.get(homeChannelId);
  if (!channel) {
    return;
  }

  const rawMsg = _.sample(messages);
  const msg = rawMsg.replace(new RegExp('%user', 'g'), member);
  channel.send(msg);
});

bot.on('message', (message) => {
  // ignore all bot messages
  if (message.author.bot) {
    return;
  }

  // detect if it's a command (not count in top)
  if (message.content === '/top today' && helper.isGrandsheltKing(message)) {
    helper.displayTopToday(rankings.current, bot, (html) => {
      message.channel.send(html);
    });
  } else if (message.content === '/top' && helper.isGrandsheltKing(message)) {
    helper.displayTopYesterday(rankings.last, bot, (html) => {
      message.channel.send(html);
    });
  } else if (message.content === '/update' && helper.isGrandsheltKing(message)) {
    rankings.update(bot);
  } else if (message.content === '/reset' && helper.isGrandsheltKing(message)) {
    db.reset();
  } else {
    // update top current
    rankings.updateTopCurrent(message.author);
  }
});

bot.login(botLoginToken);

// cron to update leaderboards every midnight
const job = new CronJob({
  cronTime: '0 0 * * *',
  onTick: () => {
    rankings.update(bot);
  },
  start: false,
  timeZone: 'Europe/Paris',
  runOnInit: false
});
job.start();
