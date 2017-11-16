var Discord = require('discord.js');
var bot = new Discord.Client();

var _ = require('lodash');

var Redis = require('ioredis');
var redis = new Redis(process.env.REDIS_URL);

var CronJob = require('cron').CronJob;
new CronJob('0 0 * * *', function() {
    redis.get('top-current',function(err, data) {
        resetTopCurrent();
        data = JSON.parse(data);
        // pick 10 first
        data = _.take(data, 10);
        buildTopLast(data, function(oldUsers, newUsers) {
            // "ffbe-bot" channel
            var channel = bot.channels.get('380036130864758785');
            channel.send('Le classement a été mis à jour !');
            ffbeTopYesterday(function(html) {
                channel.send(html);
            });
            // 'FFBraveExvius (FR)' server
            var guild = bot.guilds.get('185745050217611264');
            if (guild && guild.available) {
                // 'Veilleurs' role
                var role = guild.roles.get('379255305009102848');
                if (role) {
                    _.forEach(oldUsers, function(userId) {
                        guild.members.get(userId).removeRole(role);
                    });
                    _.forEach(newUsers, function(userId) {
                        guild.members.get(userId).addRole(role);
                    });
                }
            }
        });
    });
}, null, true, 'Europe/Paris');

// test start
console.log('test started');
console.log(bot);
var guild = bot.guilds.get('185745050217611264');
if (guild && guild.available) {
    console.log('guild found');
    var role = guild.roles.get('379255305009102848');
    var t = ['113252560655130624'];
    _.forEach(t, function(userId) {
        console.log('apply role');
        guild.members.get(userId).addRole(role);
    });
}
// test end

bot.on('ready', function () {
    redis.get('top-current', function(err, data) {
        if (!data) {
            resetTopCurrent();        
        }
    })
});

bot.on('message', function (message) {

    // detect if it's a command (not count in top)
    if (message.content === '!top today') {
        redis.get('top-current',function(err, data) {
            data = JSON.parse(data);
            // pick 10 first
            data = _.take(data, 10);
            // prettify
            var html = ' ' + "\n" + "** TOP (aujourd'hui) **" + "\n";
            _.forEach(data, function(user, idx) {
                html += '[' + (idx+1) + '] ' + user.name + ' (' + user.pts + 'pts)';
                if (user.id) {
                    html += ' <' + user.id + '>';
                }
                html += "\n";
            });
            message.channel.send(html);
        });
    } else if (message.content === '!top') {
        ffbeTopYesterday(function(html) {
            message.channel.send(html);
        });
    } else if (message.content === '!top clear') {
        // 'FFBraveExvius (FR)' server
        var guild = bot.guilds.get('185745050217611264');
        if (guild && guild.available) {
            // 'Roi de Grandshelt' role
            var role = guild.roles.get('376143187569410057');
            if (message.member.roles.has(role.id)) {
                resetTopLast();
                message.channel.send('Le classement de hier a été effacé !');
            } else {
                message.channel.send("Vous n'avez pas les droits !");
            }
        }
    } else if (!message.author.bot) {
        // update top current
        redis.get('top-current', function(err, data) {
            updateTopCurrent(data, message.author);
        });
    }
});

bot.login(process.env.BOT_TOKEN);

// FUNCTIONS //

function ffbeTopYesterday(callback) {
    redis.get('top-last',function(err, data) {
        if (data) {
            data = JSON.parse(data);
            // prettify
            var html = ' ' + "\n" + '** TOP (hier) **' + "\n";
            _.forEach(data, function(user, idx) {
                html += '[' + (idx+1) + '](' + user.pos + ') ' + user.name + ' (' + user.pts + 'pts)';
                html += "\n";
            });
        } else {
            var html = "Aucun classement disponible pour l'instant. Attendez minuit !";
        }
        return callback(html);
    });
}

function updateTopCurrent(current, author) {
    
    // init current
    current = JSON.parse(current);
    
    // look for user
    var user = _.find(current, ['id', author.id]);
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
            id: author.id,
            name: author.username,
            pts: 1,
            date: _.now()
        });
    }
    // save
    redis.set('top-current', JSON.stringify(current));
}

function buildTopLast(data, callback) {
    var oldUsers = []; 
    var newUsers = [];
    redis.get('top-last', function(err, last) {
        var tmp = [];
        _.forEach(data, function(user) {
            tmp.push({
                id: user.id,
                name: user.name,
                pts: user.pts,
                pos: 'N'
            });
        });
        if (last) {
            last = JSON.parse(last);
            addPosToLast(tmp, last);
            var tmpIds = _.map(tmp, 'id');
            var lastIds = _.map(last, 'id');
            oldUsers = _.difference(lastIds, tmpIds);
            newUsers = _.difference(tmpIds, lastIds);
        } else {
            newUsers = tmpIds;
        }
        redis.set('top-last', JSON.stringify(tmp));
        callback(oldUsers, newUsers);
    })
}

function addPosToLast(tmp, last) {
    _.forEach(tmp, function(user, idx){
        var found = _.findIndex(last, {id: user.id});
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