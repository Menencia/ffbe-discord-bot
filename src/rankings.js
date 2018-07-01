const _ = require('lodash');

const { botChannelId, guildId, top10RoleId } = require('../settings');

// labels
const LABEL_RANKING_UPDATED = 'Le classement a été mis à jour !';

class Rankings {
  constructor(db, helper) {
    this.helper = helper;
    this.db = db;
    this.lock = false;
    this.resolves = [];
    this.init();
  }

  async init() {
    let data;
    // load "current" list
    data = await this.db.getTopCurrent();
    if (!data) {
      this.db.setTopCurrent([]);
      this.current = [];
    } else {
      this.current = data;
    }
    // load "last" list
    data = await this.db.getTopLast();
    if (!data) {
      this.db.setTopLast([]);
      this.last = [];
    } else {
      this.last = data;
    }
  }

  // wait for lock=true
  ready() {
    return new Promise((resolve) => {
      if (!this.lock) {
        resolve();
      } else {
        this.resolves.push(resolve);
      }
    });
  }

  async updateTopCurrent(author) {
    // wait for lock=true
    await this.ready();

    // look for user
    const user = this.current.find(e => e.id === author.id);
    if (user) {
      // spam checker
      if (_.now() - user.date < 60 * 1000) {
        return;
      }
      // update user
      user.pts += 1;
      user.date = _.now();
      // reorder
      this.current = _.orderBy(this.current, ['pts', 'date'], ['desc', 'asc']);
    } else {
      // add the user at the end
      // no need to reorder
      this.current.push({
        id: author.id,
        name: author.username,
        pts: 1,
        date: _.now()
      });
    }
    // save "current" list
    this.db.setTopCurrent(this.current);
  }

  update(bot) {
    if (this.lock) {
      console.log('Warning: blocked illegal update!');
      return;
    }

    // lock rankings means all others action are delayed
    this.lock = true;

    // update "last" list
    const { oldUsers, newUsers } = this.buildTopLast();

    // display "last" list on bot channel
    const channel = bot.channels.get(botChannelId);
    channel.send(LABEL_RANKING_UPDATED);
    this.helper.displayTopYesterday(this.last, bot, (html) => {
      channel.send(html);
    });

    // update top10 role
    const guild = bot.guilds.get(guildId);
    if (guild && guild.available) {
      oldUsers.forEach((userId) => {
        guild.members.get(userId).removeRole(top10RoleId);
      });
      newUsers.forEach((userId) => {
        guild.members.get(userId).addRole(top10RoleId);
      });
    }

    // update&save empty "current" list
    this.current = [];
    this.db.setTopCurrent([]);

    // remove lock
    this.lock = false;

    // resolve promises if any
    this.resolves.forEach(resolve => resolve());
  }

  buildTopLast() {
    let oldUsers = [];
    let newUsers = [];
    const current = _.take(this.current, 10);
    const { last } = this;
    const tmp = [];
    current.forEach((user) => {
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

    // update&save "last" list
    this.last = tmp;
    this.db.setTopLast(tmp);

    return { oldUsers, newUsers };
  }

  static addPosToLast(tmp, last) {
    tmp.forEach((user, idx) => {
      const found = last.findIndex(e => e.id === user.id);
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
