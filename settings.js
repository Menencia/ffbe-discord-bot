const settings = {
  botLoginToken: process.env.BOT_TOKEN,
  guildId: process.env.GUILD_ID,
  homeChannelId: process.env.HOME_CHANNEL_ID,
  botChannelId: process.env.BOT_CHANNEL_ID,
  adminRoleId: process.env.ADMIN_ROLE_ID,
  top10RoleId: process.env.TOP10_ROLE_ID,
  redisUrl: process.env.REDIS_URL
};
module.exports = settings;
