---
title: "Minecraft Server in Docker: Adulting Made Easy"
slug: "minecraft_server_docker"
date: 2021-02-07T15:33:09-08:00
lastmod: 2021-02-07T15:33:09-08:00
description: "Docker makes it easy to not just get started running a minecraft server, but to run all kinds of different servers, backups to the cloud, and more."
summary: "Docker makes it easy to not just get started running a minecraft server, but to run all kinds of different servers, backups to the cloud, and more."
draft: false
---

{{< img src="cover-steve.jpg"  alt="happy steve is happy"   class="center-wide"  >}}

## Minecraft Server with Docker

My kids, like so many others their age, have been fans of Minecraft for years. Especially with a pandemic going on -- and in our case, moving away from friends during 2020 -- they have really loved being able to use Minecraft servers as shared playgrounds.

In this post I'll break down how I'm running them with docker, which has made it incredibly easy to roll with their ongoing requests.

## Getting Started

It all started really innocently. 

> **Eldest Child**: Hey Dad, can you set me up a vanilla Minecraft server for my friends and I?
>
>**Me**: I'm sure that won't be too painful.
>
> **... ONE GOOGLE LATER ...**

I just ran this docker command in the terminal and ...
```
$ docker run -d -p 25565:25565 -v /home/jbarratt/data/minecraft:/data --name mc -e EULA=TRUE --restart always itzg/minecraft-server
```

... it worked! Minecraft server was up and running on our home machine, a silent and bulletproof [Intel NUC](https://www.intel.com/content/www/us/en/products/boards-kits/nuc.html) which has been my utility server for years.

I'd found [itzg/minecraft-server](https://hub.docker.com/r/itzg/minecraft-server), a really complete and excellent wrapper for Minecraft by [Geoff Bourne](https://itzg.github.io). It supports not just vanilla Minecraft, but a dizzying array of other ways you can run it, with different server implementations, mod types, and more.

Geoff also has created some other tooling I'm using, like [docker-mc-backup](https://github.com/itzg/docker-mc-backup), that we'll get into as well. A massive thanks to him and the contributors to that family of open source projects, it's been a lifesaver.

So, it's really easy to be up and running! I just had to forward a port through our gateway, and my son and his friends were happily both mining AND crafting, with literally one command line entered.

Let's unpack the docker command a bit more to see what it actually does:

* `-d`: run the command in the background (detached)
* `-p 25565:25565`: patch through the normal minecraft port on the host into the minecraft port on the container
* `-v /home/jbarratt/data/minecraft:/data`: attach a directory called minecraft in my home directory into `/data` on the container
* `--name mc`: name the container `mc` so it can be managed, like `docker restart mc`
* `-e EULA=TRUE`: Set an environment variable called EULA to TRUE, which means yep, Microsoft, I accept your license agreement.
* `--restart always`: If the server process crashes, it'll restart itself. Which means nobody comes running into frame on my zoom meeting with an urgent problem.

This is a pretty good start!

But ... the story didn't end there.

## Making it better with `docker-compose`

For single hosts, it's still hard to argue that you get much value from a container orchestrator like kubernetes or nomad. (Though there are [helm charts available](https://github.com/itzg/minecraft-server-charts/tree/master/charts/minecraft) if you are so inclined.) However, it was not ideal to keep running variants of the command line every time the kids wanted to tweak something.

So for things like this, I (still) use `docker-compose`. It's really simple to run if you already have docker installed -- you can run it as a container itself, with a tiny shell script wrapper. ([Install Docker Compose As A Container](https://docs.docker.com/compose/install/#install-as-a-container)). And since it's a well-understood format, you can translate it -- automatically in some cases -- to other container orchestrators if needed.

All you need to do is:

1. Install docker-compose
1. Create a yaml definition of your services
2. `docker-compose up -d`

You can see my full [minecraft.yml](https://github.com/jbarratt/docker-homelab/blob/main/minecraft.yml) file in my public github repo.

I tend to break docker-compose files into named units, as you can run `docker-compose` on just a subset of things, or all of them, as needed. Here's how the original vanilla server looks in docker-compose format:

```yaml
services:
  mc:
    image: itzg/minecraft-server
    ports:
      - 25565:25565
    environment:
      MOTD: "Vanilla Minecraft, Chill Vibes Only"
      EULA: "TRUE"
      ENABLE_RCON: "true"
      RCON_PASSWORD: ${RCON_PASSWORD}
      RCON_PORT: 28016
      restart: always
    volumes:
    - ${HOME}/data/minecraft:/data
```

As you can see, basically the same, but with a few extra variables set, like the MOTD which shows up in the server list when you try and connect from the client.

To run this, because it's in a broken out yaml file (`minecraft.yml`) so the minecraft bits can be managed without juggling all the other things running on the host, you have to run 

```shell
$ docker-compose -f minecraft.yml up -d
```

or whatever other command you're running. This is a lot of typing, so I add aliases to my shell like

```
alias dcm='docker-compose -f minecraft.yml'
```

So I can easily do things like 

```shell
## Shut down all the containers

$ dcm stop

## Connect to RCON on one of the servers, in case you, say, get a text "can u give buddy22323 ops on the server plz" while you are in an important work all-hands.

$ dcm exec mc rcon-cli

## See which containers are running

$ dcm ps

## Check recent logs from a server to see why buddy22323 can't connect to the host

$ dcm logs disneyland
```

## Adding More Servers

After they played on vanilla for a while, the requests started to get more exotic. YouTube, a blessing and a curse for the modern dadmin. How about [some resource packs](https://vanillatweaks.net)? What about a forge server with WorldEdit and the [create mod](https://www.curseforge.com/minecraft/mc-mods/create)?

Luckily, more servers is easy. Just add more YAML!

This is the server getting the most action at the time of writing, they are attempting to recreate as much of Disneyland as they can. Extra Pandemic Points, make your own virtual version of a theme park you can't visit, together with your friends you also can't visit!

```yaml
disneyland:
    image: itzg/minecraft-server:java15
    ports:
      - 25567:25565
    environment:
      TYPE: "FORGE"
      MOTD: "Disneyland Server"
      MODE: "creative"
      MEMORY: "4G"
      LEVEL_TYPE: "FLAT"
      EULA: "TRUE"
      ENABLE_RCON: "true"
      RCON_PASSWORD: ${RCON_PASSWORD}
      RCON_PORT: 28016
      restart: always
    volumes:
    - ${HOME}/data/disneyland:/data
```

It's basically the same as before, except the port on the physical host is different, there's a different storage path on disk, we're giving it more memory because apparently mods are like cookie monster when it comes to RAM, and it's running a Forge server.

It can't be stated enough how nice it was to get a request for a forge server, and to be able to have it up and running in a few moments.

In fact, writing this post provided a great example of why this stack is so nice. I had been running things in an alpine java15 container, which I noticed today is, acoording to the  README.md, now deprecated in favor of the `java15`/Debian version.

All I had to do was:

1. Search/replace `adopt15` with `java15` in the `yml` file
2. `dcm down`
3. `dcm up -d`

and 4 servers came right up, running different OS's, and ready for the kids to play.

## Adding Backups to the party

The minecrafters are putting a huge amount of time and love into these creations. I really want them to be safe against all kinds of badness, including

* Mistakes. I talk about "blast radius" in architectures at work, but sometimes these folks work with actual (ok, "actual") TNT.
* Griefers. We have allow lists on the servers, so it hasn't been a problem, but sometimes even friends can be griefers when feelings run hot.
* Hardware issues. The servers are running on a 5 year old machine. It's also sitting near some pre-teens who don't always make good choices with where they keep their beverages. Safety first.

So, `itzg` to the rescue again -- at least for now -- with [itzg/mc-backup](https://hub.docker.com/r/itzg/mc-backup). 

### Backup

Here is how it works:

{{< img src="backup.svg"  alt="backup process"   class="center"  >}}

Since all the different minecraft servers are set to store their data in the same directory tree on the disk, they can be backed up as a unit. 

This isn't perfect -- which is why the "for now" -- because mc-backup is designed to work only with a single server instance. It didn't make sense to run a backup process for *every* container I'm running, but mc-backup has a handy feature where it uses rcon to turn off/on the server's saves. If you tell the server not to save while it's being backed up, it ensures that the world is in a consistent state. So, for now, it's pointing at just one of the containers.

There are several modes you can run mc-backup in. Here's my configuration:

```yaml
backup:
    image: itzg/mc-backup
    # This needs to be set because backups use hostnames
    hostname: minecraftbackup
    environment:
      BACKUP_METHOD: restic
      BACKUP_INTERVAL: "3h"
      INITIAL_DELAY: 5
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
      AWS_DEFAULT_REGION: us-west-2
      RESTIC_REPOSITORY: ${RESTIC_REPOSITORY}
      RESTIC_FORGET_ARGS: ${RESTIC_FORGET_ARGS}
      RESTIC_PASSWORD: ${RESTIC_PASSWORD}
      RCON_PASSWORD: ${RCON_PASSWORD}
      RCON_PORT: 28016
      RCON_HOST: disneyland
    volumes:
      - ${HOME}/data:/data:ro
      - ${HOME}/recover:/recover
```

Ok! Quite a bit to unpack. I'm using `BACKUP_METHOD=restic`, which means it's using [restic](https://restic.net) internally. If you're not familiar with restic, it's great! They call it "backups done right", and after a few years of using it, I agree. For our purposes, some of the nice things to note are:

* It can do incremental backups, only sending up the parts that have changed since the last run
* It can work with many storage backends, including s3, and doesn't make an object for every file -- so it can affordably deal with a large file count

It's important to note all the variables in curly braces, like `${AWS_ACCESS_KEY_ID}`. Those are all set in a file named `.env` in the same directory as `minecraft.yml`. This means I can have different versions of that on my laptop, for testing, vs on my home server itself. I don't want to hear the wails and lamentations of my children when they can't get to the server during the magic windows when they and their friends have screen time. It also means all that sensitive data can be kept out of source control.

(I actually keep contents of files like that in 1Password's secure notes. It works well enough for home use.)

For s3, I had a bucket for backups already set up, so it was just a matter of making a new IAM user with a custom policy allowing it only the access needed by restic:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::mybucketname"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::mybucketname/myhost/*"
        }
    ]
}
```

Effectively, you can list this bucket, and Put/Get/Delete objects into a specified "subdirectory" in the backup bucket.

### Recovery

In the composer file, this container actually has two volume mounts:

```yaml
    volumes:
      - ${HOME}/data:/data:ro
      - ${HOME}/recover:/recover
```

The one mounted to `/data` is where this container looks for source data. It's mounted `:ro` (read-only) which is really helpful. The backup container cannot change the data in any way, only read a copy of it for backing up.

So, I attached a second volume mount for recovery. Because you're not really adulting until you're backing up AND testing that you can restore from your backups. (And monitoring your backup job, ok, that is on the short list.)

What's nice about this setup is that you can connect to the running container and run a shell -- which, because of the environment variables being loaded up, already has the needed credentials, paths to the s3 bucket, and so on.

```shell
$ dcm exec backup /bin/bash
bash-5.0# restic snapshots
repository daf8cb19 opened successfully, password is correct
ID        Time                 Host             Tags              Paths
-----------------------------------------------------------------------
94020005  2021-02-01 17:43:10  minecraftbackup  mc_backups,world  /data
4606c6fd  2021-02-01 23:54:54  minecraftbackup  mc_backups,world  /data
77848789  2021-02-02 23:57:07  minecraftbackup  mc_backups,world  /data
16564cc4  2021-02-03 23:58:50  minecraftbackup  mc_backups,world  /data
278bad9d  2021-02-05 00:01:01  minecraftbackup  mc_backups,world  /data
d6bb4673  2021-02-06 00:03:11  minecraftbackup  mc_backups,world  /data
807057d6  2021-02-07 00:04:03  minecraftbackup  mc_backups,world  /data
8512f4de  2021-02-08 00:04:34  minecraftbackup  mc_backups,world  /data
e95fbf5f  2021-02-08 05:11:17  minecraftbackup  mc_backups,world  /data
-----------------------------------------------------------------------
9 snapshots
bash-5.0# restic restore e95fbf5f --include /data/disneyland/world --target /recover/testrestore
repository daf8cb19 opened successfully, password is correct
restoring <Snapshot e95fbf5f of [/data] at 2021-02-08 05:11:17.975458289 +0000 UTC by root@minecraftbackup> to /recover/testrestore
```

You can restore the whole archive or, in the case of a single server's world needing to be rolled back, just the specific directory you need.

## Conclusions and next steps

This has been a very productive, safe, and fun setup. I love being able to say "sure!" when they want to try out a new mod or server type, and more often than not have it just work. And having good (tested) backups as a safety net makes everything feel more stable.

The next steps are to make things even more buttoned up:

* monitoring the minecraft servers, their activity, and memory use with prometheus. There are exporters, but much like mc-backup, they're designed to pair with a single container.
* monitoring the backups to ensure they run on schedule, and alerting if they don't
* updating the backup to turn saves off on _all_ worlds via rcon
* monitoring to make sure saving gets turned back on, even if the backup process crashes
* adding alerting to the host server for things like SMART warnings or disk full issues

Thanks for reading, and let me know your favorite mods or other ways you run Minecraft servers like an adult!

<p style="font-size: 0.6rem;font-style: italic;">
The cover image <a href="https://www.flickr.com/photos/128776630@N02/15944373702">"minecraft"</a><span> by <a href="https://www.flickr.com/photos/128776630@N02">downloadsource.fr</a></span> is licensed under <a href="https://creativecommons.org/licenses/by/2.0/?ref=ccsearch&atype=html" style="margin-right: 5px;">CC BY 2.0</a><a href="https://creativecommons.org/licenses/by/2.0/?ref=ccsearch&atype=html" target="_blank" rel="noopener noreferrer" style="display: inline-block;white-space: none;margin-top: 2px;margin-left: 3px;height: 22px !important;"><img style="height: inherit;margin-right: 3px;display: inline-block;" src="https://search.creativecommons.org/static/img/cc_icon.svg?image_id=31e4ef9c-033a-4510-bd18-6727ae299802" /><img style="height: inherit;margin-right: 3px;display: inline-block;" src="https://search.creativecommons.org/static/img/cc-by_icon.svg" /></a></p>
