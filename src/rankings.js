const _ = require('lodash');

const { botChannelId, guildId, top10RoleId } = require('../settings');

// labels
const LABEL_RANKING_UPDATED = 'Le classement a été mis à jour !';

class Rankings {
  constructor(db, helper) {
    this.helper = helper;
    this.db = db;
    this.lock = false;
    this.init();
  }

  async init() {
    const data = await this.db.getTopCurrent();
    if (!data) {
      this.db.setTopCurrent([]);
      this.list = [];
    } else {
      this.list = data;
    }
  }

  updateTopCurrent(current, author) {
    // @todo handle this on constructor
    if (!current) {
      current = [];
    }
    // look for user
    const user = _.find(current, ['id', author.id]);
    if (user) {
      // spam checker
      if (_.now() - user.date < 60 * 1000) {
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
    this.db.setTopCurrent(current);
  }

  update(bot) {
    if (this.lock) {
      console.log('Warning: blocked illegal update!');
      return;
    }
    this.lock = true;
    this.db.getTopCurrent().then((data) => {
      console.log('top current retrieved!');
      this.db.setTopCurrent([]);
      // pick 10 first
      data = _.take(data, 10);
      this.buildTopLast(data, (oldUsers, newUsers) => {
        console.log('top last built!');
        const channel = bot.channels.get(botChannelId);
        channel.send(LABEL_RANKING_UPDATED);
        this.helper.displayTopYesterday(bot, this.db, (html) => {
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
        this.lock = false;
        console.log('Top updated!');
      });
    });
  }

  buildTopLast(data, callback) {
    let oldUsers = [];
    let newUsers = [];
    this.db.getTopLast().then((last) => {
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
        Rankings.addPosToLast(tmp, last);
        const lastIds = _.map(last, 'id');
        oldUsers = _.difference(lastIds, tmpIds); // top-last={ancien top-last} et tmp=[]
        newUsers = _.difference(tmpIds, lastIds);
      } else {
        newUsers = tmpIds;
      }
      this.db.setTopLast(tmp);
      callback(oldUsers, newUsers);
    });
  }

  static addPosToLast(tmp, last) {
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
}

module.exports = Rankings;
