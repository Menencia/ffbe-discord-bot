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
var CHANNEL_HOME = '185745050217611264';
var CHANNEL_FFBE = '380036130864758785';
var ROLE_ADMIN = '376143187569410057';
var ROLE_GUARDIANS = '379255305009102848';

var lock = false;

var messages = [
    "On ne présente plus %user, 4* natif game-breaker. Faites de la place svp.",
    "Le grand %user vient d'arriver !",
    "Bienvenue, %user. On espère que tu as apporté de la pizza.",
    "C'est %user ! Loué soit le soleil ! o/",
    "C'est un chocobo ! C'est un aéronef ! J'ai rien dit, c'est juste %user.",
    "%user a traversé tout le continent de Lapis pour venir jusqu'ici !",
    "%user, un habitant de Paladia, a rejoint notre serveur ! Soyez pas timides :)",
    "Bienvenue, %user. Nous vous attendions ( ͡° ͜ʖ ͡°)",
    "Hé ! Écoutez ! %user nous a rejoint ! Il apporte la chance avec lui. C'est le moment de puller !",
    "Oh mon dieu ! %user est là. Tout le monde, faites semblant d'être occupés !",
    "%user est arrivé(e). La fête est terminée.",
    "Bienvenue %user. Laissez votre vie sociale près de la porte.",
    "Un %user de rang supérieur a spawn dans le serveur.",
    "Tenez-vous bien. %user a rejoint le serveur.",
    "%user est ici pour utiliser sa LB et tous nous sauver ! Hourra !",
    "%user a rejoint le serveur ! Et il a plein de tickets 10+1 à distribuer !",
    "%user est ici, comme la prophétie l'avait annoncé.",
    "Swoooosh. %user vient juste d’atterrir. Il fait 23° dehors et c'est plutôt ensoleillé.",
    "Les roses sont rouges, les violettes sont bleues, %user a rejoint ce monde d'illusions.",
    "%user vient d’arriver. Il est trop OP, il faut le nerf.",
    "Un cristal arc-en-ciel descend ! OMG c'est %user !",
    "Un %user sauvage apparaît. Sa TMR est excellente. Attrapez-le !"
];

bot.on('ready', function () {
    redis.get('top-current', function(err, data) {
        if (!data) {
            resetTopCurrent();        
        }
    });
    new CronJob(
        '0 0 * * *', 
        _.throttle(ffbeTopUpdate, 2000, {leading:true, trailing:false}), 
        null, 
        true, 
        'Europe/Paris'
    )
});

bot.on('guildMemberAdd', function(guildUser) {
    var channel = guildUser.guild.channels.get(CHANNEL_HOME);
    if (channel) {
        var rawMsg = _.sample(messages);
        var name = '**' + guildUser.displayName + '**';
        var msg = rawMsg.replace(new RegExp('%user', 'g'), name);
        channel.send(msg);
    }
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
    } else if (message.content === '!test' && isGrandsheltKing(message)) {
        message.channel.send('Hello to ' + message.author.toString().substring(1));
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
    if (lock) {
        console.log('Warning: blocked illegal update!');
        return;
    }
    lock = true;
    redis.get('top-current',function(err, data) {
        console.log('top current retrived!');
        resetTopCurrent();
        data = JSON.parse(data);
        // pick 10 first
        data = _.take(data, 10);
        buildTopLast(data, function(oldUsers, newUsers) {
            console.log('top last built!');
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
            lock = false;
            console.log('Top updated!');
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
        if (_.now() - user.date < 60*1000) {
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
            oldUsers = _.difference(lastIds, tmpIds); // top-last={ancien top-last} et tmp=[]
            newUsers = _.difference(tmpIds, lastIds);
        } else {
            newUsers = tmpIds;
        }
        redis.set('top-last', JSON.stringify(tmp));
        callback(oldUsers, newUsers);
    });
}

function addPosToLast(tmp, last) {
    _.forEach(tmp, function(user, idx){
        var found = _.findIndex(last, {id: user.id});
        if (found > -1) {
            var diff = found - idx;
            if (diff === 0) {
                user.pos = '';
            } else if (diff > 0) {
                user.pos = '+' + diff;
            } else if (diff < 0) {
                user.pos = diff;
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