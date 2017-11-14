var Discord = require('discord.js');
var bot = new Discord.Client();

var _ = require('lodash');

var Redis = require('ioredis');
var redis = new Redis(process.env.REDIS_URL);

bot.on('ready', function () {
    redis.get('top-current', function(err, current) {
        if (!current) {
            redis.set('top-current', JSON.stringify([]));        
        }
    })
});

bot.on('message', function (message) {

    // detect if it's a command (not count in top)
    if (message.content === '!ffbetop') {
        redis.get('top-current',function(err, current) {
            current = JSON.parse(current);
            // pick 10 first
            current = _.take(current, 10);
            // prettify
            var html = ' ' + "\n" + '** TOP **' + "\n";
            _.forEach(current, function(user, idx) {
                html += '[' + (idx+1) + '] ' + user.name + ' (' + user.pts + 'pts)' + "\n";
            });
            message.channel.send(html);
        });
    } else if (message.content === '!ffbeclear') {
        redis.set('top-current', JSON.stringify([]));
        message.channel.send('Cleared!');
    } else if (!message.author.bot) {
        // LOOP !!!
        // update top
        redis.get('top-current', function(err, current) {
            updateTopCurrent(current, message.author.username);
        });
    }
});

bot.login(process.env.BOT_TOKEN);

// FUNCTIONS //

function updateTopCurrent(current, name) {
    
    // init current
    current = JSON.parse(current);
    
    // look for user
    var user = _.find(current, ['name', name]);
    if (user) {
        // spam checker
        if (_.now() - user.date < 10*1000) {
            return;
        }
        // update user
        user.pts++;
        user.date = _.now();
        // reorder
        current = _.orderBy(current, ['pts', 'date'], ['desc', 'asc']);
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
    redis.set('top-current', JSON.stringify(current));
}