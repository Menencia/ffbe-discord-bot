const Discord = require('discord.js');
const _ = require('lodash');
const Redis = require('ioredis');
const { CronJob } = require('cron');
const moment = require('moment');
const AsciiTable = require('ascii-table');

const {
  adminRoleId,
  botChannelId,
  botLoginToken,
  guildId,
  homeChannelId,
  redisUrl,
  top10RoleId
} = require('../settings');

const messages = require('./messages');

/*

_/|_/|/_ _    _/. __  _  _ _/  /_ _ _/_
/  / /_//_' /_//_\/_ /_///_/  /_//_//

*/

/** CONFIGURATION -------------------------- */
// edit these next variables

const MSG_DELAY = 60; // in seconds
const DATE_LOCALE = 'fr';
const CRON_FREQUENCE = '0 0 * * *';
const CRON_TIMEZONE = 'Europe/Paris';
const RANKING_UPDATED = 'Le classement a été mis à jour !';
const NO_RANKINGS_YET = "Aucun classement disponible pour l'instant. Attendez minuit !";
const LABEL_POS = '#';
const LABEL_PSEUDO = 'Pseudo';
const LABEL_PTS = 'Pts';
const LABEL_LAST_MSG = 'D. msg';

/** ***************************************** */
// please do not edit below,
// unless you know what you're doing

moment.locale(DATE_LOCALE);

const redis = new Redis(redisUrl);
const bot = new Discord.Client();
let lock = false;

function resetTopCurrent() {
  redis.set('top-current', JSON.stringify([]));
}

function addPosToLast(tmp, last) {
  _.forEach(tmp, (user, idx) => {
    const found = _.findIndex(last, { id: user.id });
    if (found > -1) {
      const diff = found - idx;
      if (diff === 0) {
        user.pos = '';
      } else if (diff > 0) {
        user.pos = `+${diff}`;
      } else if (diff < 0) {
        user.pos = diff;
      }
    }
  });
}

function buildTopLast(data, callback) {
  let oldUsers = [];
  let newUsers = [];
  redis.get('top-last', (err, last) => {
    const tmp = [];
    _.forEach(data, (user) => {
      tmp.push({
        id: user.id,
        name: user.name,
        pts: user.pts,
        pos: 'N'
      });
    });
    const tmpIds = _.map(tmp, 'id');
    if (last) {
      last = JSON.parse(last);
      addPosToLast(tmp, last);
      const lastIds = _.map(last, 'id');
      oldUsers = _.difference(lastIds, tmpIds); // top-last={ancien top-last} et tmp=[]
      newUsers = _.difference(tmpIds, lastIds);
    } else {
      newUsers = tmpIds;
    }
    redis.set('top-last', JSON.stringify(tmp));
    callback(oldUsers, newUsers);
  });
}

function getDisplayName(user) {
  const guild = bot.guilds.get(guildId);
  if (guild && guild.available) {
    const u = guild.members.get(user.id);
    return (u ? u.displayName : user.name);
  }
  return user.name;
}

function ffbeTopYesterday(callback) {
  redis.get('top-last', (err, data) => {
    let html;
    if (data) {
      data = JSON.parse(data);
      // prettify
      const date = moment().subtract(1, 'day').add(1, 'hour').format('LL');
      const table = new AsciiTable();
      table
        .setBorder(' ', '-', ' ', ' ')
        .setTitle(`📋 TOP (${date})`)
        .setHeading(LABEL_POS, '', LABEL_PSEUDO, LABEL_PTS)
        .setHeadingAlign(AsciiTable.RIGHT, 0)
        .setHeadingAlign(AsciiTable.LEFT, 2);
      _.forEach(data, (user, idx) => {
        const displayName = getDisplayName(user);
        table.addRow(idx + 1, user.pos, displayName, user.pts);
      });
      table.setAlign(1, AsciiTable.RIGHT);

      html = `\`\`\`js\n${table}\n\`\`\``;
    } else {
      html = NO_RANKINGS_YET;
    }
    return callback(html);
  });
}

function ffbeTopUpdate() {
  if (lock) {
    console.log('Warning: blocked illegal update!');
    return;
  }
  lock = true;
  redis.get('top-current', (err, data) => {
    console.log('top current retrived!');
    resetTopCurrent();
    data = JSON.parse(data);
    // pick 10 first
    data = _.take(data, 10);
    buildTopLast(data, (oldUsers, newUsers) => {
      console.log('top last built!');
      const channel = bot.channels.get(botChannelId);
      channel.send(RANKING_UPDATED);
      ffbeTopYesterday((html) => {
        channel.send(html);
      });
      const guild = bot.guilds.get(guildId);
      if (guild && guild.available) {
        _.forEach(oldUsers, (userId) => {
          guild.members.get(userId).removeRole(top10RoleId);
        });
        _.forEach(newUsers, (userId) => {
          guild.members.get(userId).addRole(top10RoleId);
        });
      }
      lock = false;
      console.log('Top updated!');
    });
  });
}

function isGrandsheltKing(message) {
  return message.member.roles.has(adminRoleId);
}

function ffbeTopToday(callback) {
  redis.get('top-current', (err, data) => {
    data = JSON.parse(data);
    // pick 10 first
    data = _.take(data, 10);
    // prettify
    const date = moment().add(1, 'hour').format('LT');
    const table = new AsciiTable();
    table
      .setBorder(' ', '-', ' ', ' ')
      .setTitle(`📋 TOP @ ${date}`)
      .setHeading(LABEL_POS, LABEL_PSEUDO, LABEL_PTS, LABEL_LAST_MSG)
      .setHeadingAlign(AsciiTable.RIGHT, 0)
      .setHeadingAlign(AsciiTable.LEFT, 1);
    _.forEach(data, (user, idx) => {
      const displayName = getDisplayName(user);
      const d = moment(user.date).add(1, 'hour').format('LT');
      table.addRow(idx + 1, displayName, user.pts, d);
    });

    const html = `\`\`\`js\n${table}\n\`\`\``;
    return callback(html);
  });
}

function updateTopCurrent(current, author) {
  // init current
  current = JSON.parse(current);

  // look for user
  const user = _.find(current, ['id', author.id]);
  if (user) {
    // spam checker
    if (_.now() - user.date < MSG_DELAY * 1000) {
      return;
    }
    // update user
    user.pts += 1;
    user.date = _.now();
    // reorder
    current = _.orderBy(current, ['pts', 'date'], ['desc', 'asc']);
  } else {
    // add the user at the end
    // no need to reorder
    current.push({
      id: author.id,
      name: author.username,
      pts: 1,
      date: _.now()
    });
  }
  // save
  redis.set('top-current', JSON.stringify(current));
}

bot.on('ready', () => {
  redis.get('top-current', (err, data) => {
    if (!data) {
      resetTopCurrent();
    }
  });
  const job = new CronJob(
    CRON_FREQUENCE,
    _.throttle(ffbeTopUpdate, 2000, { leading: true, trailing: false }),
    null,
    false,
    CRON_TIMEZONE
  );
  job.start();
});

bot.on('guildMemberAdd', (guildUser) => {
  const channel = guildUser.guild.channels.get(homeChannelId);
  if (channel) {
    const rawMsg = _.sample(messages);
    const name = `**${guildUser.displayName}**`;
    const msg = rawMsg.replace(new RegExp('%user', 'g'), name);
    channel.send(msg);
  }
});

bot.on('message', (message) => {
  // accept only on bot's server
  if (message.channel.guild.id !== guildId) {
    return;
  }
  // detect if it's a command (not count in top)
  if (message.content === '!top today' && isGrandsheltKing(message)) {
    ffbeTopToday((html) => {
      message.channel.send(html);
    });
  } else if (message.content === '!top' && isGrandsheltKing(message)) {
    ffbeTopYesterday((html) => {
      message.channel.send(html);
    });
  } else if (message.content === '!test' && isGrandsheltKing(message)) {
    redis.get('top-last', (err, data) => {
      console.log(data);
    });
  } else if (!message.author.bot) {
    // update top current
    redis.get('top-current', (err, data) => {
      updateTopCurrent(data, message.author);
    });
  }
});

bot.login(botLoginToken);
