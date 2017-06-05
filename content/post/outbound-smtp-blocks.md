+++
date = "2004-06-10T13:37:00-07:00"
title = "Outbound SMTP blocks"
slug = "outbound-smtp-blocks"
+++


Stupid ISP tried to lock down outbound SMTP, ostensibly to shut down traffic from spammers and trojaned windows machines.

Thank goodness for SSH.

`su -c "ssh -L 25:localhost:25 user@mail.server.com"`

Just repoint my mail client to use 'localhost' as a server, and viola.
