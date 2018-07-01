const { adminRoleId } = require('../settings');

class Helper {
  static isGrandsheltKing(message) {
    return message.member.roles.has(adminRoleId);
  }
}

module.exports = Helper;
