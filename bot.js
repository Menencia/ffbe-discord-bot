var Discord = require('discord.js');
var bot = new Discord.Client();

var _ = require('lodash');

var Redis = require('ioredis');
var redis = new Redis(process.env.REDIS_URL);

var CronJob = require('cron').CronJob;
new CronJob('0 0 * * *', function() {
    try {
        redis.get('top-current',function(err, data) {
            resetTopCurrent();
            data = JSON.parse(data);
            // pick 10 first
            data = _.take(data, 10);
            buildTopLast(data, function() {
                bot.channels.get('380036130864758785').send('Le classement a été mis à jour !');   
            });
        });
    } catch(e) {
        console.log(e);
    }
}, null, true, 'Europe/Paris');

bot.on('ready', function () {
    redis.get('top-current', function(err, data) {
        if (!data) {
            resetTopCurrent();        
        }
    })
});

bot.on('message', function (message) {

    // detect if it's a command (not count in top)
    if (message.content === '!ffbe top today') {
        redis.get('top-current',function(err, data) {
            data = JSON.parse(data);
            // pick 10 first
            data = _.take(data, 10);
            // prettify
            var html = ' ' + "\n" + "** TOP (aujourd'hui) **" + "\n";
            _.forEach(data, function(user, idx) {
                html += '[' + (idx+1) + '] ' + user.name + ' (' + user.pts + 'pts)' + "\n";
            });
            message.channel.send(html);
        });
    } else if (message.content === '!ffbe top yesterday') {
        redis.get('top-last',function(err, data) {
            if (data) {
                data = JSON.parse(data);
                // prettify
                var html = ' ' + "\n" + '** TOP (hier) **' + "\n";
                _.forEach(data, function(user, idx) {
                    html += '[' + (idx+1) + '](' + user.pos + ') ' + user.name + ' (' + user.pts + 'pts)' + "\n";
                });
            } else {
                var html = "Aucun classement disponible pour l'instant. Attendez minuit !";
            }
            message.channel.send(html);
        
        });
    } else if (message.content === '!ffbecurrentclear') {
        resetTopCurrent();
        message.channel.send("TOP (aujourd'hui) effacé !");
    } else if (message.content === '!ffbelastclear') {
        resetTopLast();
        message.channel.send('TOP (hier) effacé !');
    } else if (!message.author.bot) {
        // update top
        redis.get('top-current', function(err, data) {
            updateTopCurrent(data, message.author.username);
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

function buildTopLast(data, cb) {
    redis.get('top-last', function(err, last) {
        var tmp = [];
        _.forEach(data, function(user) {
            tmp.push({
                name: user.name,
                pts: user.pts,
                pos: 'N'
            });
        });
        if (last) {
            last = JSON.parse(last);
            addPosToLast(tmp, last);
        }
        redis.set('top-last', JSON.stringify(tmp));
        cb();
    })
}

function addPosToLast(tmp, last) {
    _.forEach(tmp, function(user, idx){
        var found = _.findIndex(last, {name: user.name});
        if (found > -1) {
            var diff = idx - found;
            if (diff === 0) {
                user.pos = '=';
            } else if (diff > 0) {
                user.pos = diff;
            } else if (diff < 0) {
                user.pos = '+' + diff;
            }
        }
    });
}

function resetTopCurrent() {
    redis.set('top-current', JSON.stringify([]));
}

function resetTopLast() {
    redis.del('top-last');
}