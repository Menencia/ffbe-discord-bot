var Discord = require('discord.js');
var bot = new Discord.Client();

var _ = require('lodash');

var Redis = require('ioredis');
var redis = new Redis(process.env.REDIS_URL);

bot.on('ready', function () {
    redis.set('top current', JSON.stringify([]));
});

bot.on('message', function (message) {

    message.channel.send(message.system);

    // detect if it's a command (not count in top)
    if (message.content === '!top') {
        redis.get('top current',function(err, current) {
            /*current = JSON.parse(current);
            html = '';
            _.forEach(current, function(user) {
                html += user.name + ' : ' + user.pts + 'pts';
            });*/
            message.channel.send(current);
        });
    } else if (message.content === '!clear') {
        redis.set('top current', JSON.stringify([]));
        message.channel.send('Cleared!');
    } else {
        // LOOP !!!
        // update top
        /*redis.get('top current', function(err, current) {
            bot.sendMessage({
                to: channelID,
                message: user
            });
            bot.sendMessage({
                to: channelID,
                message: message
            });
            updateTopCurrent(current, user);
        });*/
    }
});

bot.login(process.env.BOT_TOKEN);

// FUNCTIONS //

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
            name: name,
            pts: 1,
            date: _.now()
        });
    }
    // save
    redis.set(current, JSON.stringify(current));
}