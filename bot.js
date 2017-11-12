var Discord = require('discord.io');
var logger = require('winston');

var Redis = require('ioredis');
var redis = new Redis(process.env.REDIS_URL);

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize: true
});

logger.level = 'debug';

// Initialize Discord Bot
var bot = new Discord.Client({
   token: process.env.BOT_TOKEN,
   autorun: true
});

bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});

bot.on('message', function (user, userID, channelID, message, evt) {

    if (message.substring(0, 1) == '!') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];

        args = args.splice(1);
        switch(cmd) {

            case 'ping':

                redis.get('count',function(err, result) {
                    if (!result) {
                        result = 0;
                    }
                    redis.set('count', result+1);

                    bot.sendMessage({
                        to: channelID,
                        message: 'Pong! (' + (result+1) + ')'
                    });
                });
            break;
        }
    }
});