---
title: "Envoy + Custom Auth + Ratelimiter Example"
date: 2019-05-25T21:13:35-08:00
lastmod: 2019-05-25T21:13:35-08:00
description: "Using Envoy with external authorizer and a ratelimit service to implement custom logic."
slug: "envoy-ratelimits"
draft: false
---

<style>
img[src$='#center-wide']
{
    display: block;
    margin: 0 auto;
    width: 75%;
    max-width: 90%;
}
</style>

Recently, one of the teams I work with selected Envoy as a core component for a system they were building. I'd been impressed for some time by presentations on it, and the number of open source tools which had included it or built around it, but hadn't actually explored it in any depth. 

I was especially curious about how to use it in the edge proxy mode, essentially as a more modern and programmable version of something I would have historically used nginx for. The result was a small [dockerized playground](https://github.com/jbarratt/envoy_ratelimit_example) which implements this design.

![Envoy Architecture](/images/envoy_arch.png#center-wide)

* A client requests a resource from a backend
* Using Envoy's External Authorizer interface
	* Authenticate the call, rejecting it if invalid
	* Set custom headers which can be used for rate limiting
* Depending on the route, supply different information to use for rate limiting
* Using the Ratelimiter interface, apply a rate limit, rejecting if over-limit
* Finally, pass to a backend, and return the response to the client

With this limited experience I can say Envoy more than lived up to my expectations. I found the documentation complete, but sometimes terse, which is one of the reasons I wanted to write this up -- it was hard to find complete examples of this kind of pattern, so hopefully if you're reading this, it saves you some effort!

For the rest of this post I'll be going layer by layer through how each component works.

## The Docker Environment

I'm using `docker-compose` for this, as it provides simple orchestration around building and running a stack of containers, and the unified log view is very helpful.

There are 5 containers:

* `envoy`, which, no shock, is ... envoy
* `redis`, used to store the rate limit service's data
* `extauth`, a custom go app which implements Envoy's gRPC spec for external authorization
* `ratelimit`, Lyft's open source rate limiter service which implements the Envoy gRPC spec for rate limiting
* `backend`, a custom go app which is essentially "hello world", and also prints the headers it recieves.

`docker-compose` also creates a network (`envoymesh`) for all the services to share, and exposes various ports. The most important one ends up being `8010` (or `localhost:8010` on most docker machines) which is the public HTTP endpoint.

To get it running:

* clone the repo
* You'll also need a local copy of lyft's ratelimit. Submodules were causing some challenges, so it's easiest to `git clone git@github.com:lyft/ratelimit.git`

I had to make some manual tweaks to the `ratelimit` codebase to get it to build -- which may be operator error:

* `mkdir ratelimit/vendor` (the `Dockerfile` expects it to exist already)
* add a `COPY proto proto` to the `Dockerfile` with the rest of the `COPY` statements
* Run `docker-compose up`. The first one will take some time as it builds everything.

You can ensure that the full stack is working with a simple curl, which also shows traces of all the moving parts.

* Instead of integrating with a true identity provider, all bearer tokens which are 3 characters long are considered to be valid.
* The authorizer sets a header (`X-Ext-Auth-Ratelimit`) which can be used for unique per-user rate limiting
* In the envoy config, the Authorization header is stripped, so sensitive identity information is not pushed to backends

```
$ curl -v -H "Authorization: Bearer foo" http://localhost:8010/                                                                     
> GET / HTTP/1.1
> Authorization: Bearer foo
> 
< HTTP/1.1 200 OK
< date: Tue, 21 May 2019 00:23:12 GMT
< content-length: 270
< content-type: text/plain; charset=utf-8
< x-envoy-upstream-service-time: 0
< server: envoy


Oh, Hello!

# The backend got these headers with the request
X-Request-Id: 6c03f5f4-e580-4d8f-aee1-7e62ba2c9b30
X-Ext-Auth-Ratelimit: LCa0a2j/xo/5m0U8HTBBNBNCLXBkg7+g+YpeiGJm564=
X-Envoy-Expected-Rq-Timeout-Ms: 15000
X-Forwarded-Proto: http
```

## Defining the backend

The backend shows up a few times in the `envoy.yaml` config file.

First, it's defined as a 'cluster' (though, as a single container, it's not much of a cluster.)

```
  clusters:
  - name: backend
    connect_timeout: 0.25s
    type: STRICT_DNS
    lb_policy: round_robin
    load_assignment:
      cluster_name: backend
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: backend
                port_value: 8123
```

This is an example of where the envoy config can take some time to understand. For a simple "single host" backend it takes some pretty significant boilerplate. But, it's also incredibly powerful. We're able to define how to look up the host, how they should be load balanced, more than one cluster, more than one load balancer within a cluster, and more than one endpoint within that. It's entirely possible that this definition can be simplified, but this version works.

One nice thing is that the cluster definition is the same when defining one of the services that envoy will proxy to as it is for 'helper' services that are integrated with, like the authorizer and rate limiter. It's also great that they are data structures which can be managed at runtime via the configuration APIs.

So, now that the backend is defined, it's time to get it some traffic, and that's done via routes.

```
  route_config:
    name: local_route
    virtual_hosts:
    - name: local_service
      domains: ["*"]
      routes:
      - match: { prefix: "/" }
        route: 
          cluster: backend
```

Again, a decent bit of data structure to say "send all traffic to the cluster I defined called `backend`", but as we'll see when it's time to add in conditional rate limiting, it provides similarly useful places to hook in additional configuration.

## Custom External Authorizer

Envoy has a filter module for external authorization.

```
            http_filters:
            - name: envoy.ext_authz
              config:
                grpc_service:
                  envoy_grpc:
                    cluster_name: extauth
```

This fragment of config says to call a gRPC service which is running at a cluster (defined the same as the backend above) called `extauth`.

I am so happy about 2 quasi-recent developments which make this so easy to build -- Go modules and Docker multi-stage builds.

Building a slim container, with just alpine and the binary of a go app, only takes this little fragment of `Dockerfile`. Yes, please.

```
FROM golang:latest as builder

COPY . /ext-auth-poc
WORKDIR /ext-auth-poc
ENV GO111MODULE=on
# do this in a separate layer to cache deps from build to build
RUN go get
RUN CGO_ENABLED=0 GOOOS=linux go build -o ext-auth-poc

FROM alpine:latest
WORKDIR /root/
COPY --from=builder /ext-auth-poc .
CMD ["./ext-auth-poc"]

```

Ok, so how do we build the app? For Go services, Envoy has made things very clean and straightforward.

[Simple custom authorizer code](https://github.com/jbarratt/envoy_ratelimit_example/blob/master/extauth/main.go)

The types are includable from the Envoy repository, e.g.

```
auth "github.com/envoyproxy/go-control-plane/envoy/service/auth/v2"
```
which define things like an `CheckRequest` and `CheckResponse`.

This allows constructing and returning the proper responses based on what we need to do. Here's the core of the successful path, for example:

```
// inject a header that can be used for future rate limiting
func (a *AuthorizationServer) Check(ctx context.Context, req *auth.CheckRequest) (*auth.CheckResponse, error) {
...
		// valid tokens have exactly 3 characters. #secure.
		// Normally this is where you'd go check with the system that knows if it's a valid token.

		if len(token) == 3 {
			return &auth.CheckResponse{
				Status: &rpc.Status{
					Code: int32(rpc.OK),
				},
				HttpResponse: &auth.CheckResponse_OkResponse{
					OkResponse: &auth.OkHttpResponse{
						Headers: []*core.HeaderValueOption{
							{
								Header: &core.HeaderValue{
									Key:   "x-ext-auth-ratelimit",
									Value: tokenSha,
								},
							},
						},
					},
				},
			}, nil
		}
	}
```

The ability to write arbitrary code at this point of the request cycle is very powerful, because adding headers here can be used for all kinds of decisions, including routing and (as we're doing here) rate limiting.