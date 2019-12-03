---
title: "Making a Smarter Smart Thermostat with Go, Lambda, and SAM"
slug: "smarter-smart"
date: 2019-06-06T18:02:09Z
lastmod: 2019-06-06T18:02:09Z
description: "The Sensibo Sky improved the temperature control in my office, and almost worked the way I wanted. This is the story of getting it the rest of the way, with a little extra help from Go and Serverless technologies."
summary: "The Sensibo Sky improved the temperature control in my office, and almost worked the way I wanted. This is the story of getting it the rest of the way, with a little extra help from Go and Serverless technologies."
draft: false
---

After working full time remote for a few years, our family invested in a backyard office. This is really excellent, as it provides a nice way for home to be home and work to be work, and it's hard to beat the commute. However, it became clear very quickly that some way to manage the indoor temperature was very important. The winter is often below freezing, and the summer can get quite hot.

After toughing out a few seasons, we had a small mini-split AC unit installed. It's quiet, efficient, and ideal 

... Almost. 

It has a simple built-in thermostat, but since the unit is high up on the wall, there can be a suprisingly large temperature difference between where I'm standing and where the unit is, meaning a lot of time 'surfing' the remote. It also had a very limited scheduling ability, and more than a few times Monday morning meant the discovery that an empty office had spent the weekend being climate controlled.

A few weeks ago I stumbled across the [Sensibo Sky](https://sensibo.com). It's a small box that sits on the wall near you (so it's sensing the temperature you're experiencing), and controls the unit with the same infrared signals that the remote control usually uses. It's got an app, and has scheduling, and seemed like it would be perfect. And it was! 


... Almost.

 The Sensibo has a feature called "Climate React", which enables rules to be set. Something like "If the temperature goes under 65 degrees, turn the heat on; if it goes over 72 degrees, turn the heat off."

 It also has scheduling, enabling you to turn the unit off and on at various times.

 * You can't schedule Climate React! So if you schedule a shutdown at 5pm on workdays, and have Climate React configured, it will just turn the device back on.
 * You can only have 1 pair of temperatures with Climate React. So you can't say "if it's cold, heat the room, and if it's hot, cool the room." There are several months in the year where the room starts the day cool and ends it hot, so this means a lot of surfing the app instead of surfing the remote.

## Enter The Automation

The title of this post is a spoiler for what comes next. It turns out the service has an API, and unlike many of the 'smart' products, it's actually an official, documented, API! 


... Almost.

The [API Documentation](https://sensibo.github.io/) is available, and there's even a [python SDK](https://github.com/Sensibo/sensibo-python-sdk), but sadly, neither are up to date, or particularly accurate.

Luckily, armed with an API key and [httpie](https://httpie.org), it's pretty straightforward to see what's going on. 

```shell
export SENSIBO_API_KEY="key I got from the website"

# This got the full payload of almost everything that can be learned from the API
http get https://home.sensibo.com/api/v2/users/me/pods?fields=*\&apiKey=$SENSIBO_API_KEY | jq .

# This filtered it down to just the information needed to implement the logic
http get https://home.sensibo.com/api/v2/users/me/pods?fields=acState,measurements,smartMode,id\&apiKey=$SENSIBO_API_KEY | jq .

# Tweaking the JSON output led to the ability to push modifications
http post https://home.sensibo.com/api/v2/pods/$SENSIBO_DEVICE/smartmode?apiKey=$SENSIBO_API_KEY < handcrafted_payload.json
```

The API had a few quirks, like `POST` for things that might more commonly be `PUT`s, and variation in which JSON bodies needed to have enclosing dictionaries and which didn't, but all pretty manageable.
Also, while Climate React says it can be 'disabled', it doesn't stay disabled. The only way to disable it seems to be to make the actions that are taken at either the high or low temperature thresholds be 'turn unit off.'

## Let's a `go`

To get started with a Go RESTish client, it's helpful to start with the [JSON to Go](https://mholt.github.io/json-to-go/) translator. With some tweaking, this resulted in [some Go structures](https://github.com/jbarratt/smarter_sensibo/blob/master/code/pkg/sensibo/types.go) which can deserialize the HTTP calls.

The code for the resulting app is available: [smarter_sensibo](https://github.com/jbarratt/smarter_sensibo/code).
It's got 2 internal packages: 

* `pkg/sensibo`, which has a somewhat generic client for the sensibo API (not designed to be fully featured)
* `cmd/smarter_sensibo`, the app which implements some specific logic.

That logic is:

* The device should be off outside of M-F, 6am-5pm -- this means the Climate React (aka Smart Mode, according to the API) should be set to take no actions.
* within the active window,
  * If it's under 70 degrees in the office, load up a 'warming' configuration (if under 68 degrees, start warming, if over 74, power off)
  * If it's over 75 degrees in the office, load up a 'cooling' configuration (if over 74 degrees, start cooling, if under 71, power off)

The workflow followed by the app is

1. On startup, fetch the state from the full API, and make a copy of it
2. The state can then be observed/modified to implement the above algorithm
3. Changes are then checked for in the AC state (off/on) or the SmartMode configuration. Those API endpoints need to be pushed to separately, and they only are hit if needed.

## Automating The Automation

That code is meant to run every 30 minutes or so. Back In The Day, this would have been a case for a cron job on a server, but it's 2019, let's go Server*less*. 

### Managing Credentials

First things first, this code needs an API key.

AWS's Parameter Store is really a delight. You can put an encrypted secret into it with a simple command. This is one area where it feels reasonable to take things out of configuration management, because where do you store the secrets that secure the secrets in that code? It ends up being turtles all the way down.

```shell
$ aws ssm put-parameter --name '/keys/sensibo' --value "your key" --type "SecureString"
```

Once the key's stored in there, it's pretty easy to extract with Go. This code looks for an environment variable called `SENSIBO_API_KEY`. It either uses it as the API key, or if that starts with `ssm:`, it means it needs to be pulled out of the parameter store using that key.

This should probably return errors instead of going the `log.Fatal` route, but since the code is totally useless without an API key, it's fine for now.

```golang
func (c *Client) loadApiKey() {

	// try to load it from the environment
	var ok bool
	c.apiKey, ok = os.LookupEnv("SENSIBO_API_KEY")
	if !ok {
		log.Fatal("Need SENSIBO_API_KEY set")
	}
	if strings.HasPrefix(c.apiKey, "ssm:") {
		path := strings.TrimPrefix(c.apiKey, "ssm:")
		sess, err := session.NewSession(aws.NewConfig())
		if err != nil {
			log.Fatal(err)
		}

		withDecryption := true
		svc := ssm.New(sess)
		req := ssm.GetParameterInput{Name: &path, WithDecryption: &withDecryption}
		resp, err := svc.GetParameter(&req)
		if err != nil {
			log.Fatal(err)
		}

		c.apiKey = *resp.Parameter.Value
	}
}
```

There's one other little tweak which enables it to run locally as well. In a normal Lambda-only app, the main method just calls the `Handler` function. But since the Lambda execution environment sets some well known environment variables, it's possibly to determine if it's in 'lambda mode' or not.

```golang
func main() {
	// detect if this is running from within a lambda
	_, inLambda := os.LookupEnv("AWS_LAMBDA_FUNCTION_NAME")
	if inLambda {
		lambda.Start(HandleRequest)
	} else {
		syncSensibo()
	}
}
```

### Deploying

[AWS SAM](https://aws.amazon.com/serverless/sam/) has turned into a really nice way to deploy and manage serverless apps. They've struck a really nice balance between a syntax which lets you express common things simply, while also being almost endlessly customizable when needed.

This is the entire template which

* Deploys the Go binary in a Lambda function
* Gives it permission to read the API key from the parameter store
* Runs it every 30 minutes

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: >
  smarter-sensibo
  SAM Template to run sensibo automated smartening

Globals:
  Function:
    Timeout: 5

Resources:
  SmarterSensiboFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: code/
      Handler: handler
      Runtime: go1.x
      Environment:
	Variables:
	  SENSIBO_API_KEY: "ssm:/keys/sensibo"
      Policies:
      - SSMParameterReadPolicy:
	  ParameterName: "keys/sensibo"
      Events:
	Time:
	  Type: Schedule
	  Properties:
	    Schedule: rate(30 minutes)
```

That is almost mindblowingly impressive. I especially appreciate the number of standard policies that are included now -- it appears the maintainers are really good at taking community contributions, too.
It's really nice to have turnkey, parameterized IAM policies available such as `SSMParameterReadPolicy` to let this app *just* fetch a single parameter from the store.

Once SAM is installed, and a bucket is configured, it can be launched with just 2 lines:

```shell
$ sam package --output-template-file packaged.yaml --s3-bucket $BUCKET_NAME
$ sam deploy --template-file packaged.yaml --stack-name sensibo-app --capabilities CAPABILITY_IAM
```

That's really, really awesome. (It's even more awesome once you [toss those commands in a Makefile](https://github.com/jbarratt/smarter_sensibo/blob/master/Makefile) and then just do `make build && make package && make deploy`.)

### Monitoring

This has been running for a few days now, and it's been working flawlessly. That's really exciting.

However, especially with the interesting discoveries around the API quirks, it doesn't seem safe to assume that it will just keep working ... even more than it *usually* doesn't make sense to assume things will keep working.

This is where CloudWatch comes in handy. Sending a custom metric if and only if the job completes successfuly -- and then checking to make sure they're coming through -- is a really robust solution, often referred to as a 'Dead Man Switch.'

While metrics can be submitted directly from the Lambda app, that's not ideal, because you're paying for the Lambda runtime to submit that metric. In this case, it's likely a wash -- but Metric Filters are easy enough to set up, why not!

So, at the end of the handler, emit some text that can be easily scanned for:

```golang
func HandleRequest(ctx context.Context, e events.CloudWatchEvent) error {
	syncSensibo()
	// print this so the metric filter can count it
	log.Println("SENSIBO_SETTING_SUCCESS")
	return nil
}
```

Then, add a [whole bunch of stuff](https://github.com/jbarratt/smarter_sensibo/blob/master/template.yaml) to what was a beautifully simple and pure SAM template.

First, filter the logs and watch for that string:

```yaml
DeadManFilter:
    Type: AWS::Logs::MetricFilter
    DependsOn: [SensiboLogGroup]
    Properties:
      FilterPattern: "SENSIBO_SETTING_SUCCESS"
      LogGroupName: !Sub /aws/lambda/${SmarterSensiboFunction}
      MetricTransformations:
        -
          MetricValue: "1"
          MetricNamespace: "custom/SmarterSensibo"
          MetricName: "SuccessCount"
```

That just spits a `1` into the named metric every time it sees the special `SENSIBO_SETTING_SUCCESS` string.

Once that's in place, it can be alarmed on. Because `TreatMissingData` is `breaching`, the alarm will go off if no data comes in -- and so if the job doesn't run to completion without errors, it'll be breaching.

```yaml
DeadManAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmDescription: "Sensibo Setting Failure"
      AlarmActions:
      - !Ref Topic
      MetricName: "SuccessCount"
      Namespace: "custom/SmarterSensibo"
      Threshold: 0
      ComparisonOperator: LessThanThreshold
      DatapointsToAlarm: 1
      TreatMissingData: breaching
      Period: 3600
      EvaluationPeriods: 1
      Statistic: Sum
      Unit: Count
```

The rest of the config just

* Sets up the SNS topic for the alarm to send to
* Adds the permissions to that topic
* Subscribes an email address to the alerts


## Future work

It's done!

... Almost.

Like anything, there are things that could be improved.

* Unit tests would be helpful. (Oops, I usually do those first.)
* One needed capability is a simple way to disable this automation, for when extended hours are being worked, or people are spending the night in the office. Right now the low tech way to do this is to simply cover the sensibo unit so it can't beam the IR out.
* Get all the magic numbers out of the code. It'd be nice (and probably help with the automation disabling/modification) to have some sort of config file or store, instead of hard coding them.
* Prevent the API key from logging. The full HTTP request/response are logged on most failures, to aid future troubleshooting. This is fine but it's not great to have the API keys included in the responses.
* Revamp error handling to remove fatals and be more tactical about when to and not to log the 'success' message.

## Conclusion

The big conclusion? API's, am I right? Even when they're underdocumented and confusing, when they exist, you can get things *done*.

But also, serverless is a pretty incredible way to have this work.

* The code and the automation around it are actually pretty simple. Especially having gotten this working, there'd be really low overhead around launching a second little scheduled task.
* It's free to run. It should take a whopping 216 GB/Seconds/month to run; the free tier gives you 400,000 GB/Seconds a month.
* The reliability should be amazing. A lot would have to go wrong before this Lambda would fail to run for any extended period.
* The secrets are quite strongly encrypted; a big improvement over the plaintext values in a config file that were the state of the art not long ago.
* With, again, effectively zero cost and 40 lines of YAML, this service is self-monitoring and self-alerting. Another capability that would have required more managed tooling in the past.

There's plenty of darkness to go around in 2019, but the current state of these tools is really something to celebrate.
