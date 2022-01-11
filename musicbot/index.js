const Discord = require("discord.js");
const { prefix, token } = require("./config.json");
const ytdl = require("ytdl-core");

const client = new Discord.Client();

const queue = new Map();

client.once("ready", () => {
    console.log("Muziekbot is online!");
    client.user.setActivity("??play", { type: "LISTENING" });
});

client.once("reconnecting", () => {
    console.log("Opnieuw verbinden...");
});

client.once("disconnect", () => {
    console.log("Verbinding verbroken.");
});

client.on("message", async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const serverQueue = queue.get(message.guild.id);

    if (message.content.startsWith(`${prefix}play`)) {
        if (!message.content.includes("https://www.youtube.com/" || "https://youtu.be/")) return message.reply("Je kunt alleen URL-links meegeven!");
        execute(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}stop`)) {
        stop(message, serverQueue);
        return;
    } else {
        message.reply("Je moet een geldig commando geven!");
    }
});

async function execute(message, serverQueue) {
    const args = message.content.split(" ");

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply("Je moet in een VC zitten om dit commando te kunnen gebruiken!");

    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) return message.reply("Ik heb permissies nodig om te kunnen verbinden en te kunnen spreken!");

    const songInfo = await ytdl.getInfo(args[1]);
    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
    };

    if (!serverQueue) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        };

        queue.set(message.guild.id, queueContruct);

        queueContruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueContruct.connection = connection;
            play(message.guild, queueContruct.songs[0]);
        } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err);
        }
    } else {
        serverQueue.songs.push(song);
        return message.reply(`${song.title} is toegevoegd aan de wachtrij!`);
    }
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel) return message.reply("Je moet in een VC zitten om de muziek te stoppen!");
    if (!serverQueue) return message.reply("Er is geen muziek meer die ik kan overslaan!");

    serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel) return message.reply("Je moet in een VC zitten om de muziek te stoppen!");

    if (!serverQueue) return message.reply("Er is geen muziek meer die ik kan stoppen!");

    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on("finish", () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send(`Wordt nu afgespeeld: **${song.title}**`);
}

client.login(token);

// npm i ffmpeg-static
// npm install discord.js@^12.5.3 ffmpeg fluent-ffmpeg @discordjs/opus ytdl-core --save