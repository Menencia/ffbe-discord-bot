const Redis = require('ioredis');
const { redisUrl } = require('../settings');

const redis = new Redis(redisUrl);

export default class Database {
  static getTopCurrent() {
    return Database.get('top-current');
  }

  static setTopCurrent(data) {
    Database.set('top-current', data);
  }

  static getTopLast() {
    return Database.get('top-last');
  }

  static setTopLast(data) {
    Database.set('top-last', data);
  }

  static get(field) {
    return new Promise((resolve, reject) => redis.get(field, (err, data) => {
      if (err) {
        reject(err);
      }
      resolve(JSON.parse(data));
    }));
  }

  static set(field, data) {
    redis.set(field, JSON.stringify(data));
  }
}
