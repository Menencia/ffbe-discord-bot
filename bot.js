var Discord = require('discord.js');
var bot = new Discord.Client();

var _ = require('lodash');

var Redis = require('ioredis');
var redis = new Redis(process.env.REDIS_URL);

var CronJob = require('cron').CronJob;

var moment = require('moment');
moment.locale('fr');

var AsciiTable = require('ascii-table');

var GUILD_FFBE = '185745050217611264';
var CHANNEL_FFBE = '380036130864758785';
var ROLE_ADMIN = '376143187569410057';
var ROLE_GUARDIANS = '379255305009102848';

bot.on('ready', function () {
    redis.get('top-current', function(err, data) {
        if (!data) {
            resetTopCurrent();        
        }
    });
    new CronJob('0 0 * * *', function() {
        ffbeTopUpdate();
    }, null, true, 'Europe/Paris');
});

bot.on('message', function (message) {

    // detect if it's a command (not count in top)
    if (message.content === '!top today' && isGrandsheltKing(message)) {
        ffbeTopToday(function(html) {
            message.channel.send(html);
        });
    } else if (message.content === '!top' && isGrandsheltKing(message)) {
        ffbeTopYesterday(function(html) {
            message.channel.send(html);
        });
    }
    else if (!message.author.bot) {
        // update top current
        redis.get('top-current', function(err, data) {
            updateTopCurrent(data, message.author);
        });
    }
});

bot.login(process.env.BOT_TOKEN);

// FUNCTIONS //

function isGrandsheltKing(message) {
    return message.member.roles.has(ROLE_ADMIN);
}

function ffbeTopUpdate() {
    redis.get('top-current',function(err, data) {
        resetTopCurrent();
        data = JSON.parse(data);
        // pick 10 first
        data = _.take(data, 10);
        buildTopLast(data, function(oldUsers, newUsers) {
            var channel = bot.channels.get(CHANNEL_FFBE);
            channel.send('Le classement a été mis à jour !');
            ffbeTopYesterday(function(html) {
                channel.send(html);
            });
            var guild = bot.guilds.get(GUILD_FFBE);
            if (guild && guild.available) {
                _.forEach(oldUsers, function(userId) {
                    guild.members.get(userId).removeRole(ROLE_GUARDIANS);
                });
                _.forEach(newUsers, function(userId) {
                    guild.members.get(userId).addRole(ROLE_GUARDIANS);
                });
            }
        });
    });
}

function getDisplayName(user) {
    var guild = bot.guilds.get(GUILD_FFBE);
    if (guild && guild.available) {
        var u = guild.members.get(user.id);
        return (u ? u.displayName : user.name);
    } else {
        return user.name;
    }
}

function ffbeTopToday(callback) {
    redis.get('top-current',function(err, data) {
        data = JSON.parse(data);
        // pick 10 first
        data = _.take(data, 10);
        // prettify
        var date = moment().add(1, 'hour').format('LT');
        var table = new AsciiTable();
        table
            .setBorder(' ', '-', ' ', ' ')
            .setTitle('📋 TOP @ ' + date)
            .setHeading('#', 'Pseudo', 'Pts', 'D. msg')
            .setHeadingAlign(AsciiTable.RIGHT, 0)
            .setHeadingAlign(AsciiTable.LEFT, 1);
        _.forEach(data, function(user, idx) {
            var displayName = getDisplayName(user);
            var date = moment(user.date).add(1, 'hour').format('LT');
            table.addRow(idx+1, displayName, user.pts, date);
        });
        var html = '```js' + "\n" + table + "\n" + '```';
        return callback(html);
    });
}

function ffbeTopYesterday(callback) {
    redis.get('top-last',function(err, data) {
        if (data) {
            data = JSON.parse(data);
            // prettify
            var date = moment().subtract(1, 'day').add(1, 'hour').format('LL');
            var table = new AsciiTable();
            table
                .setBorder(' ', '-', ' ', ' ')
                .setTitle('📋 TOP (' + date + ')')
                .setHeading('#', '', 'Pseudo', 'Pts')
                .setHeadingAlign(AsciiTable.RIGHT, 0)
                .setHeadingAlign(AsciiTable.LEFT, 2);
            _.forEach(data, function(user, idx) {
                var displayName = getDisplayName(user);
                table.addRow(idx+1, user.pos, displayName, user.pts);
            });
            table.setAlign(1, AsciiTable.RIGHT);

            html = '```js' + "\n" + table + "\n" + '```';
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
            var diff = found - idx;
            if (diff === 0) {
                user.pos = '';
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

/** unused function */
function resetTopLast() {
    redis.del('top-last');
}