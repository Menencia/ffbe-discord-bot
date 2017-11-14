var Discord = require('discord.io');
var logger = require('winston');
var _ = require('lodash');

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
    // do nothing
});

bot.on('message', function (user, userID, channelID, message, evt) {

    // detect if it's a command (not count in top)
    if (message.substring(0, 1) == '!') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];

        args = args.splice(1);
        switch(cmd) {

            case 'ffbe top current':

                redis.get('top current',function(err, result) {
                    log(bot, channelID, result)
                });
            default:
                log(bot, channelID, "Command unknown!");
            break;
        }
    } else {
        // update top
        redis.get('top current', function(err, current) {
            log(bot, channelID, {current: current, user: user, userID, userID});
            updateTopCurrent(current, user.username);
        })
    }
});

function updateTopCurrent(current, name) {
    
    // init current
    current = current ? JSON.parse(current): [];
    
    // look for user
    var user = _.find(current, ['name', name]);
    if (user) {
        // update user
        user.pts++;
        user.date = _.now();
        // reorder
        current = _.orderBy(users, ['pts', 'date'], ['desc', 'asc']);
    } else {
        // add the user at the end
        // no need to reorder
        current.push({
            name = name,
            pts: 1,
            date: _.now()
        });
    }
    // save
    redis.set(current, JSON.stringify(current));
}

function log(bot, channelID, data) {
    bot.sendMessage({
        to: channelID,
        message: data
    });
}