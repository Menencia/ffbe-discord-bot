const moment = require('moment');
const AsciiTable = require('ascii-table');
const _ = require('lodash');

const { adminRoleId, guildId } = require('../settings');

// labels
const LABEL_NO_RANKINGS_YET = "Aucun classement disponible pour l'instant. Attendez minuit !";
const LABEL_POS = '#';
const LABEL_PSEUDO = 'Pseudo';
const LABEL_PTS = 'Pts';
const LABEL_LAST_MSG = 'D. msg';

moment.locale('fr');

class Helper {
  static isGrandsheltKing(message) {
    return message.member.roles.has(adminRoleId);
  }

  static getDisplayName(bot, user) {
    const guild = bot.guilds.get(guildId);
    if (guild && guild.available) {
      const u = guild.members.get(user.id);
      return (u ? u.displayName : user.name);
    }
    return user.name;
  }

  static displayTopYesterday(bot, db, callback) {
    db.getTopLast().then((data) => {
      let html;
      if (data && data.length > 0) {
        // prettify
        const date = moment().subtract(1, 'day').format('LL');
        const table = new AsciiTable();
        table
          .setBorder(' ', '-', ' ', ' ')
          .setTitle(`📋 TOP (${date})`)
          .setHeading(LABEL_POS, '', LABEL_PSEUDO, LABEL_PTS)
          .setHeadingAlign(AsciiTable.RIGHT, 0)
          .setHeadingAlign(AsciiTable.LEFT, 2);
        _.forEach(data, (user, idx) => {
          const displayName = Helper.getDisplayName(bot, user);
          table.addRow(idx + 1, user.pos, displayName, user.pts);
        });
        table.setAlign(1, AsciiTable.RIGHT);

        html = `\`\`\`js\n${table}\n\`\`\``;
      } else {
        html = LABEL_NO_RANKINGS_YET;
      }
      return callback(html);
    });
  }

  static displayTopToday(bot, db, callback) {
    db.getTopCurrent().then((data) => {
      let html;
      if (data && data.length > 0) {
        // pick 10 first
        data = _.take(data, 10);
        // prettify
        const date = moment().format('LT');
        const table = new AsciiTable();
        table
          .setBorder(' ', '-', ' ', ' ')
          .setTitle(`📋 TOP @ ${date}`)
          .setHeading(LABEL_POS, LABEL_PSEUDO, LABEL_PTS, LABEL_LAST_MSG)
          .setHeadingAlign(AsciiTable.RIGHT, 0)
          .setHeadingAlign(AsciiTable.LEFT, 1);
        _.forEach(data, (user, idx) => {
          const displayName = Helper.getDisplayName(bot, user);
          const d = moment(user.date).format('LT');
          table.addRow(idx + 1, displayName, user.pts, d);
        });

        html = `\`\`\`js\n${table}\n\`\`\``;
      } else {
        html = LABEL_NO_RANKINGS_YET;
      }
      return callback(html);
    });
  }
}

module.exports = Helper;
