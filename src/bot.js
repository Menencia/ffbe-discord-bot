const Discord = require('discord.js');
const _ = require('lodash');
const { CronJob } = require('cron');
const HTMLParser = require('fast-html-parser');
const fetch = require('node-fetch');
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

bot.on('message', async (message) => {
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
  } else if (message.content.startsWith('/unit')) {
    const originalName = message.content.split(/ (.+)/)[1];
    const formatedName = originalName.replace(' ', '-').toLowerCase();
    const url = `https://exviusdb.com/gl/units/${formatedName}`;
    const res = await fetch(url);
    const html = await res.text();

    const root = HTMLParser.parse(html);

    try {
      // NAME
      const unitName = root.querySelector('.panel-title').removeWhitespace().rawText;

      // TMR
      const tmr = root.querySelector('.unit-trust-reward-content');
      const tmrName = tmr.childNodes[1].childNodes[0].rawText;
      const tmrType = tmr.querySelector('.unit-trust-reward-heading-callout').rawText;
      const tmrDesc = tmr.querySelector('.unit-trust-reward-extra').rawText;
      message.channel.send({
        embed: {
          color: 3447003,
          title: unitName,
          url,
          fields: [{
            name: 'TMR',
            value: `${tmrName} (${tmrType})`
          },
          {
            name: 'Description',
            value: tmrDesc
          }]
        }
      });
    } catch (e) {
      message.channel.send(`No unit found for \`${originalName}\``);
    }
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
